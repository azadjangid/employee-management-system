import { Router } from "express";
import { z } from "zod";
import { audit, diff } from "../lib/audit.js";
import { query } from "../db/pool.js";
import { parse, id, date, time, pagination } from "../lib/validate.js";
import { buildUpdate, whereBuilder, paged } from "../lib/sql.js";
import { notFound, badRequest, HttpError } from "../lib/errors.js";
import { applyScope, assertCanAccessEmployee } from "../lib/access.js";
import { authorize } from "../middleware/authorize.js";

const router = Router();

// Who can do what:
//   admin    - everything
//   manager  - view and record attendance for their department
//   employee - view their own records, check in / check out

export const ATTENDANCE_STATUSES = ["Present", "Late", "Absent", "Half Day"];

const SELECT = `
  SELECT a.id,
         a.employee_id AS "employeeId",
         e.employee_code AS "employeeCode",
         trim(e.first_name || ' ' || e.last_name) AS name,
         d.name AS department,
         a.date,
         to_char(a.check_in, 'HH24:MI') AS "checkIn",
         to_char(a.check_out, 'HH24:MI') AS "checkOut",
         round(extract(epoch FROM (a.check_out - a.check_in)) / 3600.0, 2)::float AS "workHours",
         a.status,
         a.created_at AS "createdAt",
         a.updated_at AS "updatedAt"
  FROM attendance a
  JOIN employees e ON e.id = a.employee_id
  LEFT JOIN departments d ON d.id = e.department_id`;

const fields = z.object({
  employeeId: id,
  date,
  checkIn: time.optional(),
  checkOut: time.optional(),
  status: z.enum(ATTENDANCE_STATUSES),
});

const listQuery = z.object({
  date: date.optional(),
  from: date.optional(),
  to: date.optional(),
  employeeId: id.optional(),
  departmentId: id.optional(),
  department: z.string().trim().optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  search: z.string().trim().optional(),
  ...pagination,
});

async function getRecord(recordId, user) {
  const { rows } = await query(`${SELECT} WHERE a.id = $1`, [recordId]);
  if (!rows[0]) throw notFound("Attendance record");
  if (user) await assertCanAccessEmployee(user, rows[0].employeeId, "Attendance record");
  return rows[0];
}

const DUPLICATE = "Attendance for this employee and date already exists";
const onDuplicate = (err) => {
  if (err.code === "23505") throw new HttpError(409, DUPLICATE);
  throw err;
};

router.get("/", async (req, res) => {
  const q = parse(listQuery, req.query);
  const where = applyScope(whereBuilder(), req.user);
  if (q.date) where.add("a.date = ?", q.date);
  if (q.from) where.add("a.date >= ?", q.from);
  if (q.to) where.add("a.date <= ?", q.to);
  if (q.employeeId) where.add("a.employee_id = ?", q.employeeId);
  if (q.departmentId) where.add("e.department_id = ?", q.departmentId);
  if (q.department) where.add("lower(d.name) = lower(?)", q.department);
  if (q.status) where.add("a.status = ?", q.status);
  if (q.search) {
    const p = where.param(`%${q.search}%`);
    where.add(`(e.first_name || ' ' || e.last_name ILIKE ${p} OR e.employee_code ILIKE ${p})`);
  }
  const { rows } = await query(
    `${SELECT.replace("SELECT a.id,", "SELECT count(*) OVER () AS total_count, a.id,")}
     ${where} ORDER BY a.date DESC, e.first_name, a.id
     LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    where.values
  );
  res.json(paged(rows, q.page, q.limit));
});

/** Counts per status for a given day (defaults to today). */
router.get("/summary", async (req, res) => {
  const q = parse(z.object({ date: date.optional() }), req.query);
  const where = applyScope(whereBuilder(), req.user);
  where.add("a.date = COALESCE(?::date, CURRENT_DATE)", q.date ?? null);
  const { rows } = await query(
    `SELECT a.status, count(*)::int AS count
     FROM attendance a JOIN employees e ON e.id = a.employee_id
     ${where} GROUP BY a.status`,
    where.values
  );
  const summary = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0]));
  for (const r of rows) summary[r.status] = r.count;
  res.json({ data: { date: q.date ?? null, ...summary } });
});

/** Today's record for the signed-in user (null if not checked in yet). */
router.get("/today", async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE a.employee_id = $1 AND a.date = CURRENT_DATE`, [
    req.user.id,
  ]);
  res.json({ data: rows[0] ?? null });
});

