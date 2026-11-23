import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { resetDb, pool, login, as } from "./setup.js";

let admin, hrManager, salesManager, neha;

before(async () => {
  await resetDb();
  admin = as(await login());
  hrManager = as(await login("sneha.joshi@example.com", "password123"));
  salesManager = as(await login("karan.shah@example.com", "password123"));
  neha = as(await login("neha.singh@example.com", "password123"));
});
after(() => pool.end());

const unread = async (who) => (await who.get("/api/notifications").expect(200)).body.meta.unread;

describe("notifications", () => {
  test("seeded pending requests notify their approvers", async () => {
    const res = await admin.get("/api/notifications").expect(200);
    assert.ok(res.body.data.length > 0);
    assert.equal(res.body.meta.unread, res.body.data.length);
  });

  test("a new leave notifies the department manager and admins, not other managers", async () => {
    const [a0, hr0, sales0] = [await unread(admin), await unread(hrManager), await unread(salesManager)];
    await neha
      .post("/api/leaves")
      .send({ leaveType: "Casual Leave", fromDate: "2027-03-01", toDate: "2027-03-02", reason: "Wedding" })
      .expect(201);
    assert.equal(await unread(admin), a0 + 1);
    assert.equal(await unread(hrManager), hr0 + 1);
    assert.equal(await unread(salesManager), sales0);

    const latest = (await hrManager.get("/api/notifications").expect(200)).body.data[0];
    assert.equal(latest.title, "New leave request");
    assert.match(latest.body, /Neha Singh requested 2 day\(s\) of Casual Leave \(1 Mar - 2 Mar\)/);
    assert.equal(latest.link, "/leaves");
  });

  test("the employee hears back when it's decided", async () => {
    const before = await unread(neha);
    const leave = (await neha.get("/api/leaves?status=Pending").expect(200)).body.data[0];
    await hrManager.patch(`/api/leaves/${leave.id}/status`).send({ status: "Approved" }).expect(200);
    assert.equal(await unread(neha), before + 1);
    const latest = (await neha.get("/api/notifications").expect(200)).body.data[0];
    assert.equal(latest.title, "Leave approved");
    assert.match(latest.body, /approved by Sneha Joshi/);
  });

  test("claims notify approvers, then the employee on approval and payment", async () => {
    const before = await unread(neha);
    const claim = (
      await neha
        .post("/api/reimbursements")
        .send({ category: "Food", amount: 640, date: "2026-11-02", description: "Client lunch" })
        .expect(201)
    ).body.data;
    await hrManager.patch(`/api/reimbursements/${claim.id}/status`).send({ status: "Approved" }).expect(200);
    await admin.patch(`/api/reimbursements/${claim.id}/status`).send({ status: "Paid" }).expect(200);
    const list = (await neha.get("/api/notifications").expect(200)).body.data;
    assert.equal(await unread(neha), before + 2);
    assert.equal(list[0].title, "Reimbursement paid");
    assert.match(list[0].body, /₹640 Food claim has been paid/);
    assert.equal(list[1].title, "Reimbursement approved");
  });

  test("mark one read, mark all read, can't touch someone else's", async () => {
    const list = (await neha.get("/api/notifications").expect(200)).body.data;
    const before = await unread(neha);
    const res = await neha.post(`/api/notifications/${list[0].id}/read`).expect(200);
    assert.ok(res.body.data.readAt);
    assert.equal(await unread(neha), before - 1);
    await admin.post(`/api/notifications/${list[1].id}/read`).expect(404);
    await neha.post("/api/notifications/read-all").expect(204);
    assert.equal(await unread(neha), 0);
  });
});

describe("search", () => {
  test("admins find employees, leaves and claims", async () => {
    const res = await admin.get("/api/search?q=priya").expect(200);
    assert.deepEqual(res.body.data.employees.map((e) => e.name), ["Priya Mehta"]);
    assert.ok(res.body.data.leaves.every((l) => l.employeeName === "Priya Mehta"));
    assert.ok(res.body.data.reimbursements.length >= 1);
  });

  test("results are scoped to what the user can see", async () => {
    const hr = await hrManager.get("/api/search?q=a").expect(200);
    assert.ok(hr.body.data.employees.every((e) => e.department === "HR"));

    const mine = await neha.get("/api/search?q=priya").expect(200);
    assert.deepEqual(mine.body.data, { employees: [], leaves: [], reimbursements: [] });

    const own = await neha.get("/api/search?q=client").expect(200);
    assert.ok(own.body.data.reimbursements.every((r) => r.employeeName === "Neha Singh"));
  });

  test("empty query is rejected", async () => {
    await admin.get("/api/search?q=").expect(400);
  });
});
