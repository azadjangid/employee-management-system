import { Router } from "express";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { query } from "../db/pool.js";
import { parse, id, date, pagination } from "../lib/validate.js";
import { buildUpdate, whereBuilder, paged } from "../lib/sql.js";
import { applyScope, assertCanAccessEmployee, forbidden } from "../lib/access.js";
import { authorize } from "../middleware/authorize.js";
import { notify, notifySafely, approversFor } from "../lib/notify.js";
import { describeRange } from "../lib/format.js";
import { notFound, badRequest, HttpError } from "../lib/errors.js";

const router = Router();

// Who can do what:
//   admin    - everything, including approving their own requests
//   manager  - see, edit and approve/reject requests from their department (not their own)
//   employee - see, create, edit and cancel their own pending requests

export const LEAVE_TYPES = ["Casual Leave", "Sick Leave", "Earned Leave"];
export const LEAVE_STATUSES = ["Pending", "Approved", "Rejected"];

const SELECT = `
  SELECT l.id,
         l.employee_id AS "employeeId",
         e.employee_code AS "employeeCode",
         trim(e.first_name || ' ' || e.last_name) AS "employeeName",
         d.name AS department,
         l.leave_type AS "leaveType",
         l.from_date AS "fromDate",
         l.to_date AS "toDate",
         l.days,
         l.reason,
         l.status,
         l.applied_on AS "appliedOn",
         l.reviewed_at AS "reviewedAt",
         l.reviewed_by AS "reviewedById",
         trim(rv.first_name || ' ' || rv.last_name) AS "reviewedBy",
         l.created_at AS "createdAt",
         l.updated_at AS "updatedAt"
  FROM leaves l
  JOIN employees e ON e.id = l.employee_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN employees rv ON rv.id = l.reviewed_by`;

const fields = z.object({
  // Defaults to the signed-in user. Managers/admins may file for someone in their scope.
  employeeId: id.optional(),
  leaveType: z.enum(LEAVE_TYPES),
  fromDate: date,
  toDate: date,
  reason: z.string().trim().min(1, "Reason is required").max(1000),
});

const datesInOrder = (b) => !b.fromDate || !b.toDate || b.toDate >= b.fromDate;
const dateMsg = { message: "To date must be on or after from date", path: ["toDate"] };

const listQuery = z.object({
  status: z.enum(LEAVE_STATUSES).optional(),
  leaveType: z.enum(LEAVE_TYPES).optional(),
  employeeId: id.optional(),
  department: z.string().trim().optional(),
  search: z.string().trim().optional(),
  from: date.optional(),
  to: date.optional(),
  ...pagination,
});

async function getLeave(leaveId, user) {
  const { rows } = await query(`${SELECT} WHERE l.id = $1`, [leaveId]);
  if (!rows[0]) throw notFound("Leave request");
  if (user) await assertCanAccessEmployee(user, rows[0].employeeId, "Leave request");
  return rows[0];
}

/** Filing for someone else needs manager/admin rights over them. */
async function resolveEmployeeId(user, employeeId) {
  if (!employeeId || employeeId === user.id) return user.id;
  if (user.role === "employee") throw forbidden("You can only file requests for yourself");
  await assertCanAccessEmployee(user, employeeId);
  return employeeId;
}

/** Reject a request that overlaps another pending/approved leave of the same employee. */
async function assertNoOverlap({ employeeId, fromDate, toDate }, excludeId = 0) {
  const { rows } = await query(
    `SELECT id FROM leaves
     WHERE employee_id = $1 AND status <> 'Rejected' AND id <> $4
       AND from_date <= $3 AND to_date >= $2 LIMIT 1`,
    [employeeId, fromDate, toDate, excludeId]
  );
  if (rows[0]) throw new HttpError(409, "These dates overlap another leave request");
}

