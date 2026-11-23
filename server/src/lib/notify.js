import { query } from "../db/pool.js";

/** Send one notification to each recipient id (duplicates and the actor are skipped). */
export async function notify(recipientIds, { title, body = null, link = null }, { exclude } = {}) {
  const ids = [...new Set(recipientIds)].filter((id) => id && id !== exclude);
  if (!ids.length) return;
  await query(
    `INSERT INTO notifications (recipient_id, title, body, link)
     SELECT unnest($1::int[]), $2, $3, $4`,
    [ids, title, body, link]
  );
}

/** Admins plus the managers of an employee's department: the people who can approve for them. */
export async function approversFor(employeeId) {
  const { rows } = await query(
    `SELECT a.id FROM employees a
     WHERE a.status <> 'Inactive'
       AND (a.role = 'admin'
            OR (a.role = 'manager' AND a.department_id IS NOT NULL
                AND a.department_id = (SELECT department_id FROM employees WHERE id = $1)))`,
    [employeeId]
  );
  return rows.map((r) => r.id);
}

/** A failed notification must never fail the request that triggered it. */
export async function notifySafely(fn) {
  try {
    await fn();
  } catch (err) {
    console.error("Notification failed:", err.message);
  }
}
