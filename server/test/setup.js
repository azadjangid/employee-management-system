// Point the app at a separate test database before anything imports config.
// dotenv never overrides variables that are already set.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@localhost:5432/ems_test";

// Receipts from tests go to a throwaway folder.
const os = await import("node:os");
const path = await import("node:path");
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `ems-test-uploads-${process.pid}`);

const { seed } = await import("../src/db/seed.js");
const { migrate } = await import("../src/db/migrate.js");
const { pool } = await import("../src/db/pool.js");
const { createApp } = await import("../src/app.js");
const supertest = (await import("supertest")).default;

export async function resetDb() {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {} });
}

export const api = () => supertest(createApp());

/** Log in and return the bearer token. */
export async function login(email = "admin@employeehub.com", password = "admin123") {
  const res = await api().post("/api/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status}`);
  return res.body.data.token;
}

/** A request helper whose calls carry the given token. */
export function as(token) {
  const app = createApp();
  const wrap = (method) => (url) =>
    supertest(app)[method](url).set("Authorization", `Bearer ${token}`);
  return {
    get: wrap("get"),
    post: wrap("post"),
    put: wrap("put"),
    patch: wrap("patch"),
    delete: wrap("delete"),
  };
}
export { pool };
