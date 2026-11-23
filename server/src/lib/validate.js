import { z } from "zod";
import { badRequest } from "./errors.js";

/** Parse `data` with a zod schema, throwing a 400 with field errors on failure. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    throw badRequest(
      details.length === 1
        ? `${details[0].field || "input"}: ${details[0].message}`
        : "Validation failed",
      details
    );
  }
  return result.data;
}

export const id = z.coerce.number().int().positive();
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** "09:05", "09:05:00" or "09:05 AM" -> "HH:MM" (24h). Empty or "-" -> null. */
export const time = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "" || value === "-") return null;
    const m = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (!m) {
      ctx.addIssue({ code: "custom", message: "Expected a time like 09:05 or 09:05 AM" });
      return z.NEVER;
    }
    let h = Number(m[1]);
    const min = Number(m[2]);
    const ampm = m[3]?.toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    if (h > 23 || min > 59) {
      ctx.addIssue({ code: "custom", message: "Invalid time" });
      return z.NEVER;
    }
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  })
  .nullable();

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
};
