import { Router } from "express";
import { z } from "zod";
import { audit, diff } from "../lib/audit.js";
import { query } from "../db/pool.js";
import { parse } from "../lib/validate.js";
import { buildUpdate } from "../lib/sql.js";
import { badRequest } from "../lib/errors.js";
import { getEmployee } from "./employees.js";

const router = Router();

/** The signed-in person's own record. */
router.get("/", async (req, res) => {
  res.json({ data: await getEmployee(req.user.id) });
});

// People can edit their own contact details. Department, designation, status,
// employee code and joining date are managed by HR on the Employees page.
const profileBody = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email")).optional(),
  phone: z.string().trim().max(30).nullish(),
  location: z.string().trim().max(200).nullish(),
});

router.put("/", async (req, res) => {
  const input = parse(profileBody, req.body);
  const before = await getEmployee(req.user.id);
  const { sets, values } = buildUpdate({
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
    location: input.location,
  });
  if (!sets.length) throw badRequest("Nothing to update");
  await query(
    `UPDATE employees SET ${sets.join(", ")}, updated_at = now() WHERE id = $${values.length + 1}`,
    [...values, req.user.id]
  );
  const after = await getEmployee(req.user.id);
  await audit(req, {
    action: "profile.update",
    entityType: "employee",
    entityId: req.user.id,
    summary: `${after.name} updated their profile`,
    changes: diff(before, after),
  });
  res.json({ data: after });
});

export default router;
