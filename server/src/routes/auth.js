import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { audit } from "../lib/audit.js";
import { query, withTransaction } from "../db/pool.js";
import { config } from "../config.js";
import { parse } from "../lib/validate.js";
import { HttpError, badRequest } from "../lib/errors.js";
import {
  passwordSchema,
  hashPassword,
  verifyPassword,
  verifyPasswordOrDummy,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  newResetToken,
  hashResetToken,
} from "../lib/auth.js";
import { sendMail } from "../lib/mailer.js";
import { requireAuth } from "../middleware/auth.js";
import { getEmployee } from "./employees.js";

const router = Router();

const email = z.string().trim().toLowerCase().pipe(z.email("Invalid email"));
const newPassword = passwordSchema;

// Brute-force protection: failed attempts per IP in a 15 minute window.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  skip: () => config.isTest,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ error: { message: "Too many attempts. Try again in a few minutes." } }),
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skip: () => config.isTest,
  handler: (req, res) =>
    res.status(429).json({ error: { message: "Too many requests. Try again later." } }),
});

router.post("/login", loginLimiter, async (req, res) => {
  const input = parse(
    z.object({
      email,
      password: z.string().min(1, "Password is required"),
      rememberMe: z.boolean().optional(),
    }),
    req.body
  );
  const { rows } = await query(
    `SELECT id, status, password_hash AS "passwordHash",
            password_changed_at AS "passwordChangedAt",
            trim(first_name || ' ' || last_name) AS name
     FROM employees WHERE lower(email) = $1`,
    [input.email]
  );
  const account = rows[0];
  const ok = await verifyPasswordOrDummy(input.password, account?.passwordHash);
  if (!ok) {
    await audit(req, {
      action: "auth.login_failed",
      entityType: "auth",
      entityId: account?.id ?? null,
      summary: `Failed sign-in for ${input.email}`,
      // Whoever typed the password is unknown, so no actor; entityId says which account.
      actor: { id: null, name: null },
    });
    throw new HttpError(401, "Invalid email or password");
  }
  if (account.status === "Inactive") throw new HttpError(403, "This account has been deactivated");

  await query("UPDATE employees SET last_login_at = now() WHERE id = $1", [account.id]);
  const token = signToken(account, { rememberMe: input.rememberMe });
  setAuthCookie(res, token, { rememberMe: input.rememberMe });
  await audit(req, {
    action: "auth.login",
    entityType: "auth",
    entityId: account.id,
    summary: `${account.name} signed in`,
    actor: account,
  });
  res.json({ data: { user: await getEmployee(account.id), token } });
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ data: { user: await getEmployee(req.user.id) } });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const input = parse(
    z
      .object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword,
      })
      .refine((b) => b.currentPassword !== b.newPassword, {
        message: "New password must be different from the current one",
        path: ["newPassword"],
      }),
    req.body
  );
  const { rows } = await query(
    `SELECT password_hash AS "passwordHash" FROM employees WHERE id = $1`,
    [req.user.id]
  );
  if (!rows[0].passwordHash || !(await verifyPassword(input.currentPassword, rows[0].passwordHash))) {
    throw badRequest("Current password is incorrect");
  }
  const {
    rows: [updated],
  } = await query(
    `UPDATE employees SET password_hash = $1, password_changed_at = now(), updated_at = now()
     WHERE id = $2 RETURNING id, password_changed_at AS "passwordChangedAt"`,
    [await hashPassword(input.newPassword), req.user.id]
  );
  // Old tokens are now invalid; give this browser a fresh one so it stays signed in.
  setAuthCookie(res, signToken(updated));
  await audit(req, {
    action: "auth.password_change",
    entityType: "employee",
    entityId: req.user.id,
    summary: `${req.user.name} changed their password`,
  });
  res.json({ data: { message: "Password changed" } });
});

const RESET_TTL_MINUTES = 60;

router.post("/forgot-password", forgotLimiter, async (req, res) => {
  const input = parse(z.object({ email }), req.body);
  const { rows } = await query(
    `SELECT id, email, first_name AS "firstName" FROM employees
     WHERE lower(email) = $1 AND status <> 'Inactive'`,
    [input.email]
  );
  const response = {
    message: "If that email belongs to an account, a reset link is on its way.",
  };
  const account = rows[0];
  if (account) {
    const token = newResetToken();
    await query(
      `INSERT INTO password_reset_tokens (employee_id, token_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [account.id, hashResetToken(token), RESET_TTL_MINUTES]
    );
    const url = `${config.appUrl}/reset-password?token=${token}`;
    await sendMail({
      to: account.email,
      subject: "Reset your EmployeeHub password",
      text: `Hi ${account.firstName},\n\nReset your password here (valid for ${RESET_TTL_MINUTES} minutes):\n${url}\n\nIf you didn't ask for this, ignore this email.`,
    });
    // No email provider yet: outside production, hand the link back so it can be used.
    if (!config.isProduction) response.devResetUrl = url;
  }
  res.json({ data: response });
});

router.post("/reset-password", async (req, res) => {
  const input = parse(z.object({ token: z.string().min(1), password: newPassword }), req.body);
  const employeeId = await withTransaction(async (db) => {
    const { rows } = await db.query(
      `SELECT id, employee_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [hashResetToken(input.token)]
    );
    if (!rows[0]) throw badRequest("This reset link is invalid or has expired");
    await db.query(
      `UPDATE employees SET password_hash = $1, password_changed_at = now(), updated_at = now()
       WHERE id = $2`,
      [await hashPassword(input.password), rows[0].employee_id]
    );
    // Use up this token and any other outstanding ones for the same person.
    await db.query(
      "UPDATE password_reset_tokens SET used_at = now() WHERE employee_id = $1 AND used_at IS NULL",
      [rows[0].employee_id]
    );
    return rows[0].employee_id;
  });
  await audit(req, {
    action: "auth.password_reset",
    entityType: "employee",
    entityId: employeeId,
    summary: "Password reset with an emailed link",
    actor: { id: employeeId, name: null },
  });
  res.json({ data: { message: "Password has been reset. You can sign in now." } });
});

export default router;
