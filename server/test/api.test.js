import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { api as anon, resetDb, pool, login, as } from "./setup.js";

let api;
before(async () => {
  await resetDb();
  const admin = as(await login());
  api = () => admin;
});
after(() => pool.end());

describe("health", () => {
  test("GET /api/health", async () => {
    const res = await anon().get("/api/health").expect(200);
    assert.equal(res.body.status, "ok");
  });

  test("unknown route returns JSON 404", async () => {
    const res = await api().get("/api/nope").expect(404);
    assert.match(res.body.error.message, /not found/);
  });

  test("malformed JSON returns 400", async () => {
    await api()
      .post("/api/employees")
      .set("content-type", "application/json")
      .send("{bad")
      .expect(400);
  });
});

describe("departments", () => {
  test("lists seeded departments with employee counts", async () => {
    const res = await api().get("/api/departments").expect(200);
    const eng = res.body.data.find((d) => d.name === "Engineering");
    assert.equal(eng.employeeCount, 3);
  });

  test("create, rename, delete", async () => {
    const created = await api().post("/api/departments").send({ name: "Finance" }).expect(201);
    const { id } = created.body.data;
    await api().post("/api/departments").send({ name: "Finance" }).expect(409);
    const renamed = await api().put(`/api/departments/${id}`).send({ name: "Accounts" }).expect(200);
    assert.equal(renamed.body.data.name, "Accounts");
    await api().delete(`/api/departments/${id}`).expect(204);
    await api().get(`/api/departments/${id}`).expect(404);
  });
});

describe("employees", () => {
  test("lists with pagination meta", async () => {
    const res = await api().get("/api/employees?limit=5").expect(200);
    assert.equal(res.body.data.length, 5);
    assert.equal(res.body.meta.total, 11);
    assert.equal(res.body.meta.totalPages, 3);
  });

  test("filters by search, status and department", async () => {
    let res = await api().get("/api/employees?search=mehta").expect(200);
    assert.deepEqual(res.body.data.map((e) => e.name), ["Priya Mehta"]);
    res = await api().get("/api/employees?status=On%20Leave").expect(200);
    assert.equal(res.body.data.length, 2);
    res = await api().get("/api/employees?department=engineering").expect(200);
    assert.equal(res.body.data.length, 3);
  });

  test("creates with a single name and a department name", async () => {
    const res = await api()
      .post("/api/employees")
      .send({
        name: "Meera Iyer Rao",
        email: "  Meera@Example.com ",
        department: "Design",
        designation: "Illustrator",
      })
      .expect(201);
    const e = res.body.data;
    assert.equal(e.firstName, "Meera");
    assert.equal(e.lastName, "Iyer Rao");
    assert.equal(e.email, "meera@example.com");
    assert.equal(e.department, "Design");
    assert.equal(e.designation, "Illustrator");
    assert.equal(e.employeeCode, `EMP${String(e.id).padStart(3, "0")}`);
    assert.equal(e.status, "Active");
    assert.equal(e.role, "employee");
  });

  test("rejects duplicate email (case-insensitive), bad email and unknown department", async () => {
    await api().post("/api/employees").send({ name: "X", email: "RAHUL.sharma@example.com" }).expect(409);
    const bad = await api().post("/api/employees").send({ name: "X", email: "nope" }).expect(400);
    assert.equal(bad.body.error.details[0].field, "email");
    await api().post("/api/employees").send({ name: "X", email: "x1@example.com", department: "Nowhere" }).expect(400);
    await api().post("/api/employees").send({ email: "x2@example.com" }).expect(400);
  });

  test("updates partially and 404s on missing", async () => {
    const res = await api().put("/api/employees/2").send({ status: "Inactive", location: "Goa" }).expect(200);
    assert.equal(res.body.data.status, "Inactive");
    assert.equal(res.body.data.location, "Goa");
    assert.equal(res.body.data.name, "Rahul Sharma");
    await api().put("/api/employees/9999").send({ status: "Active" }).expect(404);
    await api().put("/api/employees/2").send({}).expect(400);
    await api().get("/api/employees/abc").expect(400);
  });

  test("deleting an employee cascades to their records", async () => {
    const created = await api().post("/api/employees").send({ name: "Temp", email: "temp@example.com" }).expect(201);
    const empId = created.body.data.id;
    await api().post("/api/attendance").send({ employeeId: empId, date: "2026-01-05", status: "Absent" }).expect(201);
    await api().delete(`/api/employees/${empId}`).expect(204);
    const res = await api().get(`/api/attendance?employeeId=${empId}`).expect(200);
    assert.equal(res.body.meta.total, 0);
  });
});

