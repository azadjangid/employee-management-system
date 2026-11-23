import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { api, resetDb, pool, login, as } from "./setup.js";

before(resetDb);
after(() => pool.end());

const cookieFrom = (res) =>
  (res.headers["set-cookie"] || []).find((c) => c.startsWith("ems_token="));

describe("protected routes", () => {
  test("reject requests without a token", async () => {
    const res = await api().get("/api/employees").expect(401);
    assert.equal(res.body.error.message, "Please sign in");
    await api().get("/api/dashboard").expect(401);
    await api().get("/api/profile").expect(401);
  });

  test("reject a forged token", async () => {
    await api().get("/api/employees").set("Authorization", "Bearer abc.def.ghi").expect(401);
  });

  test("health stays public", async () => {
    await api().get("/api/health").expect(200);
  });
});

describe("login", () => {
  test("wrong password and unknown email give the same answer", async () => {
    const a = await api()
      .post("/api/auth/login")
      .send({ email: "admin@employeehub.com", password: "wrong-pass" })
      .expect(401);
    const b = await api()
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong-pass" })
      .expect(401);
    assert.equal(a.body.error.message, b.body.error.message);
  });

  test("sets an httpOnly session cookie and returns the user without the hash", async () => {
    const res = await api()
      .post("/api/auth/login")
      .send({ email: "ADMIN@employeehub.com", password: "admin123" })
      .expect(200);
    const cookie = cookieFrom(res);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.doesNotMatch(cookie, /Max-Age/); // session cookie without "remember me"
    assert.equal(res.body.data.user.email, "admin@employeehub.com");
    assert.equal(res.body.data.user.passwordHash, undefined);
    assert.equal(JSON.stringify(res.body).includes("$2"), false);

    // The cookie alone is enough to call the API.
    const me = await api().get("/api/auth/me").set("Cookie", cookie.split(";")[0]).expect(200);
    assert.equal(me.body.data.user.name, "Admin User");
  });

  test("remember me makes the cookie persistent", async () => {
    const res = await api()
      .post("/api/auth/login")
      .send({ email: "admin@employeehub.com", password: "admin123", rememberMe: true })
      .expect(200);
    assert.match(cookieFrom(res), /Max-Age=604800/);
  });

  test("every seeded employee can sign in with the demo password", async () => {
    await login("priya.mehta@example.com", "password123");
  });

  test("inactive employees cannot sign in, and lose access when deactivated", async () => {
    const token = await login("karan.shah@example.com", "password123");
    await as(token).get("/api/auth/me").expect(200);
    const admin = as(await login());
    const list = await admin.get("/api/employees?search=karan").expect(200);
    await admin.put(`/api/employees/${list.body.data[0].id}`).send({ status: "Inactive" }).expect(200);
    await as(token).get("/api/auth/me").expect(401);
    await api()
      .post("/api/auth/login")
      .send({ email: "karan.shah@example.com", password: "password123" })
      .expect(403);
  });

  test("logout clears the cookie", async () => {
    const res = await api().post("/api/auth/logout").expect(204);
    assert.match(cookieFrom(res), /Expires=Thu, 01 Jan 1970/);
  });
});

describe("employees created with a password", () => {
  test("can sign in; ones without a password cannot", async () => {
    const admin = as(await login());
    await admin
      .post("/api/employees")
      .send({ name: "New Joiner", email: "new.joiner@example.com", password: "welcome123" })
      .expect(201);
    await login("new.joiner@example.com", "welcome123");

    await admin.post("/api/employees").send({ name: "No Pass", email: "nopass@example.com" }).expect(201);
    await api()
      .post("/api/auth/login")
      .send({ email: "nopass@example.com", password: "anything1" })
      .expect(401);

    await admin
      .post("/api/employees")
      .send({ name: "Short", email: "short@example.com", password: "123" })
      .expect(400);
  });
});

describe("profile", () => {
  test("shows and updates the signed-in person's own details", async () => {
    const me = as(await login("amit.patel@example.com", "password123"));
    const res = await me.get("/api/profile").expect(200);
    assert.equal(res.body.data.name, "Amit Patel");

    const updated = await me
      .put("/api/profile")
      .send({ phone: "+91 90000 00000", location: "Remote", department: "HR", status: "Inactive" })
      .expect(200);
    assert.equal(updated.body.data.phone, "+91 90000 00000");
    assert.equal(updated.body.data.location, "Remote");
    // HR-managed fields are ignored.
    assert.equal(updated.body.data.department, "Engineering");
    assert.equal(updated.body.data.status, "Active");
  });

  test("rejects an email already used by someone else", async () => {
    const me = as(await login("amit.patel@example.com", "password123"));
    await me.put("/api/profile").send({ email: "priya.mehta@example.com" }).expect(409);
  });
});

describe("change password", () => {
  test("checks the current password and signs out other sessions", async () => {
    const email = "anjali.verma@example.com";
    const oldToken = await login(email, "password123");
    const otherSession = await login(email, "password123");

    await as(oldToken)
      .post("/api/auth/change-password")
      .send({ currentPassword: "nope-nope", newPassword: "brandnew123" })
      .expect(400);
    await as(oldToken)
      .post("/api/auth/change-password")
      .send({ currentPassword: "password123", newPassword: "short" })
      .expect(400);

    const res = await as(oldToken)
      .post("/api/auth/change-password")
      .send({ currentPassword: "password123", newPassword: "brandnew123" })
      .expect(200);
    // This browser gets a fresh cookie...
    const fresh = cookieFrom(res).split(";")[0];
    await api().get("/api/auth/me").set("Cookie", fresh).expect(200);
    // ...while older tokens stop working.
    const stale = await as(otherSession).get("/api/auth/me").expect(401);
    assert.match(stale.body.error.message, /password was changed/);

    await api().post("/api/auth/login").send({ email, password: "password123" }).expect(401);
    await login(email, "brandnew123");
  });
});

describe("forgot / reset password", () => {
  test("same response for unknown emails, no link leaked", async () => {
    const res = await api()
      .post("/api/auth/forgot-password")
      .send({ email: "ghost@example.com" })
      .expect(200);
    assert.match(res.body.data.message, /If that email/);
    assert.equal(res.body.data.devResetUrl, undefined);
  });

  test("reset link works once", async () => {
    const email = "sneha.joshi@example.com";
    const res = await api().post("/api/auth/forgot-password").send({ email }).expect(200);
    const token = new URL(res.body.data.devResetUrl).searchParams.get("token");
    assert.equal(token.length, 64);

    const before = await login(email, "password123");
    await api().post("/api/auth/reset-password").send({ token, password: "short" }).expect(400);
    await api().post("/api/auth/reset-password").send({ token, password: "resetpass123" }).expect(200);
    await api().post("/api/auth/reset-password").send({ token, password: "another123" }).expect(400);

    await as(before).get("/api/auth/me").expect(401);
    await login(email, "resetpass123");
  });

  test("expired tokens are rejected", async () => {
    const email = "vikas.kumar@example.com";
    const res = await api().post("/api/auth/forgot-password").send({ email }).expect(200);
    const token = new URL(res.body.data.devResetUrl).searchParams.get("token");
    await pool.query("UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute'");
    const bad = await api()
      .post("/api/auth/reset-password")
      .send({ token, password: "resetpass123" })
      .expect(400);
    assert.match(bad.body.error.message, /invalid or has expired/);
  });
});
