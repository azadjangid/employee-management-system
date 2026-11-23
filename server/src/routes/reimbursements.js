import { Router } from "express";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { query } from "../db/pool.js";
import { parse, id, date, pagination } from "../lib/validate.js";
import { buildUpdate, whereBuilder, paged } from "../lib/sql.js";
import { applyScope, assertCanAccessEmployee, forbidden } from "../lib/access.js";
import { authorize } from "../middleware/authorize.js";
import { notify, notifySafely, approversFor } from "../lib/notify.js";
import { formatAmount } from "../lib/format.js";
import { notFound, badRequest } from "../lib/errors.js";
import {
  handleReceiptUpload,
  verifyUploadedFile,
  receiptFilePath,
  removeReceiptFile,
} from "../lib/uploads.js";

const router = Router();

// Who can do what:
//   admin    - everything, including approving their own requests
//   manager  - see, edit and approve/reject requests from their department (not their own)
//   employee - see, create, edit and cancel their own pending requests

export const CATEGORIES = [
  "Travel",
  "Food",
  "Internet",
  "Equipment",
  "Office Supplies",
  "Medical",
  "Other",
];
export const REIMBURSEMENT_STATUSES = ["Pending", "Approved", "Rejected", "Paid"];
export const PAYMENT_METHODS = ["Bank Transfer", "Cash", "Company Card"];

// Allowed status changes: Pending -> Approved/Rejected, Approved -> Paid.
const TRANSITIONS = {
  Approved: ["Pending"],
  Rejected: ["Pending"],
  Paid: ["Approved"],
};

const SELECT = `
  SELECT r.id,
         r.employee_id AS "employeeId",
         e.employee_code AS "employeeCode",
         trim(e.first_name || ' ' || e.last_name) AS "employeeName",
         d.name AS department,
         r.category,
         r.amount,
         r.expense_date AS date,
         r.description,
         r.status,
         r.payment_method AS "paymentMethod",
         r.receipt,
         r.receipt_path AS "receiptPath",
         r.receipt_mime AS "receiptMime",
         r.receipt_size AS "receiptSize",
         (r.receipt_path IS NOT NULL) AS "hasReceipt",
         r.payroll_run_id AS "payrollRunId",
         r.reviewed_at AS "reviewedAt",
         r.reviewed_by AS "reviewedById",
         trim(rv.first_name || ' ' || rv.last_name) AS "reviewedBy",
         r.created_at AS "createdAt",
         r.updated_at AS "updatedAt"
  FROM reimbursements r
  JOIN employees e ON e.id = r.employee_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN employees rv ON rv.id = r.reviewed_by`;

const fields = z.object({
  // Defaults to the signed-in user. Managers/admins may file for someone in their scope.
  employeeId: id.optional(),
  category: z.enum(CATEGORIES),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(10_000_000),
  date,
  description: z.string().trim().min(1, "Description is required").max(1000),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
});