describe("attendance", () => {
  test("accepts 12-hour times and computes work hours", async () => {
    const res = await api()
      .post("/api/attendance")
      .send({ employeeId: 3, date: "2026-01-06", checkIn: "09:05 AM", checkOut: "06:15 PM", status: "Present" })
      .expect(201);
    assert.equal(res.body.data.checkIn, "09:05");
    assert.equal(res.body.data.checkOut, "18:15");
    assert.equal(res.body.data.workHours, 9.17);
  });

  test("one record per employee per day", async () => {
    await api().post("/api/attendance").send({ employeeId: 3, date: "2026-01-06", status: "Late" }).expect(409);
  });

  test("absent clears times; check-out before check-in rejected", async () => {
    const res = await api()
      .post("/api/attendance")
      .send({ employeeId: 3, date: "2026-01-07", checkIn: "09:00", status: "Absent" })
      .expect(201);
    assert.equal(res.body.data.checkIn, null);
    await api()
      .post("/api/attendance")
      .send({ employeeId: 3, date: "2026-01-08", checkIn: "18:00", checkOut: "09:00", status: "Present" })
      .expect(400);
  });

  test("filters by date and returns a daily summary", async () => {
    const res = await api().get("/api/attendance?date=2026-01-06").expect(200);
    assert.equal(res.body.data.length, 1);
    const sum = await api().get("/api/attendance/summary?date=2026-01-06").expect(200);
    assert.equal(sum.body.data.Present, 1);
    assert.equal(sum.body.data.Absent, 0);
  });
});

describe("leaves", () => {
  test("create computes days; overlap rejected", async () => {
    const res = await api()
      .post("/api/leaves")
      .send({ employeeId: 9, leaveType: "Sick Leave", fromDate: "2027-02-01", toDate: "2027-02-03", reason: "Flu" })
      .expect(201);
    assert.equal(res.body.data.days, 3);
    assert.equal(res.body.data.status, "Pending");
    await api()
      .post("/api/leaves")
      .send({ employeeId: 9, leaveType: "Casual Leave", fromDate: "2027-02-03", toDate: "2027-02-04", reason: "x" })
      .expect(409);
  });

  test("rejects reversed dates", async () => {
    await api()
      .post("/api/leaves")
      .send({ employeeId: 9, leaveType: "Sick Leave", fromDate: "2027-03-05", toDate: "2027-03-01", reason: "x" })
      .expect(400);
  });

  test("approve once, then status is locked", async () => {
    const list = await api().get("/api/leaves?status=Pending").expect(200);
    const leave = list.body.data[0];
    const res = await api().patch(`/api/leaves/${leave.id}/status`).send({ status: "Approved" }).expect(200);
    assert.equal(res.body.data.status, "Approved");
    assert.ok(res.body.data.reviewedAt);
    await api().patch(`/api/leaves/${leave.id}/status`).send({ status: "Rejected" }).expect(400);
    await api().put(`/api/leaves/${leave.id}`).send({ reason: "changed" }).expect(400);
    await api().patch(`/api/leaves/${leave.id}/status`).send({ status: "Pending" }).expect(400);
    await api().patch("/api/leaves/9999/status").send({ status: "Approved" }).expect(404);
  });
});

describe("reimbursements", () => {
  test("create, approve, pay; invalid transitions rejected", async () => {
    const res = await api()
      .post("/api/reimbursements")
      .send({ employeeId: 2, category: "Travel", amount: "1500.50", date: "2026-11-01", description: "Cab" })
      .expect(201);
    const claim = res.body.data;
    assert.equal(claim.amount, 1500.5);
    assert.equal(claim.paymentMethod, "Bank Transfer");

    await api().patch(`/api/reimbursements/${claim.id}/status`).send({ status: "Paid" }).expect(400);
    await api().patch(`/api/reimbursements/${claim.id}/status`).send({ status: "Approved" }).expect(200);
    const paid = await api().patch(`/api/reimbursements/${claim.id}/status`).send({ status: "Paid" }).expect(200);
    assert.equal(paid.body.data.status, "Paid");
    await api().put(`/api/reimbursements/${claim.id}`).send({ amount: 1 }).expect(400);
  });

  test("validates amount and category", async () => {
    await api()
      .post("/api/reimbursements")
      .send({ employeeId: 2, category: "Travel", amount: -5, date: "2026-11-01", description: "x" })
      .expect(400);
    await api()
      .post("/api/reimbursements")
      .send({ employeeId: 2, category: "Party", amount: 5, date: "2026-11-01", description: "x" })
      .expect(400);
    await api()
      .post("/api/reimbursements")
      .send({ employeeId: 9999, category: "Travel", amount: 5, date: "2026-11-01", description: "x" })
      .expect(400);
  });

  test("summary groups by status", async () => {
    const res = await api().get("/api/reimbursements/summary").expect(200);
    assert.ok(res.body.data.Paid.count >= 2);
    assert.equal(typeof res.body.data.Pending.total, "number");
  });
});

describe("dashboard", () => {
  test("returns stats, 7 days of attendance in order, and lists", async () => {
    const res = await api().get("/api/dashboard").expect(200);
    const d = res.body.data;
    assert.equal(typeof d.stats.totalEmployees, "number");
    assert.equal(d.weeklyAttendance.length, 7);
    const dates = d.weeklyAttendance.map((w) => w.date);
    assert.deepEqual(dates, [...dates].sort());
    assert.ok(d.departmentDistribution.length >= 6);
    assert.ok(d.recentEmployees.length <= 5);
    assert.ok(d.pendingLeaves.every((l) => l.name && l.type));
  });
});
