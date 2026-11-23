import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";

export const COOKIE_NAME = "ems_token";
export const MIN_PASSWORD_LENGTH = 8;

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(128);

export const hashPassword = (password) => bcrypt.hash(password, config.bcryptRounds);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

// Compared against when the email is unknown, so response time doesn't reveal
// which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", config.bcryptRounds);
export const verifyPasswordOrDummy = (password, hash) =>
  bcrypt.compare(password, hash || DUMMY_HASH).then((ok) => ok && Boolean(hash));

/** Password version: changes whenever the password does, which invalidates older tokens. */
export const passwordVersion = (changedAt) => new Date(changedAt).getTime();

export function signToken(employee, { rememberMe = false } = {}) {
  return jwt.sign(
    { sub: String(employee.id), pwv: passwordVersion(employee.passwordChangedAt) },
    config.jwtSecret,
    { expiresIn: rememberMe ? config.rememberMeExpiresIn : config.jwtExpiresIn }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

/** Convert "7d" / "12h" / "30m" to milliseconds for the cookie's maxAge. */
export function durationMs(value) {
  const m = String(value).match(/^(\d+)\s*([smhd])?$/);
  if (!m) return undefined;
  const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2] || "s"];
  return Number(m[1]) * unit;
}

export function setAuthCookie(res, token, { rememberMe = false } = {}) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
    // Without "remember me" it's a session cookie that goes away with the browser.
    ...(rememberMe && { maxAge: durationMs(config.rememberMeExpiresIn) }),
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/", sameSite: "lax", secure: config.isProduction });
}

export const newResetToken = () => crypto.randomBytes(32).toString("hex");
export const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