const listQuery = z.object({
  status: z.enum(REIMBURSEMENT_STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  employeeId: id.optional(),
  department: z.string().trim().optional(),
  search: z.string().trim().optional(),
  from: date.optional(),
  to: date.optional(),
  ...pagination,
});

async function getClaim(claimId, user) {
  const { rows } = await query(`${SELECT} WHERE r.id = $1`, [claimId]);
  if (!rows[0]) throw notFound("Reimbursement");
  if (user) await assertCanAccessEmployee(user, rows[0].employeeId, "Reimbursement");
  return rows[0];
}

/** Filing for someone else needs manager/admin rights over them. */
async function resolveEmployeeId(user, employeeId) {
  if (!employeeId || employeeId === user.id) return user.id;
  if (user.role === "employee") throw forbidden("You can only file requests for yourself");
  await assertCanAccessEmployee(user, employeeId);
  return employeeId;
}

router.get("/", async (req, res) => {
  const q = parse(listQuery, req.query);
  const where = applyScope(whereBuilder(), req.user);
  if (q.status) where.add("r.status = ?", q.status);
  if (q.category) where.add("r.category = ?", q.category);
  if (q.employeeId) where.add("r.employee_id = ?", q.employeeId);
  if (q.department) where.add("lower(d.name) = lower(?)", q.department);
  if (q.from) where.add("r.expense_date >= ?", q.from);
  if (q.to) where.add("r.expense_date <= ?", q.to);
  if (q.search) {
    const p = where.param(`%${q.search}%`);
    where.add(`(e.first_name || ' ' || e.last_name ILIKE ${p} OR r.description ILIKE ${p})`);
  }
  const { rows } = await query(
    `${SELECT.replace("SELECT r.id,", "SELECT count(*) OVER () AS total_count, r.id,")}
     ${where} ORDER BY r.expense_date DESC, r.id DESC
     LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    where.values
  );
  res.json(paged(rows, q.page, q.limit));
});

/** Totals per status, for the summary cards. */
router.get("/summary", async (req, res) => {
  const where = applyScope(whereBuilder(), req.user);
  const { rows } = await query(
    `SELECT r.status, count(*)::int AS count, COALESCE(sum(r.amount), 0)::float AS total
     FROM reimbursements r JOIN employees e ON e.id = r.employee_id
     ${where} GROUP BY r.status`,
    where.values
  );
  const data = Object.fromEntries(
    REIMBURSEMENT_STATUSES.map((s) => [s, { count: 0, total: 0 }])
  );
  for (const r of rows) data[r.status] = { count: r.count, total: r.total };
  res.json({ data });
});

router.get("/:id", async (req, res) => {
  res.json({ data: await getClaim(parse(id, req.params.id), req.user) });
});

router.post("/", async (req, res) => {
  const input = parse(fields, req.body);
  input.employeeId = await resolveEmployeeId(req.user, input.employeeId);
  const { rows } = await query(
    `INSERT INTO reimbursements
       (employee_id, category, amount, expense_date, description, payment_method)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      input.employeeId,
      input.category,
      input.amount,
      input.date,
      input.description,
      input.paymentMethod ?? "Bank Transfer",
    ]
  );
  const claim = await getClaim(rows[0].id);
  await notifySafely(async () =>
    notify(
      await approversFor(claim.employeeId),
      {
        title: "New reimbursement claim",
        body: `${claim.employeeName} submitted a ${formatAmount(claim.amount)} ${claim.category} claim.`,
        link: "/reimbursements",
      },
      { exclude: req.user.id }
    )
  );
  await audit(req, {
    action: "reimbursement.create",
    entityType: "reimbursement",
    entityId: claim.id,
    summary: `${claim.employeeName} submitted a ${formatAmount(claim.amount)} ${claim.category} claim`,
  });
  res.status(201).json({ data: claim });
});

router.put("/:id", async (req, res) => {
  const claimId = parse(id, req.params.id);
  const input = parse(fields.partial(), req.body);
  const current = await getClaim(claimId, req.user);
  if (current.status !== "Pending") {
    throw badRequest("Only pending reimbursements can be edited");
  }
  if (input.employeeId !== undefined) {
    input.employeeId = await resolveEmployeeId(req.user, input.employeeId);
  }
  const { sets, values } = buildUpdate({
    employee_id: input.employeeId,
    category: input.category,
    amount: input.amount,
    expense_date: input.date,
    description: input.description,
    payment_method: input.paymentMethod,
  });
  if (!sets.length) throw badRequest("Nothing to update");
  await query(
    `UPDATE reimbursements SET ${sets.join(", ")}, updated_at = now() WHERE id = $${values.length + 1}`,
    [...values, claimId]
  );
  res.json({ data: await getClaim(claimId) });
});

/** Approve, reject or mark as paid. */
router.patch("/:id/status", authorize("admin", "manager"), async (req, res) => {
  const claimId = parse(id, req.params.id);
  const { status } = parse(
    z.object({ status: z.enum(["Approved", "Rejected", "Paid"]) }),
    req.body
  );
  const current = await getClaim(claimId, req.user);
  if (status === "Paid" && req.user.role !== "admin") {
    throw forbidden("Only admins can mark a reimbursement as paid");
  }
  if (current.employeeId === req.user.id && req.user.role !== "admin") {
    throw forbidden("You can't approve or reject your own reimbursement");
  }
  const decided = status !== "Paid";
  const { rowCount } = await query(
    `UPDATE reimbursements
     SET status = $1, updated_at = now()
         ${decided ? ", reviewed_at = now(), reviewed_by = $4" : ""}
     WHERE id = $2 AND status = ANY($3)`,
    decided ? [status, claimId, TRANSITIONS[status], req.user.id] : [status, claimId, TRANSITIONS[status]]
  );
  if (!rowCount) throw badRequest(`Cannot change status from ${current.status} to ${status}`);
  const claim = await getClaim(claimId);
  await notifySafely(() =>
    notify(
      [claim.employeeId],
      {
        title: status === "Paid" ? "Reimbursement paid" : `Reimbursement ${status.toLowerCase()}`,
        body:
          status === "Paid"
            ? `Your ${formatAmount(claim.amount)} ${claim.category} claim has been paid.`
            : `Your ${formatAmount(claim.amount)} ${claim.category} claim was ${status.toLowerCase()} by ${claim.reviewedBy}.`,
        link: "/reimbursements",
      },
      { exclude: req.user.id }
    )
  );
  await audit(req, {
    action: `reimbursement.${status.toLowerCase()}`,
    entityType: "reimbursement",
    entityId: claim.id,
    summary: `${status === "Paid" ? "Paid" : status} ${claim.employeeName}'s ${formatAmount(claim.amount)} ${claim.category} claim`,
  });
  res.json({ data: claim });
});