// Arriving after this time counts as late.
const LATE_AFTER = "09:15";

router.post("/check-in", async (req, res) => {
  const { rows } = await query(
    `INSERT INTO attendance (employee_id, date, check_in, status)
     VALUES ($1, CURRENT_DATE, LOCALTIME(0),
             CASE WHEN LOCALTIME > $2::time THEN 'Late' ELSE 'Present' END)
     RETURNING id`,
    [req.user.id, LATE_AFTER]
  ).catch((err) => {
    if (err.code === "23505") throw new HttpError(409, "You have already checked in today");
    throw err;
  });
  res.status(201).json({ data: await getRecord(rows[0].id) });
});

router.post("/check-out", async (req, res) => {
  const { rows } = await query(
    `UPDATE attendance SET check_out = LOCALTIME(0), updated_at = now()
     WHERE employee_id = $1 AND date = CURRENT_DATE AND check_in IS NOT NULL
       AND check_out IS NULL
     RETURNING id`,
    [req.user.id]
  );
  if (!rows[0]) throw badRequest("Check in first (or you have already checked out today)");
  res.json({ data: await getRecord(rows[0].id) });
});

router.get("/:id", async (req, res) => {
  res.json({ data: await getRecord(parse(id, req.params.id), req.user) });
});

// Recording / correcting attendance by hand is for managers and admins.
router.post("/", authorize("admin", "manager"), async (req, res) => {
  const input = parse(fields, req.body);
  await assertCanAccessEmployee(req.user, input.employeeId);
  if (input.status === "Absent") input.checkIn = input.checkOut = null;
  const { rows } = await query(
    `INSERT INTO attendance (employee_id, date, check_in, check_out, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.employeeId, input.date, input.checkIn ?? null, input.checkOut ?? null, input.status]
  ).catch(onDuplicate);
  const record = await getRecord(rows[0].id);
  await audit(req, {
    action: "attendance.create",
    entityType: "attendance",
    entityId: record.id,
    summary: `Marked ${record.name} ${record.status} on ${record.date}`,
  });
  res.status(201).json({ data: record });
});

router.put("/:id", authorize("admin", "manager"), async (req, res) => {
  const recordId = parse(id, req.params.id);
  const input = parse(fields.partial(), req.body);
  const before = await getRecord(recordId, req.user);
  if (input.employeeId) await assertCanAccessEmployee(req.user, input.employeeId);
  if (input.status === "Absent") input.checkIn = input.checkOut = null;
  const { sets, values } = buildUpdate({
    employee_id: input.employeeId,
    date: input.date,
    check_in: input.checkIn,
    check_out: input.checkOut,
    status: input.status,
  });
  if (!sets.length) throw badRequest("Nothing to update");
  const { rowCount } = await query(
    `UPDATE attendance SET ${sets.join(", ")}, updated_at = now() WHERE id = $${values.length + 1}`,
    [...values, recordId]
  ).catch(onDuplicate);
  if (!rowCount) throw notFound("Attendance record");
  const record = await getRecord(recordId);
  await audit(req, {
    action: "attendance.update",
    entityType: "attendance",
    entityId: recordId,
    summary: `Corrected attendance for ${record.name} on ${record.date}`,
    changes: diff(
      { status: before.status, checkIn: before.checkIn, checkOut: before.checkOut, date: before.date },
      { status: record.status, checkIn: record.checkIn, checkOut: record.checkOut, date: record.date }
    ),
  });
  res.json({ data: record });
});

router.delete("/:id", authorize("admin", "manager"), async (req, res) => {
  const recordId = parse(id, req.params.id);
  const record = await getRecord(recordId, req.user);
  await query("DELETE FROM attendance WHERE id = $1", [recordId]);
  await audit(req, {
    action: "attendance.delete",
    entityType: "attendance",
    entityId: recordId,
    summary: `Deleted attendance for ${record.name} on ${record.date}`,
  });
  res.status(204).end();
});

export default router;
