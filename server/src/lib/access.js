import { query } from "../db/pool.js";
import { HttpError, notFound } from "./errors.js";

export const ROLES = ["admin", "manager", "employee"];

export const forbidden = (message = "You don't have permission to do that") =>
  new HttpError(403, message);

/**
 * What part of the company a user can see:
 *   admin    -> everyone
 *   manager  -> their own department (just themselves if they have none)
 *   employee -> only themselves
 */
export function scopeOf(user) {
  if (user.role === "admin") return { all: true };
  if (user.role === "manager" && user.departmentId) return { departmentId: user.departmentId };
  return { employeeId: user.id };
}

/**
 * Add the user's scope to a whereBuilder. `emp` is the SQL alias of the
 * employees table joined in the query.
 */
export function applyScope(where, user, emp = "e") {
  const scope = scopeOf(user);
  if (scope.departmentId) where.add(`${emp}.department_id = ?`, scope.departmentId);
  if (scope.employeeId) where.add(`${emp}.id = ?`, scope.employeeId);
  return where;
}

/** True when `user` may see/act on records belonging to `employeeId`. */
export async function canAccessEmployee(user, employeeId) {
  const scope = scopeOf(user);
  if (scope.all) return true;
  if (scope.employeeId) return scope.employeeId === employeeId;
  const { rows } = await query("SELECT department_id FROM employees WHERE id = $1", [employeeId]);
  return rows[0]?.department_id === scope.departmentId;
}

/** Throws 404 when the employee is outside the user's scope (so we don't leak who exists). */
export async function assertCanAccessEmployee(user, employeeId, what = "Employee") {
  if (!(await canAccessEmployee(user, employeeId))) throw notFound(what);
}

export const isAdmin = (user) => user.role === "admin";
export const isManagerOrAdmin = (user) => user.role === "admin" || user.role === "manager";
