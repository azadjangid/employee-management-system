import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { resetDb, pool, login, as } from "./setup.js";

// Seeded roles:
//   admin@employeehub.com     admin   (Administration)
//   sneha.joshi@example.com   manager (HR: Sneha, Neha)
//   karan.shah@example.com    manager (Sales: Karan, Vikas)
//   neha.singh@example.com    employee (HR)
//   vikas.kumar@example.com   employee (Sales)
//   priya.mehta@example.com   employee (Design)
let admin, hrManager, salesManager, neha, priya;
const ids = {};

before(async () => {
  await resetDb();
  admin = as(await login());
  hrManager = as(await login("sneha.joshi@example.com", "password123"));
  salesManager = as(await login("karan.shah@example.com", "password123"));
  neha = as(await login("neha.singh@example.com", "password123"));
  priya = as(await login("priya.mehta@example.com", "password123"));
  const all = await admin.get("/api/employees?limit=100").expect(200);
  for (const e of all.body.data) ids[e.firstName.toLowerCase()] = e.id;
});
after(() => pool.end());

describe("who am I", () => {
  test("/auth/me includes the role", async () => {
    assert.equal((await admin.get("/api/auth/me")).body.data.user.role, "admin");
    assert.equal((await hrManager.get("/api/auth/me")).body.data.user.role, "manager");
    assert.equal((await neha.get("/api/auth/me")).body.data.user.role, "employee");
  });
});

describe("employees", () => {
  test("admin sees everyone, manager sees their department, employee is refused", async () => {
    const all = await admin.get("/api/employees").expect(200);
    assert.equal(all.body.meta.total, 11);

    const hr = await hrManager.get("/api/employees").expect(200);
    assert.deepEqual(hr.body.data.map((e) => e.department), ["HR", "HR"]);

    await neha.get("/api/employees").expect(403);
  });

  test("single records respect scope (404 outside it)", async () => {
    await hrManager.get(`/api/employees/${ids.neha}`).expect(200);
    await hrManager.get(`/api/employees/${ids.vikas}`).expect(404);
    await neha.get(`/api/employees/${ids.neha}`).expect(200);
    await neha.get(`/api/employees/${ids.priya}`).expect(404);
  });

  test("only admins create, edit and delete employees or change roles", async () => {
    await hrManager.post("/api/employees").send({ name: "X", email: "x@example.com" }).expect(403);
    await hrManager.put(`/api/employees/${ids.neha}`).send({ role: "manager" }).expect(403);
    await neha.put(`/api/employees/${ids.neha}`).send({ role: "admin" }).expect(403);
    await hrManager.delete(`/api/employees/${ids.neha}`).expect(403);

    const res = await admin.put(`/api/employees/${ids.priya}`).send({ role: "manager" }).expect(200);
    assert.equal(res.body.data.role, "manager");
    await admin.put(`/api/employees/${ids.priya}`).send({ role: "employee" }).expect(200);
    await admin.put(`/api/employees/${ids.priya}`).send({ role: "boss" }).expect(400);
  });

  test("the last admin can't be demoted, deactivated or delete themselves", async () => {
    const res = await admin.put(`/api/employees/${ids.admin}`).send({ role: "employee" }).expect(403);
    assert.match(res.body.error.message, /at least one active admin/);
    await admin.put(`/api/employees/${ids.admin}`).send({ status: "Inactive" }).expect(403);
    await admin.delete(`/api/employees/${ids.admin}`).expect(403);

    // With a second admin, demotion is fine.
    await admin.put(`/api/employees/${ids.priya}`).send({ role: "admin" }).expect(200);
    await admin.put(`/api/employees/${ids.priya}`).send({ role: "employee" }).expect(200);
  });

  test("employees can still edit their own profile", async () => {
    const res = await neha.put("/api/profile").send({ location: "Noida" }).expect(200);
    assert.equal(res.body.data.location, "Noida");
  });
});

describe("departments", () => {
  test("everyone can read, only admins write", async () => {
    await neha.get("/api/departments").expect(200);
    await hrManager.post("/api/departments").send({ name: "Legal" }).expect(403);
    await admin.post("/api/departments").send({ name: "Legal" }).expect(201);
  });
});

describe("leaves", () => {
  let nehaLeave;

  test("employees file for themselves by default and can't file for others", async () => {
    const res = await neha
      .post("/api/leaves")
      .send({ leaveType: "Casual Leave", fromDate: "2027-05-01", toDate: "2027-05-02", reason: "Trip" })
      .expect(201);
    nehaLeave = res.body.data;
    assert.equal(nehaLeave.employeeId, ids.neha);

    await neha
      .post("/api/leaves")
      .send({ employeeId: ids.priya, leaveType: "Casual Leave", fromDate: "2027-05-01", toDate: "2027-05-01", reason: "x" })
      .expect(403);
  });

  test("lists are scoped", async () => {
    const mine = await neha.get("/api/leaves").expect(200);
    assert.ok(mine.body.data.every((l) => l.employeeId === ids.neha));

    const hr = await hrManager.get("/api/leaves").expect(200);
    assert.ok(hr.body.data.every((l) => l.department === "HR"));
    assert.ok(hr.body.data.some((l) => l.id === nehaLeave.id));

    const sales = await salesManager.get("/api/leaves").expect(200);
    assert.ok(!sales.body.data.some((l) => l.id === nehaLeave.id));
    await salesManager.get(`/api/leaves/${nehaLeave.id}`).expect(404);
  });

  test("employees can't approve; managers approve only their department", async () => {
    await neha.patch(`/api/leaves/${nehaLeave.id}/status`).send({ status: "Approved" }).expect(403);
    await salesManager.patch(`/api/leaves/${nehaLeave.id}/status`).send({ status: "Approved" }).expect(404);
    const res = await hrManager
      .patch(`/api/leaves/${nehaLeave.id}/status`)
      .send({ status: "Approved" })
      .expect(200);
    assert.equal(res.body.data.reviewedBy, "Sneha Joshi");
    assert.equal(res.body.data.reviewedById, ids.sneha);
  });

  test("managers can't approve their own leave; admins can approve it", async () => {
    const res = await hrManager
      .post("/api/leaves")
      .send({ leaveType: "Sick Leave", fromDate: "2027-06-01", toDate: "2027-06-01", reason: "Doctor" })
      .expect(201);
    const own = res.body.data;
    const denied = await hrManager.patch(`/api/leaves/${own.id}/status`).send({ status: "Approved" }).expect(403);
    assert.match(denied.body.error.message, /your own leave/);
    await admin.patch(`/api/leaves/${own.id}/status`).send({ status: "Approved" }).expect(200);
  });

  test("employees cancel only their own pending requests", async () => {
    const res = await neha
      .post("/api/leaves")
      .send({ leaveType: "Sick Leave", fromDate: "2027-07-01", toDate: "2027-07-01", reason: "x" })
      .expect(201);
    await priya.delete(`/api/leaves/${res.body.data.id}`).expect(404);
    await neha.delete(`/api/leaves/${res.body.data.id}`).expect(204);
    // Already approved: can't be cancelled by the employee.
    await neha.delete(`/api/leaves/${nehaLeave.id}`).expect(400);
  });
});

