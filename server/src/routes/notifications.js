import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { parse, id } from "../lib/validate.js";
import { notFound } from "../lib/errors.js";

const router = Router();

const SELECT = `
  SELECT id, title, body, link, read_at AS "readAt", created_at AS "createdAt"
  FROM notifications`;

/** Latest notifications for the signed-in user, plus the unread count. */
router.get("/", async (req, res) => {
  const q = parse(
    z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }),
    req.query
  );
  const [list, unread] = await Promise.all([
    query(`${SELECT} WHERE recipient_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`, [
      req.user.id,
      q.limit,
    ]),
    query(
      "SELECT count(*)::int AS n FROM notifications WHERE recipient_id = $1 AND read_at IS NULL",
      [req.user.id]
    ),
  ]);
  res.json({ data: list.rows, meta: { unread: unread.rows[0].n } });
});

router.post("/read-all", async (req, res) => {
  await query(
    "UPDATE notifications SET read_at = now() WHERE recipient_id = $1 AND read_at IS NULL",
    [req.user.id]
  );
  res.status(204).end();
});

router.post("/:id/read", async (req, res) => {
  const { rows } = await query(
    `UPDATE notifications SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND recipient_id = $2
     RETURNING id, title, body, link, read_at AS "readAt", created_at AS "createdAt"`,
    [parse(id, req.params.id), req.user.id]
  );
  if (!rows[0]) throw notFound("Notification");
  res.json({ data: rows[0] });
});

export default router;
