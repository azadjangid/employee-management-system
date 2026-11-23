import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db/pool.js";
import { parse, id } from "../lib/validate.js";
import { notFound, badRequest, HttpError } from "../lib/errors.js";
import { forbidden } from "../lib/access.js";
import { authorize } from "../middleware/authorize.js";
import { audit, diff } from "../lib/audit.js";
import { notify, notifySafely } from "../lib/notify.js";
import { generatePayslips, clearPayslips, monthRange } from "../lib/payroll.js";

const router = Router();
const adminOnly = authorize("admin");

// Who can do what:
//   admin             - salaries, payroll runs, everyone's payslips
//   manager/employee  - their own payslips from paid runs

const monthLabel = (iso) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

// ---- Salaries ---------------------------------------------------------------

const money = z.coerce.number().min(0, "Must be 0 or more").max(10_000_000);
const salaryBody = z.object({
  basic: money,
  hra: money.default(0),
  allowances: money.default(0),
  pf: money.default(0),
  professionalTax: money.default(0),
  tds: money.default(0),
});

const SALARY_SELECT = `
  SELECT e.id AS "employeeId", e.employee_code AS "employeeCode",
         trim(e.first_name || ' ' || e.last_name) AS name, e.designation,
         d.name AS department, e.status,
         s.basic, s.hra, s.allowances, s.pf, s.professional_tax AS "professionalTax", s.tds,
         (s.basic + s.hra + s.allowances)::float AS gross,
         (s.pf + s.professional_tax + s.tds)::float AS deductions,
         s.updated_at AS "updatedAt"
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN salaries s ON s.employee_id = e.id`;

router.get("/salaries", adminOnly, async (req, res) => {
  const { rows } = await query(
    `${SALARY_SELECT} WHERE e.status <> 'Inactive' ORDER BY e.first_name, e.last_name`
  );
  res.json({ data: rows });
});

router.put("/salaries/:employeeId", adminOnly, async (req, res) => {
  const employeeId = parse(id, req.params.employeeId);
  const input = parse(salaryBody, req.body);
  const before = (await query(`${SALARY_SELECT} WHERE e.id = $1`, [employeeId])).rows[0];
  if (!before) throw notFound("Employee");
  await query(
    `INSERT INTO salaries (employee_id, basic, hra, allowances, pf, professional_tax, tds)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (employee_id) DO UPDATE SET
       basic = EXCLUDED.basic, hra = EXCLUDED.hra, allowances = EXCLUDED.allowances,
       pf = EXCLUDED.pf, professional_tax = EXCLUDED.professional_tax, tds = EXCLUDED.tds,
       updated_at = now()`,
    [employeeId, input.basic, input.hra, input.allowances, input.pf, input.professionalTax, input.tds]
  );
  const after = (await query(`${SALARY_SELECT} WHERE e.id = $1`, [employeeId])).rows[0];
  const pick = ({ basic, hra, allowances, pf, professionalTax, tds }) => ({
    basic, hra, allowances, pf, professionalTax, tds,
  });
  await audit(req, {
    action: "salary.update",
    entityType: "employee",
    entityId: employeeId,
    summary: `Updated ${after.name}'s salary`,
    changes: diff(pick(before), pick(after)),
  });
  res.json({ data: after });
});

// ---- Payroll runs -----------------------------------------------------------

const RUN_SELECT = `
  SELECT r.id, to_char(r.month, 'YYYY-MM') AS month, r.status, r.working_days AS "workingDays",
         r.paid_at AS "paidAt", r.created_at AS "createdAt",
         trim(c.first_name || ' ' || c.last_name) AS "createdBy",
         count(p.id)::int AS employees,
         COALESCE(sum(p.gross), 0)::float AS gross,
         COALESCE(sum(p.total_deductions), 0)::float AS deductions,
         COALESCE(sum(p.reimbursements), 0)::float AS reimbursements,
         COALESCE(sum(p.net_pay), 0)::float AS "netPay"
  FROM payroll_runs r
  LEFT JOIN payslips p ON p.run_id = r.id
  LEFT JOIN employees c ON c.id = r.created_by`;
const RUN_GROUP = "GROUP BY r.id, c.first_name, c.last_name";

const PAYSLIP_SELECT = `
  SELECT p.id, p.run_id AS "runId", to_char(r.month, 'YYYY-MM') AS month, r.status AS "runStatus",
         r.paid_at AS "paidAt",
         p.employee_id AS "employeeId", e.employee_code AS "employeeCode",
         trim(e.first_name || ' ' || e.last_name) AS name, e.designation, d.name AS department,
         p.basic, p.hra, p.allowances, p.gross, p.working_days AS "workingDays",
         p.lop_days AS "lopDays", p.lop_deduction AS "lopDeduction", p.pf,
         p.professional_tax AS "professionalTax", p.tds, p.total_deductions AS "totalDeductions",
         p.reimbursements, p.net_pay AS "netPay"
  FROM payslips p
  JOIN payroll_runs r ON r.id = p.run_id
  JOIN employees e ON e.id = p.employee_id
  LEFT JOIN departments d ON d.id = e.department_id`;

async function getRun(runId, db = { query }) {
  const { rows } = await db.query(`${RUN_SELECT} WHERE r.id = $1 ${RUN_GROUP}`, [runId]);
  if (!rows[0]) throw notFound("Payroll run");
  return rows[0];
}

