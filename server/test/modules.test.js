import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { resetDb, pool, login, as } from "./setup.js";

// Step 6: departments with heads, payroll, audit logs and receipt uploads.
let admin, hrManager, priya, vikas;
let adminToken;
const ids = {};

const thisMonth = new Date().toISOString().slice(0, 7);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

before(async () => {
  await resetDb();
  adminToken = await login();
  admin = as(adminToken);
  hrManager = as(await login("sneha.joshi@example.com", "password123"));
  priya = as(await login("priya.mehta@example.com", "password123"));
  vikas = as(await login("vikas.kumar@example.com", "password123"));
  const all = await admin.get("/api/employees?limit=100").expect(200);
  for (const e of all.body.data) ids[e.firstName.toLowerCase()] = e.id;
});
after(() => pool.end());

describe("departments", () => {
  test("list shows heads and head counts", async () => {
    const res = await priya.get("/api/departments").expect(200);
    const eng = res.body.data.find((d) => d.name === "Engineering");
    assert.equal(eng.headName, "Amit Patel");
    assert.equal(eng.employeeCount, 3);
    assert.equal(eng.activeCount, 2);
  });

  test("only admins can change departments", async () => {
    await hrManager.post("/api/departments").send({ name: "Finance" }).expect(403);
    const created = await admin
      .post("/api/departments")
      .send({ name: "Finance", description: "Money", headId: ids.karan })
      .expect(201);
    assert.equal(created.body.data.headName, "Karan Shah");
    const updated = await admin
      .put(`/api/departments/${created.body.data.id}`)
      .send({ headId: null })
      .expect(200);
    assert.equal(updated.body.data.headName, null);
    await admin.post("/api/departments").send({ name: "finance" }).expect(409);
    await admin.delete(`/api/departments/${created.body.data.id}`).expect(204);
  });
});

