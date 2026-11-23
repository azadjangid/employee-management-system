import { badRequest } from "./errors.js";

/**
 * Resolve a department given either a numeric id or a name.
 * Returns the id, null (explicitly cleared) or undefined (not provided).
 */
export async function resolveDepartmentId(db, { departmentId, department }) {
  if (departmentId !== undefined) return departmentId;
  if (department === undefined) return undefined;
  if (department === null || department === "") return null;
  const { rows } = await db.query(
    "SELECT id FROM departments WHERE lower(name) = lower($1)",
    [department]
  );
  if (!rows[0]) throw badRequest(`Department "${department}" does not exist`);
  return rows[0].id;
}
