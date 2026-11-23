import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { parse, id } from "../lib/validate.js";
import { buildUpdate } from "../lib/sql.js";
import { notFound, badRequest } from "../lib/errors.js";
import { authorize } from "../middleware/authorize.js";
import { audit, diff } from "../lib/audit.js";

const router = Router();

// Everyone can read departments (for dropdowns); only admins change them.

const SELECT = `
  SELECT d.id, d.name, d.description,
         d.head_id AS "headId",
         trim(h.first_name || ' ' || h.last_name) AS "headName",
         (SELECT count(*)::int FROM employees e WHERE e.department_id = d.id) AS "employeeCount",
         (SELECT count(*)::int FROM employees e
            WHERE e.department_id = d.id AND e.status <> 'Inactive') AS "activeCount",
         (SELECT count(*)::int FROM employees e
            WHERE e.department_id = d.id AND e.role = 'manager') AS "managerCount",
         d.created_at AS "createdAt", d.updated_at AS "updatedAt"
  FROM departments d
  LEFT JOIN employees h ON h.id = d.head_id`;

const body = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).nullish(),
  headId: id.nullish(),
});

async function getDepartment(deptId) {
  const { rows } = await query(`${SELECT} WHERE d.id = $1`, [deptId]);
  if (!rows[0]) throw notFound("Department");
  return rows[0];
}

router.get("/", async (req, res) => {
  const { rows } = await query(`${SELECT} ORDER BY d.name`);
  res.json({ data: rows });
});

router.get("/:id", async (req, res) => {
  res.json({ data: await getDepartment(parse(id, req.params.id)) });
});

router.post("/", authorize("admin"), async (req, res) => {
  const input = parse(body, req.body);
  const { rows } = await query(
    "INSERT INTO departments (name, description, head_id) VALUES ($1, $2, $3) RETURNING id",
    [input.name, input.description ?? null, input.headId ?? null]
  );
  const dept = await getDepartment(rows[0].id);
  await audit(req, {
    action: "department.create",
    entityType: "department",
    entityId: dept.id,
    summary: `Created department ${dept.name}`,
  });
  res.status(201).json({ data: dept });
});

router.put("/:id", authorize("admin"), async (req, res) => {
  const deptId = parse(id, req.params.id);
  const input = parse(body.partial(), req.body);
  const before = await getDepartment(deptId);
  const { sets, values } = buildUpdate({
    name: input.name,
    description: input.description,
    head_id: input.headId,
  });
  if (!sets.length) throw badRequest("Nothing to update");
  await query(
    `UPDATE departments SET ${sets.join(", ")}, updated_at = now() WHERE id = $${values.length + 1}`,
    [...values, deptId]
  );
  const dept = await getDepartment(deptId);
  const changes = diff(before, dept);
  delete changes.headId; // headName already says it in words
  await audit(req, {
    action: "department.update",
    entityType: "department",
    entityId: deptId,
    summary: `Updated department ${dept.name}`,
    changes,
  });
  res.json({ data: dept });
});

router.delete("/:id", authorize("admin"), async (req, res) => {
  const deptId = parse(id, req.params.id);
  const dept = await getDepartment(deptId);
  await query("DELETE FROM departments WHERE id = $1", [deptId]);
  await audit(req, {
    action: "department.delete",
    entityType: "department",
    entityId: deptId,
    summary: `Deleted department ${dept.name}${dept.employeeCount ? ` (${dept.employeeCount} employees un-assigned)` : ""}`,
  });
  res.status(204).end();
});

export default router;
