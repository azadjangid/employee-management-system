import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { parse } from "../lib/validate.js";
import { whereBuilder } from "../lib/sql.js";
import { applyScope } from "../lib/access.js";

const router = Router();

const LIMIT = 5;

/**
 * Quick search for the top bar. Looks through employees (admins/managers only),
 * leave requests and reimbursements the user can see.
 */
router.get("/", async (req, res) => {
  const { q } = parse(z.object({ q: z.string().trim().min(1, "Type something to search").max(100) }), req.query);
  const like = `%${q}%`;
  const user = req.user;

  const scoped = () => applyScope(whereBuilder(), user);
  const and = (w) => (String(w) ? `${w} AND` : "WHERE");

  const ew = scoped();
  const ep = ew.param(like);
  const employees =
    user.role === "employee"
      ? { rows: [] }
      : query(
          `SELECT e.id, trim(e.first_name || ' ' || e.last_name) AS name, e.employee_code AS "employeeCode",
                  e.designation, d.name AS department
           FROM employees e LEFT JOIN departments d ON d.id = e.department_id
           ${and(ew)} (e.first_name || ' ' || e.last_name ILIKE ${ep} OR e.email ILIKE ${ep}
                       OR e.employee_code ILIKE ${ep} OR e.designation ILIKE ${ep})
           ORDER BY e.first_name, e.last_name LIMIT ${LIMIT}`,
          ew.values
        );

  const lw = scoped();
  const lp = lw.param(like);
  const leaves = query(
    `SELECT l.id, trim(e.first_name || ' ' || e.last_name) AS "employeeName", l.leave_type AS "leaveType",
            l.from_date AS "fromDate", l.to_date AS "toDate", l.status
     FROM leaves l JOIN employees e ON e.id = l.employee_id
     ${and(lw)} (e.first_name || ' ' || e.last_name ILIKE ${lp} OR l.reason ILIKE ${lp} OR l.leave_type ILIKE ${lp})
     ORDER BY l.applied_on DESC LIMIT ${LIMIT}`,
    lw.values
  );

  const rw = scoped();
  const rp = rw.param(like);
  const reimbursements = query(
    `SELECT r.id, trim(e.first_name || ' ' || e.last_name) AS "employeeName", r.category, r.amount,
            r.description, r.status
     FROM reimbursements r JOIN employees e ON e.id = r.employee_id
     ${and(rw)} (e.first_name || ' ' || e.last_name ILIKE ${rp} OR r.description ILIKE ${rp} OR r.category ILIKE ${rp})
     ORDER BY r.expense_date DESC LIMIT ${LIMIT}`,
    rw.values
  );

  const [e, l, r] = await Promise.all([employees, leaves, reimbursements]);
  res.json({ data: { employees: e.rows, leaves: l.rows, reimbursements: r.rows } });
});

export default router;
