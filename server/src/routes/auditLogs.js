import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { parse, id, date, pagination } from "../lib/validate.js";
import { whereBuilder, paged } from "../lib/sql.js";

const router = Router();

const listQuery = z.object({
  search: z.string().trim().optional(),
  actorId: id.optional(),
  entityType: z.string().trim().optional(),
  // Matches the action prefix, e.g. "leave" or "leave.approve".
  action: z.string().trim().optional(),
  from: date.optional(),
  to: date.optional(),
  ...pagination,
});

/** Admin-only (mounted behind authorize("admin")). Newest first. */
router.get("/", async (req, res) => {
  const q = parse(listQuery, req.query);
  const where = whereBuilder();
  if (q.actorId) where.add("a.actor_id = ?", q.actorId);
  if (q.entityType) where.add("a.entity_type = ?", q.entityType);
  if (q.action) where.add("(a.action = ? OR a.action LIKE ?)", q.action, `${q.action}.%`);
  if (q.from) where.add("a.created_at >= ?::date", q.from);
  if (q.to) where.add("a.created_at < ?::date + 1", q.to);
  if (q.search) {
    const p = where.param(`%${q.search}%`);
    where.add(`(a.summary ILIKE ${p} OR a.actor_name ILIKE ${p} OR a.action ILIKE ${p})`);
  }
  const { rows } = await query(
    `SELECT count(*) OVER () AS total_count,
            a.id::int AS id, a.actor_id AS "actorId",
            COALESCE(trim(e.first_name || ' ' || e.last_name), a.actor_name) AS "actorName",
            a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
            a.summary, a.changes, a.ip, a.created_at AS "createdAt"
     FROM audit_logs a
     LEFT JOIN employees e ON e.id = a.actor_id
     ${where}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    where.values
  );
  res.json(paged(rows, q.page, q.limit));
});

/** Distinct entity types and actions, for the filter dropdowns. */
router.get("/facets", async (req, res) => {
  const { rows } = await query(
    "SELECT DISTINCT entity_type AS \"entityType\", action FROM audit_logs ORDER BY 1, 2"
  );
  res.json({
    data: {
      entityTypes: [...new Set(rows.map((r) => r.entityType))],
      actions: [...new Set(rows.map((r) => r.action))],
      // [{ entityType, action }] so the UI can narrow actions to the chosen area.
      pairs: rows,
    },
  });
});

export default router;
