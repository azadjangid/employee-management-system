import { query } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { COOKIE_NAME, verifyToken, passwordVersion } from "../lib/auth.js";

const unauthorized = (message = "Please sign in") => new HttpError(401, message);

function readToken(req) {
  const header = req.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[COOKIE_NAME];
}

/**
 * Requires a valid login. Accepts the httpOnly cookie set by /api/auth/login,
 * or an "Authorization: Bearer <token>" header (handy for Postman / scripts).
 * Sets req.user = { id, email, name, status, role, departmentId }.
 */
export async function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    throw unauthorized(err.name === "TokenExpiredError" ? "Your session has expired" : "Please sign in");
  }

  const { rows } = await query(
    `SELECT id, email, status, role, department_id AS "departmentId",
            password_changed_at AS "passwordChangedAt",
            trim(first_name || ' ' || last_name) AS name
     FROM employees WHERE id = $1`,
    [Number(payload.sub)]
  );
  const user = rows[0];
  if (!user || user.status === "Inactive") throw unauthorized("This account is no longer active");
  // A password change (or reset) signs out every older session.
  if (payload.pwv !== passwordVersion(user.passwordChangedAt)) {
    throw unauthorized("Your password was changed. Please sign in again");
  }

  delete user.passwordChangedAt;
  req.user = user;
  next();
}
