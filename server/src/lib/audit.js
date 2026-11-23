import { query } from "../db/pool.js";

/**
 * Record an action in the audit log. Never throws: a logging problem must not
 * break the request that triggered it.
 *
 *   await audit(req, {
 *     action: "employee.update", entityType: "employee", entityId: 7,
 *     summary: "Updated Priya Mehta", changes: diff(before, after),
 *   });
 *
 * `actor` defaults to req.user; pass it explicitly for logins (no req.user yet).
 */
export async function audit(req, { action, entityType, entityId = null, summary, changes = null, actor }) {
  const who = actor ?? req.user ?? null;
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, summary, changes, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        who?.id ?? null,
        who?.name ?? null,
        action,
        entityType,
        entityId,
        summary,
        changes && Object.keys(changes).length ? JSON.stringify(changes) : null,
        req.ip ?? null,
      ]
    );
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}

const HIDDEN = new Set(["passwordHash", "password", "updatedAt", "createdAt"]);

/** { field: { from, to } } for every field that changed between two records. */
export function diff(before, after) {
  const changes = {};
  for (const key of Object.keys(after ?? {})) {
    if (HIDDEN.has(key)) continue;
    const a = before?.[key] ?? null;
    const b = after[key] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[key] = { from: a, to: b };
  }
  return changes;
}