describe("reimbursements", () => {
  test("employee files, manager approves, only admin pays", async () => {
    const res = await neha
      .post("/api/reimbursements")
      .send({ category: "Travel", amount: 900, date: "2026-11-10", description: "Cab" })
      .expect(201);
    const claim = res.body.data;
    assert.equal(claim.employeeId, ids.neha);

    await neha.patch(`/api/reimbursements/${claim.id}/status`).send({ status: "Approved" }).expect(403);
    await salesManager.patch(`/api/reimbursements/${claim.id}/status`).send({ status: "Approved" }).expect(404);
    await hrManager.patch(`/api/reimbursements/${claim.id}/status`).send({ status: "Approved" }).expect(200);
    const pay = await hrManager.patch(`/api/reimbursements/${claim.id}/status`).send({ status: "Paid" }).expect(403);
    assert.match(pay.body.error.message, /Only admins/);
    const paid = await admin.patch(`/api/reimbursements/${claim.id}/status`).send({ status: "Paid" }).expect(200);
    assert.equal(paid.body.data.reviewedBy, "Sneha Joshi"); // approver is kept
  });

  test("summary is scoped", async () => {
    const mine = await priya.get("/api/reimbursements/summary").expect(200);
    const all = await admin.get("/api/reimbursements/summary").expect(200);
    const count = (s) => Object.values(s.body.data).reduce((n, x) => n + x.count, 0);
    assert.equal(count(mine), 1);
    assert.ok(count(all) > count(mine));
  });
});

describe("attendance", () => {
  test("employees see only their own records and can't record attendance", async () => {
    const res = await neha.get("/api/attendance?limit=100").expect(200);
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.data.every((a) => a.employeeId === ids.neha));
    await neha
      .post("/api/attendance")
      .send({ employeeId: ids.neha, date: "2027-01-04", status: "Present" })
      .expect(403);
  });

  test("managers record attendance only for their department", async () => {
    await hrManager
      .post("/api/attendance")
      .send({ employeeId: ids.neha, date: "2027-01-04", status: "Present", checkIn: "09:00" })
      .expect(201);
    await hrManager
      .post("/api/attendance")
      .send({ employeeId: ids.vikas, date: "2027-01-04", status: "Present" })
      .expect(404);
  });

  test("self check-in and check-out", async () => {
    // Priya has seeded attendance for today; clear it to test a fresh check-in.
    await pool.query("DELETE FROM attendance WHERE employee_id = $1 AND date = CURRENT_DATE", [ids.priya]);
    const none = await priya.get("/api/attendance/today").expect(200);
    assert.equal(none.body.data, null);

    await priya.post("/api/attendance/check-out").expect(400);
    const inRes = await priya.post("/api/attendance/check-in").expect(201);
    assert.match(inRes.body.data.checkIn, /^\d{2}:\d{2}$/);
    assert.ok(["Present", "Late"].includes(inRes.body.data.status));
    await priya.post("/api/attendance/check-in").expect(409);

    const outRes = await priya.post("/api/attendance/check-out").expect(200);
    assert.match(outRes.body.data.checkOut, /^\d{2}:\d{2}$/);
    await priya.post("/api/attendance/check-out").expect(400);
  });
});

describe("dashboard", () => {
  test("is scoped to company, department or self", async () => {
    const a = (await admin.get("/api/dashboard").expect(200)).body.data;
    const m = (await hrManager.get("/api/dashboard").expect(200)).body.data;
    const e = (await neha.get("/api/dashboard").expect(200)).body.data;

    assert.equal(a.scope, "company");
    assert.equal(m.scope, "department");
    assert.equal(e.scope, "self");

    assert.equal(a.stats.totalEmployees, 10);
    assert.equal(m.stats.totalEmployees, 2);
    assert.equal(e.stats.totalEmployees, 1);

    assert.deepEqual(m.departmentDistribution.map((d) => d.name), ["HR"]);
    assert.equal(e.recentEmployees.length, 0);
    assert.ok(m.recentEmployees.every((x) => x.department === "HR"));
    assert.equal(e.weeklyAttendance.length, 7);
    assert.ok(e.weeklyAttendance.every((d) => d.present + d.absent <= 1));
  });
});