router.get("/runs", adminOnly, async (req, res) => {
  const { rows } = await query(`${RUN_SELECT} ${RUN_GROUP} ORDER BY r.month DESC`);
  res.json({ data: rows });
});

router.get("/runs/:id", adminOnly, async (req, res) => {
  const run = await getRun(parse(id, req.params.id));
  const { rows } = await query(`${PAYSLIP_SELECT} WHERE p.run_id = $1 ORDER BY e.first_name`, [run.id]);
  res.json({ data: { ...run, payslips: rows } });
});

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");

/** Create a draft run for a month and calculate everyone's payslip. */
router.post("/runs", adminOnly, async (req, res) => {
  const { month } = parse(z.object({ month: monthSchema }), req.body);
  const { start, workingDays } = monthRange(month);
  const run = await withTransaction(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO payroll_runs (month, working_days, created_by) VALUES ($1, $2, $3)
       RETURNING id, month::text`,
      [start, workingDays, req.user.id]
    ).catch((err) => {
      if (err.code === "23505") throw new HttpError(409, `Payroll for ${monthLabel(start)} already exists`);
      throw err;
    });
    const count = await generatePayslips(db, rows[0]);
    if (!count) throw badRequest("No active employees have a salary set up yet");
    return getRun(rows[0].id, db);
  });
  await audit(req, {
    action: "payroll.create",
    entityType: "payroll_run",
    entityId: run.id,
    summary: `Ran payroll for ${monthLabel(start)}: ${run.employees} payslips, net ₹${run.netPay.toLocaleString("en-IN")}`,
  });
  res.status(201).json({ data: run });
});

async function getDraft(db, runId) {
  const { rows } = await db.query(
    "SELECT id, month::text, status FROM payroll_runs WHERE id = $1 FOR UPDATE",
    [runId]
  );
  if (!rows[0]) throw notFound("Payroll run");
  if (rows[0].status !== "Draft") throw badRequest("This payroll run has already been paid");
  return rows[0];
}

/** Recalculate a draft run (after salary or attendance corrections). */
router.post("/runs/:id/recalculate", adminOnly, async (req, res) => {
  const runId = parse(id, req.params.id);
  const run = await withTransaction(async (db) => {
    const draft = await getDraft(db, runId);
    await clearPayslips(db, runId);
    await generatePayslips(db, draft);
    return getRun(runId, db);
  });
  await audit(req, {
    action: "payroll.recalculate",
    entityType: "payroll_run",
    entityId: runId,
    summary: `Recalculated payroll for ${monthLabel(run.month)}`,
  });
  res.json({ data: run });
});

/** Mark a run as paid: locks it and marks the included reimbursements Paid. */
router.post("/runs/:id/pay", adminOnly, async (req, res) => {
  const runId = parse(id, req.params.id);
  const run = await withTransaction(async (db) => {
    await getDraft(db, runId);
    await db.query("UPDATE payroll_runs SET status = 'Paid', paid_at = now() WHERE id = $1", [runId]);
    await db.query(
      `UPDATE reimbursements SET status = 'Paid', updated_at = now()
       WHERE payroll_run_id = $1 AND status = 'Approved'`,
      [runId]
    );
    return getRun(runId, db);
  });
  const { rows } = await query("SELECT employee_id FROM payslips WHERE run_id = $1", [runId]);
  await notifySafely(() =>
    notify(
      rows.map((r) => r.employee_id),
      {
        title: "Payslip ready",
        body: `Your payslip for ${monthLabel(run.month)} is available.`,
        link: "/payroll",
      }
    )
  );
  await audit(req, {
    action: "payroll.pay",
    entityType: "payroll_run",
    entityId: runId,
    summary: `Marked payroll for ${monthLabel(run.month)} as paid (net ₹${run.netPay.toLocaleString("en-IN")})`,
  });
  res.json({ data: run });
});

router.delete("/runs/:id", adminOnly, async (req, res) => {
  const runId = parse(id, req.params.id);
  const month = await withTransaction(async (db) => {
    const draft = await getDraft(db, runId);
    await clearPayslips(db, runId);
    await db.query("DELETE FROM payroll_runs WHERE id = $1", [runId]);
    return draft.month;
  });
  await audit(req, {
    action: "payroll.delete",
    entityType: "payroll_run",
    entityId: runId,
    summary: `Deleted draft payroll for ${monthLabel(month)}`,
  });
  res.status(204).end();
});

// ---- Payslips -----------------------------------------------------------------

/** Own payslips from paid runs. Admins may pass ?employeeId= to see someone else's. */
router.get("/payslips", async (req, res) => {
  const q = parse(z.object({ employeeId: id.optional() }), req.query);
  const employeeId = q.employeeId ?? req.user.id;
  if (employeeId !== req.user.id && req.user.role !== "admin") throw forbidden();
  const { rows } = await query(
    `${PAYSLIP_SELECT} WHERE p.employee_id = $1 AND r.status = 'Paid' ORDER BY r.month DESC`,
    [employeeId]
  );
  res.json({ data: rows });
});

router.get("/payslips/:id", async (req, res) => {
  const { rows } = await query(`${PAYSLIP_SELECT} WHERE p.id = $1`, [parse(id, req.params.id)]);
  const slip = rows[0];
  const isOwner = slip && slip.employeeId === req.user.id && slip.runStatus === "Paid";
  if (!slip || (!isOwner && req.user.role !== "admin")) throw notFound("Payslip");
  res.json({ data: slip });
});

export default router;
