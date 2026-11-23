import { forbidden } from "../lib/access.js";

/** Route guard: allow only the listed roles. Use after requireAuth. */
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) throw forbidden();
    next();
  };