describe("payroll", () => {
  let runId;

  test("salaries are admin only and validated", async () => {
    await hrManager.get("/api/payroll/salaries").expect(403);
    const res = await admin.get("/api/payroll/salaries").expect(200);
    const rahul = res.body.data.find((s) => s.employeeId === ids.rahul);
    assert.equal(rahul.basic, 45000);
    assert.equal(rahul.gross, 76500);
    await admin.put(`/api/payroll/salaries/${ids.rahul}`).send({ basic: -1 }).expect(400);
    const put = await admin
      .put(`/api/payroll/salaries/${ids.rahul}`)
      .send({ basic: 50000, hra: 20000, allowances: 10000, pf: 1800, professionalTax: 200, tds: 3000 })
      .expect(200);
    assert.equal(put.body.data.gross, 80000);
    assert.equal(put.body.data.deductions, 5000);
  });

  test("seed has a paid run for last month with payslips", async () => {
    const runs = (await admin.get("/api/payroll/runs").expect(200)).body.data;
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, "Paid");
    assert.ok(runs[0].employees >= 9);
    const mine = (await priya.get("/api/payroll/payslips").expect(200)).body.data;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].month, runs[0].month);
  });

  test("create a run: LOP, reimbursements and net pay", async () => {
    await hrManager.post("/api/payroll/runs").send({ month: thisMonth }).expect(403);
    await admin.post("/api/payroll/runs").send({ month: "2026-13" }).expect(400);
    const res = await admin.post("/api/payroll/runs").send({ month: thisMonth }).expect(201);
    runId = res.body.data.id;
    assert.equal(res.body.data.status, "Draft");
    await admin.post("/api/payroll/runs").send({ month: thisMonth }).expect(409);

    const detail = (await admin.get(`/api/payroll/runs/${runId}`).expect(200)).body.data;
    const slip = detail.payslips.find((p) => p.employeeId === ids.priya);
    // Priya's approved ₹2,450 food claim is paid out with this run.
    assert.equal(slip.reimbursements, 2450);
    assert.equal(slip.netPay, Math.max(0, slip.gross - slip.totalDeductions + slip.reimbursements));
    for (const p of detail.payslips) {
      assert.equal(p.lopDeduction, Math.round((p.gross / p.workingDays) * p.lopDays * 100) / 100);
    }
    // Rohit is inactive, so no payslip.
    assert.ok(!detail.payslips.some((p) => p.employeeId === ids.rohit));
  });

  test("draft payslips aren't visible to employees", async () => {
    const detail = (await admin.get(`/api/payroll/runs/${runId}`).expect(200)).body.data;
    const slip = detail.payslips.find((p) => p.employeeId === ids.priya);
    await priya.get(`/api/payroll/payslips/${slip.id}`).expect(404);
    assert.equal((await priya.get("/api/payroll/payslips").expect(200)).body.data.length, 1);
  });

  test("recalculate picks up salary changes", async () => {
    await admin.put(`/api/payroll/salaries/${ids.priya}`).send({ basic: 50000 }).expect(200);
    const res = await admin.post(`/api/payroll/runs/${runId}/recalculate`).expect(200);
    const detail = (await admin.get(`/api/payroll/runs/${runId}`).expect(200)).body.data;
    const slip = detail.payslips.find((p) => p.employeeId === ids.priya);
    assert.equal(slip.gross, 50000);
    assert.equal(slip.reimbursements, 2450, "claims are still reserved after recalculating");
    assert.equal(res.body.data.id, runId);
  });

  test("pay locks the run, pays claims and notifies", async () => {
    await admin.post(`/api/payroll/runs/${runId}/pay`).expect(200);
    await admin.post(`/api/payroll/runs/${runId}/recalculate`).expect(400);
    await admin.delete(`/api/payroll/runs/${runId}`).expect(400);

    const claims = (await priya.get("/api/reimbursements").expect(200)).body.data;
    assert.equal(claims.find((c) => c.amount === 2450).status, "Paid");

    const mine = (await priya.get("/api/payroll/payslips").expect(200)).body.data;
    assert.equal(mine.length, 2);
    assert.equal(mine[0].month, thisMonth);
    await priya.get(`/api/payroll/payslips/${mine[0].id}`).expect(200);
    await vikas.get(`/api/payroll/payslips/${mine[0].id}`).expect(404);
    await priya.get(`/api/payroll/payslips?employeeId=${ids.vikas}`).expect(403);

    const notes = (await priya.get("/api/notifications").expect(200)).body.data;
    assert.ok(notes.some((n) => n.title === "Payslip ready"));
  });

  test("people with paid payslips can't be deleted", async () => {
    const res = await admin.delete(`/api/employees/${ids.priya}`).expect(409);
    assert.match(res.body.error.message, /Inactive/);
  });

  test("a draft run can be deleted and frees its claims", async () => {
    const next = new Date();
    next.setUTCMonth(next.getUTCMonth() + 1, 1);
    const month = next.toISOString().slice(0, 7);
    // A new approved claim for Vikas, dated today.
    const claim = await vikas
      .post("/api/reimbursements")
      .send({ category: "Travel", amount: 500, date: new Date().toISOString().slice(0, 10), description: "Cab" })
      .expect(201);
    await admin.patch(`/api/reimbursements/${claim.body.data.id}/status`).send({ status: "Approved" }).expect(200);

    const run = (await admin.post("/api/payroll/runs").send({ month }).expect(201)).body.data;
    assert.equal(run.reimbursements, 500);
    await admin.delete(`/api/payroll/runs/${run.id}`).expect(204);
    const after = (await vikas.get(`/api/reimbursements/${claim.body.data.id}`).expect(200)).body.data;
    assert.equal(after.payrollRunId, null);
    assert.equal(after.status, "Approved");
  });
});