/** Cancel a claim. Only admins can remove one that has already been decided. */
router.delete("/:id", async (req, res) => {
  const claimId = parse(id, req.params.id);
  const current = await getClaim(claimId, req.user);
  if (current.status !== "Pending" && req.user.role !== "admin") {
    throw badRequest("Only pending reimbursements can be cancelled");
  }
  await query("DELETE FROM reimbursements WHERE id = $1", [claimId]);
  await removeReceiptFile(current.receiptPath);
  await audit(req, {
    action: "reimbursement.delete",
    entityType: "reimbursement",
    entityId: claimId,
    summary: `Deleted ${current.employeeName}'s ${formatAmount(current.amount)} ${current.category} claim`,
  });
  res.status(204).end();
});

// ---- Receipts -------------------------------------------------------------

/** Who may attach or remove a receipt: the claimant or an approver, while pending (admins always). */
function assertCanChangeReceipt(user, claim) {
  if (user.role === "admin") return;
  if (claim.status !== "Pending") {
    throw badRequest("Receipts can only be changed while the claim is pending");
  }
}

/** Upload (or replace) the receipt. multipart/form-data with a "receipt" file field. */
router.post("/:id/receipt", async (req, res, next) => {
  const claimId = parse(id, req.params.id);
  // Check access before accepting the file.
  const claim = await getClaim(claimId, req.user);
  assertCanChangeReceipt(req.user, claim);
  req.claim = claim;
  next();
}, handleReceiptUpload, async (req, res) => {
  if (!req.file) throw badRequest("Choose a file to upload");
  await verifyUploadedFile(req.file);
  const claim = req.claim;
  await query(
    `UPDATE reimbursements
     SET receipt = $1, receipt_path = $2, receipt_mime = $3, receipt_size = $4, updated_at = now()
     WHERE id = $5`,
    [req.file.originalname.slice(0, 255), req.file.filename, req.file.mimetype, req.file.size, claim.id]
  );
  await removeReceiptFile(claim.receiptPath);
  await audit(req, {
    action: "reimbursement.receipt_upload",
    entityType: "reimbursement",
    entityId: claim.id,
    summary: `Attached receipt "${req.file.originalname}" to ${claim.employeeName}'s claim`,
  });
  res.json({ data: await getClaim(claim.id) });
});

/** Download / view the receipt. */
router.get("/:id/receipt", async (req, res) => {
  const claim = await getClaim(parse(id, req.params.id), req.user);
  if (!claim.receiptPath) throw notFound("Receipt");
  // Header-safe ASCII version of the original file name.
  const safeName = (claim.receipt || "receipt").replace(/[^\w.\- ()]/g, "_");
  res.set({
    "Content-Type": claim.receiptMime,
    "Content-Disposition": `${req.query.download ? "attachment" : "inline"}; filename="${safeName}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  });
  res.sendFile(receiptFilePath(claim.receiptPath), (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: { message: "Receipt file is missing" } });
  });
});

router.delete("/:id/receipt", async (req, res) => {
  const claim = await getClaim(parse(id, req.params.id), req.user);
  assertCanChangeReceipt(req.user, claim);
  if (!claim.receiptPath) throw notFound("Receipt");
  await query(
    `UPDATE reimbursements
     SET receipt = NULL, receipt_path = NULL, receipt_mime = NULL, receipt_size = NULL, updated_at = now()
     WHERE id = $1`,
    [claim.id]
  );
  await removeReceiptFile(claim.receiptPath);
  await audit(req, {
    action: "reimbursement.receipt_delete",
    entityType: "reimbursement",
    entityId: claim.id,
    summary: `Removed the receipt from ${claim.employeeName}'s claim`,
  });
  res.json({ data: await getClaim(claim.id) });
});

export default router;