router.get("/", async (req, res) => {
  const q = parse(listQuery, req.query);
  const where = applyScope(whereBuilder(), req.user);
  if (q.status) where.add("l.status = ?", q.status);
  if (q.leaveType) where.add("l.leave_type = ?", q.leaveType);
  if (q.employeeId) where.add("l.employee_id = ?", q.employeeId);
  if (q.department) where.add("lower(d.name) = lower(?)", q.department);
  if (q.from) where.add("l.to_date >= ?", q.from);
  if (q.to) where.add("l.from_date <= ?", q.to);
  if (q.search) {
    const p = where.param(`%${q.search}%`);
    where.add(
      `(e.first_name || ' ' || e.last_name ILIKE ${p} OR l.reason ILIKE ${p} OR d.name ILIKE ${p})`
    );
  }
  const { rows } = await query(
    `${SELECT.replace("SELECT l.id,", "SELECT count(*) OVER () AS total_count, l.id,")}
     ${where} ORDER BY l.applied_on DESC, l.id DESC
     LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    where.values
  );
  res.json(paged(rows, q.page, q.limit));
});

/** Count per status, for the summary cards. */
router.get("/summary", async (req, res) => {
  const where = applyScope(whereBuilder(), req.user);
  const { rows } = await query(
    `SELECT l.status, count(*)::int AS count, COALESCE(sum(l.days), 0)::int AS days
     FROM leaves l JOIN employees e ON e.id = l.employee_id
     ${where} GROUP BY l.status`,
    where.values
  );
  const data = Object.fromEntries(LEAVE_STATUSES.map((s) => [s, { count: 0, days: 0 }]));
  for (const r of rows) data[r.status] = { count: r.count, days: r.days };
  res.json({ data });
});

router.get("/:id", async (req, res) => {
  res.json({ data: await getLeave(parse(id, req.params.id), req.user) });
});

router.post("/", async (req, res) => {
  const input = parse(fields.refine(datesInOrder, dateMsg), req.body);
  input.employeeId = await resolveEmployeeId(req.user, input.employeeId);
  await assertNoOverlap(input);
  const { rows } = await query(
    `INSERT INTO leaves (employee_id, leave_type, from_date, to_date, reason)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.employeeId, input.leaveType, input.fromDate, input.toDate, input.reason]
  );
  const leave = await getLeave(rows[0].id);
  await notifySafely(async () =>
    notify(
      await approversFor(leave.employeeId),
      {
        title: "New leave request",
        body: `${leave.employeeName} requested ${leave.days} day(s) of ${leave.leaveType} (${describeRange(leave.fromDate, leave.toDate)}).`,
        link: "/leaves",
      },
      { exclude: req.user.id }
    )
  );
  await audit(req, {
    action: "leave.create",
    entityType: "leave",
    entityId: leave.id,
    summary: `${leave.employeeName} requested ${leave.days} day(s) of ${leave.leaveType}`,
  });
  res.status(201).json({ data: leave });
});

router.put("/:id", async (req, res) => {
  const leaveId = parse(id, req.params.id);
  const input = parse(fields.partial().refine(datesInOrder, dateMsg), req.body);
  const current = await getLeave(leaveId, req.user);
  if (current.status !== "Pending") {
    throw badRequest("Only pending leave requests can be edited");
  }
  if (input.employeeId !== undefined) {
    input.employeeId = await resolveEmployeeId(req.user, input.employeeId);
  }
  const merged = { ...current, ...input };
  if (merged.toDate < merged.fromDate) throw badRequest(dateMsg.message);
  await assertNoOverlap(merged, leaveId);
  const { sets, values } = buildUpdate({
    employee_id: input.employeeId,
    leave_type: input.leaveType,
    from_date: input.fromDate,
    to_date: input.toDate,
    reason: input.reason,
  });
  if (!sets.length) throw badRequest("Nothing to update");
  await query(
    `UPDATE leaves SET ${sets.join(", ")}, updated_at = now() WHERE id = $${values.length + 1}`,
    [...values, leaveId]
  );
  res.json({ data: await getLeave(leaveId) });
});

/** Approve or reject a pending request. */
router.patch("/:id/status", authorize("admin", "manager"), async (req, res) => {
  const leaveId = parse(id, req.params.id);
  const { status } = parse(z.object({ status: z.enum(["Approved", "Rejected"]) }), req.body);
  const current = await getLeave(leaveId, req.user);
  if (current.employeeId === req.user.id && req.user.role !== "admin") {
    throw forbidden("You can't approve or reject your own leave");
  }
  const { rowCount } = await query(
    `UPDATE leaves SET status = $1, reviewed_at = now(), reviewed_by = $3, updated_at = now()
     WHERE id = $2 AND status = 'Pending'`,
    [status, leaveId, req.user.id]
  );
  if (!rowCount) throw badRequest("Only pending leave requests can be approved or rejected");
  const leave = await getLeave(leaveId);
  await notifySafely(() =>
    notify(
      [leave.employeeId],
      {
        title: `Leave ${status.toLowerCase()}`,
        body: `Your ${leave.leaveType} (${describeRange(leave.fromDate, leave.toDate)}) was ${status.toLowerCase()} by ${leave.reviewedBy}.`,
        link: "/leaves",
      },
      { exclude: req.user.id }
    )
  );
  await audit(req, {
    action: status === "Approved" ? "leave.approve" : "leave.reject",
    entityType: "leave",
    entityId: leave.id,
    summary: `${status} ${leave.employeeName}'s ${leave.leaveType} (${leave.days} day(s))`,
  });
  res.json({ data: leave });
});

/** Cancel a request. Only admins can remove one that has already been decided. */
router.delete("/:id", async (req, res) => {
  const leaveId = parse(id, req.params.id);
  const current = await getLeave(leaveId, req.user);
  if (current.status !== "Pending" && req.user.role !== "admin") {
    throw badRequest("Only pending leave requests can be cancelled");
  }
  await query("DELETE FROM leaves WHERE id = $1", [leaveId]);
  await audit(req, {
    action: "leave.delete",
    entityType: "leave",
    entityId: leaveId,
    summary: `Cancelled ${current.employeeName}'s ${current.leaveType} request`,
  });
  res.status(204).end();
});

export default router;
