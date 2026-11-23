import { Router } from "express";
import { query } from "../db/pool.js";
import { whereBuilder } from "../lib/sql.js";
import { applyScope, scopeOf } from "../lib/access.js";
import { EMPLOYEE_SELECT } from "./employees.js";

const router = Router();

/**
 * Everything the Dashboard page needs in one request, limited to what the
 * user can see: the whole company (admin), their department (manager) or
 * just themselves (employee). `scope` in the response says which.
 */
router.get("/", async (req, res) => {
  const user = req.user;
  const scope = scopeOf(user);
  const scopeName = scope.all ? "company" : scope.departmentId ? "department" : "self";

  // Each query gets its own builder because parameter numbering is per query.
  const scoped = () => applyScope(whereBuilder(), user);
  const and = (where) => (String(where) ? `${where} AND` : "WHERE");

  const s = scoped();
  const empFilter = s.toString().replace(/^WHERE /, "") || "TRUE";

  const w = scoped();
  const d = scoped();
  const r = scoped();
  const l = scoped();

  const [stats, weekly, departments, recentEmployees, pendingLeaves] = await Promise.all([
    query(
      `
      WITH scoped AS (SELECT e.* FROM employees e WHERE ${empFilter})
      SELECT
        (SELECT count(*)::int FROM scoped WHERE status <> 'Inactive') AS "totalEmployees",
        (SELECT count(*)::int FROM scoped
           WHERE status <> 'Inactive' AND created_at < date_trunc('month', now())) AS "employeesLastMonth",
        (SELECT count(*)::int FROM attendance a JOIN scoped ON scoped.id = a.employee_id
           WHERE a.date = CURRENT_DATE AND a.status IN ('Present', 'Late', 'Half Day')) AS "presentToday",
        (SELECT count(*)::int FROM attendance a JOIN scoped ON scoped.id = a.employee_id
           WHERE a.date = CURRENT_DATE - 1 AND a.status IN ('Present', 'Late', 'Half Day')) AS "presentYesterday",
        (SELECT count(DISTINCT l.employee_id)::int FROM leaves l JOIN scoped ON scoped.id = l.employee_id
           WHERE l.status = 'Approved' AND CURRENT_DATE BETWEEN l.from_date AND l.to_date) AS "onLeaveToday",
        (SELECT count(*)::int FROM leaves l JOIN scoped ON scoped.id = l.employee_id
           WHERE l.status = 'Pending') AS "pendingLeaves",
        (SELECT count(*)::int FROM reimbursements r JOIN scoped ON scoped.id = r.employee_id
           WHERE r.status = 'Pending') AS "pendingReimbursements",
        (SELECT COALESCE(sum(r.amount), 0)::float FROM reimbursements r JOIN scoped ON scoped.id = r.employee_id
           WHERE r.status = 'Pending') AS "pendingReimbursementAmount"
      `,
      s.values
    ),
    // Last 7 days of attendance, one row per day even when there is no data.
    query(
      `
      SELECT to_char(g.d, 'Dy') AS day, g.d::date AS date,
             count(x.id) FILTER (WHERE x.status IN ('Present', 'Late', 'Half Day'))::int AS present,
             count(x.id) FILTER (WHERE x.status = 'Absent')::int AS absent
      FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day') AS g(d)
      LEFT JOIN (
        SELECT a.id, a.date, a.status FROM attendance a
        JOIN employees e ON e.id = a.employee_id ${w}
      ) x ON x.date = g.d::date
      GROUP BY g.d ORDER BY g.d
      `,
      w.values
    ),
    query(
      `
      SELECT dp.name, count(e.id)::int AS value
      FROM departments dp JOIN employees e ON e.department_id = dp.id
      ${and(d)} e.status <> 'Inactive'
      GROUP BY dp.id ORDER BY value DESC, dp.name
      `,
      d.values
    ),
    query(`${EMPLOYEE_SELECT} ${r} ORDER BY e.created_at DESC, e.id DESC LIMIT 5`, r.values),
    query(
      `
      SELECT lv.id, lv.employee_id AS "employeeId",
             trim(e.first_name || ' ' || e.last_name) AS name,
             lv.leave_type AS type, lv.from_date AS "fromDate", lv.to_date AS "toDate", lv.days
      FROM leaves lv JOIN employees e ON e.id = lv.employee_id
      ${and(l)} lv.status = 'Pending'
      ORDER BY lv.applied_on, lv.id LIMIT 5
      `,
      l.values
    ),
  ]);

  res.json({
    data: {
      scope: scopeName,
      stats: stats.rows[0],
      weeklyAttendance: weekly.rows,
      departmentDistribution: departments.rows,
      recentEmployees: scopeName === "self" ? [] : recentEmployees.rows,
      pendingLeaves: pendingLeaves.rows,
    },
  });
});

export default router;
