import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db/pool.js";
import { parse, id, date, pagination } from "../lib/validate.js";
import { buildUpdate, whereBuilder, paged } from "../lib/sql.js";
import { notFound, badRequest, HttpError } from "../lib/errors.js";
import { removeReceiptFile } from "../lib/uploads.js";
import { resolveDepartmentId } from "../lib/departments.js";
import { passwordSchema, hashPassword } from "../lib/auth.js";
import { ROLES, applyScope, assertCanAccessEmployee, forbidden } from "../lib/access.js";
import { authorize } from "../middleware/authorize.js";
import { audit, diff } from "../lib/audit.js";

const router = Router();

export const EMPLOYEE_STATUSES = ["Active", "Inactive", "On Leave"];

export const EMPLOYEE_SELECT = `
  SELECT e.id,
         e.employee_code AS "employeeCode",
         e.first_name AS "firstName",
         e.last_name AS "lastName",
         trim(e.first_name || ' ' || e.last_name) AS name,
         e.email, e.phone, e.designation,
         e.role,
         e.department_id AS "departmentId",
         d.name AS department,
         e.status,
         e.joining_date AS "joiningDate",
         e.location,
         e.created_at AS "createdAt",
         e.updated_at AS "updatedAt"
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id`;

const optionalText = (max = 200) => z.string().trim().max(max).nullish();