describe("receipts", () => {
  let claimId;

  before(async () => {
    const res = await vikas
      .post("/api/reimbursements")
      .send({ category: "Food", amount: 300, date: "2026-11-01", description: "Lunch" })
      .expect(201);
    claimId = res.body.data.id;
  });

  test("upload, view, replace and remove", async () => {
    const up = await vikas
      .post(`/api/reimbursements/${claimId}/receipt`)
      .attach("receipt", PDF, { filename: "lunch bill.pdf", contentType: "application/pdf" })
      .expect(200);
    assert.equal(up.body.data.hasReceipt, true);
    assert.equal(up.body.data.receipt, "lunch bill.pdf");

    const view = await vikas.get(`/api/reimbursements/${claimId}/receipt`).expect(200);
    assert.equal(view.headers["content-type"], "application/pdf");
    assert.match(view.headers["content-disposition"], /inline; filename="lunch bill.pdf"/);
    assert.equal(view.headers["x-content-type-options"], "nosniff");

    // Managers of other departments and other employees can't see it.
    await priya.get(`/api/reimbursements/${claimId}/receipt`).expect(404);
    await hrManager.get(`/api/reimbursements/${claimId}/receipt`).expect(404);

    const replaced = await vikas
      .post(`/api/reimbursements/${claimId}/receipt`)
      .attach("receipt", PNG, { filename: "bill.png", contentType: "image/png" })
      .expect(200);
    assert.equal(replaced.body.data.receiptMime, "image/png");

    await vikas.delete(`/api/reimbursements/${claimId}/receipt`).expect(200);
    await vikas.get(`/api/reimbursements/${claimId}/receipt`).expect(404);
  });

  test("rejects wrong types, spoofed files and missing files", async () => {
    const txt = await vikas
      .post(`/api/reimbursements/${claimId}/receipt`)
      .attach("receipt", Buffer.from("hello"), { filename: "a.txt", contentType: "text/plain" })
      .expect(400);
    assert.match(txt.body.error.message, /PDF, JPG, PNG or WebP/);
    await vikas
      .post(`/api/reimbursements/${claimId}/receipt`)
      .attach("receipt", Buffer.from("not a pdf"), { filename: "a.pdf", contentType: "application/pdf" })
      .expect(400);
    await vikas.post(`/api/reimbursements/${claimId}/receipt`).expect(400);
  });

  test("other people can't upload, and decided claims are locked", async () => {
    await priya
      .post(`/api/reimbursements/${claimId}/receipt`)
      .attach("receipt", PDF, { filename: "x.pdf", contentType: "application/pdf" })
      .expect(404);
    await admin.patch(`/api/reimbursements/${claimId}/status`).send({ status: "Rejected" }).expect(200);
    await vikas
      .post(`/api/reimbursements/${claimId}/receipt`)
      .attach("receipt", PDF, { filename: "x.pdf", contentType: "application/pdf" })
      .expect(400);
  });
});

describe("audit logs", () => {
  test("admin only", async () => {
    await hrManager.get("/api/audit-logs").expect(403);
    await priya.get("/api/audit-logs").expect(403);
  });

  test("records actions with actor, summary and changes", async () => {
    const res = await admin.get("/api/audit-logs?limit=100").expect(200);
    const actions = res.body.data.map((a) => a.action);
    for (const a of ["payroll.create", "payroll.pay", "salary.update", "department.create",
      "reimbursement.receipt_upload", "auth.login"]) {
      assert.ok(actions.includes(a), `missing ${a}`);
    }
    const salary = res.body.data.find((a) => a.action === "salary.update");
    assert.equal(salary.actorName, "Admin User");
    assert.ok(salary.changes.basic);
  });

  test("filters by action prefix, entity type and search", async () => {
    const payroll = (await admin.get("/api/audit-logs?action=payroll").expect(200)).body.data;
    assert.ok(payroll.length >= 3);
    assert.ok(payroll.every((a) => a.action.startsWith("payroll.")));
    const depts = (await admin.get("/api/audit-logs?entityType=department").expect(200)).body.data;
    assert.ok(depts.every((a) => a.entityType === "department"));
    const found = (await admin.get("/api/audit-logs?search=finance").expect(200)).body;
    assert.ok(found.meta.total >= 2);
    const facets = (await admin.get("/api/audit-logs/facets").expect(200)).body.data;
    assert.ok(facets.entityTypes.includes("payroll_run"));
  });

  test("failed logins are logged without an actor id", async () => {
    await as("x").post("/api/auth/login").send({ email: "admin@employeehub.com", password: "nope" }).expect(401);
    const res = await admin.get("/api/audit-logs?action=auth.login_failed").expect(200);
    assert.ok(res.body.data.length >= 1);
    assert.equal(res.body.data[0].actorId, null);
  });
});