const employeeFields = z.object({
  employeeCode: z.string().trim().min(1).max(20).optional(),
  // Either firstName/lastName, or a single "name" that gets split.
  name: z.string().trim().min(1).max(200).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email")),
  phone: optionalText(30),
  designation: optionalText(100),
  // Access role (admin / manager / employee). The job title is "designation".
  role: z.enum(ROLES).optional(),
  departmentId: id.nullish(),
  department: z.string().trim().nullish(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  joiningDate: date.optional(),
  location: optionalText(200),
  // Optional initial password (or a reset by HR). Without one the person
  // can't sign in until they use "Forgot password".
  password: passwordSchema.optional(),
});

function normalize({ name, ...rest }) {
  if (name && !rest.firstName) {
    const [first, ...others] = name.split(/\s+/);
    rest.firstName = first;
    rest.lastName ??= others.join(" ");
  }
  return rest;
}

const createBody = employeeFields
  .transform(normalize)
  .refine((b) => b.firstName, { message: "Name is required", path: ["name"] });

const updateBody = employeeFields.partial().transform(normalize);

const listQuery = z.object({
  search: z.string().trim().optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  departmentId: id.optional(),
  department: z.string().trim().optional(),
  sort: z.enum(["name", "joiningDate", "createdAt"]).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
  ...pagination,
});

const SORT_COLUMNS = {
  name: "e.first_name, e.last_name",
  joiningDate: "e.joining_date",
  createdAt: "e.created_at",
};

export async function getEmployee(empId, db = { query }) {
  const { rows } = await db.query(`${EMPLOYEE_SELECT} WHERE e.id = $1`, [empId]);
  if (!rows[0]) throw notFound("Employee");
  return rows[0];
}

// Admins see everyone, managers see their department. Employees use /api/profile.
router.get("/", authorize("admin", "manager"), async (req, res) => {
  const q = parse(listQuery, req.query);
  const where = applyScope(whereBuilder(), req.user);
  if (q.search) {
    const p = where.param(`%${q.search}%`);
    where.add(
      `(e.first_name || ' ' || e.last_name ILIKE ${p} OR e.email ILIKE ${p}
        OR e.employee_code ILIKE ${p} OR e.designation ILIKE ${p} OR e.phone ILIKE ${p} OR d.name ILIKE ${p})`
    );
  }
  if (q.status) where.add("e.status = ?", q.status);
  if (q.departmentId) where.add("e.department_id = ?", q.departmentId);
  if (q.department) where.add("lower(d.name) = lower(?)", q.department);

  const dir = q.order === "desc" ? "DESC" : "ASC";
  const orderBy = SORT_COLUMNS[q.sort]
    .split(", ")
    .map((c) => `${c} ${dir}`)
    .join(", ");
  const { rows } = await query(
    `SELECT * FROM (${EMPLOYEE_SELECT.replace(
      "SELECT e.id,",
      "SELECT count(*) OVER () AS total_count, e.id,"
    )} ${where} ORDER BY ${orderBy}, e.id LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}) t`,
    where.values
  );
  res.json(paged(rows, q.page, q.limit));
});

router.get("/:id", async (req, res) => {
  const empId = parse(id, req.params.id);
  await assertCanAccessEmployee(req.user, empId);
  res.json({ data: await getEmployee(empId) });
});

/** Stop an admin from locking everyone out by removing the last active admin. */
async function assertAdminRemains(db, empId, input) {
  const losingAdmin =
    (input.role !== undefined && input.role !== "admin") ||
    (input.status !== undefined && input.status === "Inactive");
  if (!losingAdmin) return;
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM employees
     WHERE role = 'admin' AND status <> 'Inactive' AND id <> $1`,
    [empId]
  );
  const { rows: target } = await db.query("SELECT role FROM employees WHERE id = $1", [empId]);
  if (target[0]?.role === "admin" && rows[0].n === 0) {
    throw forbidden("There must be at least one active admin");
  }
}

router.post("/", authorize("admin"), async (req, res) => {
  const input = parse(createBody, req.body);
  const employee = await withTransaction(async (db) => {
    const departmentId = await resolveDepartmentId(db, input);
    const {
      rows: [{ nextval }],
    } = await db.query("SELECT nextval(pg_get_serial_sequence('employees', 'id'))");
    const code = input.employeeCode ?? `EMP${String(nextval).padStart(3, "0")}`;
    await db.query(
      `INSERT INTO employees (id, employee_code, first_name, last_name, email, phone,
         designation, department_id, status, joining_date, location, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::date, CURRENT_DATE), $11, $12, $13)`,
      [
        nextval,
        code,
        input.firstName,
        input.lastName ?? "",
        input.email,
        input.phone ?? null,
        input.designation ?? null,
        departmentId ?? null,
        input.status ?? "Active",
        input.joiningDate ?? null,
        input.location ?? null,
        input.password ? await hashPassword(input.password) : null,
        input.role ?? "employee",
      ]
    );
    return getEmployee(nextval, db);
  });
  await audit(req, {
    action: "employee.create",
    entityType: "employee",
    entityId: employee.id,
    summary: `Added ${employee.name} (${employee.employeeCode}) as ${employee.role}`,
  });
  res.status(201).json({ data: employee });
});

router.put("/:id", authorize("admin"), async (req, res) => {
  const empId = parse(id, req.params.id);
  const input = parse(updateBody, req.body);
  let before;
  const employee = await withTransaction(async (db) => {
    before = await getEmployee(empId, db);
    await assertAdminRemains(db, empId, input);
    const departmentId = await resolveDepartmentId(db, input);
    const { sets, values } = buildUpdate({
      employee_code: input.employeeCode,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      designation: input.designation,
      department_id: departmentId,
      status: input.status,
      joining_date: input.joiningDate,
      location: input.location,
      role: input.role,
      password_hash: input.password && (await hashPassword(input.password)),
      password_changed_at: input.password && new Date(),
    });
    if (!sets.length) throw badRequest("Nothing to update");
    const { rowCount } = await db.query(
      `UPDATE employees SET ${sets.join(", ")}, updated_at = now() WHERE id = $${values.length + 1}`,
      [...values, empId]
    );
    if (!rowCount) throw notFound("Employee");
    return getEmployee(empId, db);
  });
  const changes = diff(before, employee);
  if (input.password) changes.password = { from: "••••", to: "reset by admin" };
  await audit(req, {
    action: changes.role ? "employee.role_change" : "employee.update",
    entityType: "employee",
    entityId: empId,
    summary: changes.role
      ? `Changed ${employee.name}'s role from ${changes.role.from} to ${changes.role.to}`
      : `Updated ${employee.name}`,
    changes,
  });
  res.json({ data: employee });
});

router.delete("/:id", authorize("admin"), async (req, res) => {
  const empId = parse(id, req.params.id);
  if (empId === req.user.id) throw forbidden("You can't delete your own account");
  const employee = await getEmployee(empId);
  // Paid payslips are financial records; deleting the person would erase them.
  const { rows: paid } = await query(
    `SELECT 1 FROM payslips p JOIN payroll_runs r ON r.id = p.run_id
     WHERE p.employee_id = $1 AND r.status = 'Paid' LIMIT 1`,
    [empId]
  );
  if (paid.length) {
    throw new HttpError(
      409,
      `${employee.name} has been paid through payroll, so their record can't be deleted. Set their status to Inactive instead.`
    );
  }
  const { rows: receipts } = await query(
    "SELECT receipt_path FROM reimbursements WHERE employee_id = $1 AND receipt_path IS NOT NULL",
    [empId]
  );
  await query("DELETE FROM employees WHERE id = $1", [empId]);
  for (const r of receipts) await removeReceiptFile(r.receipt_path);
  await audit(req, {
    action: "employee.delete",
    entityType: "employee",
    entityId: empId,
    summary: `Deleted ${employee.name} (${employee.employeeCode})`,
  });
  res.status(204).end();
});

export default router;
