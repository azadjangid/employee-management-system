import pg from "pg";
import { config } from "../config.js";

// Return DATE columns as plain "YYYY-MM-DD" strings instead of JS Dates,
// so they don't shift by a day across time zones.
pg.types.setTypeParser(1082, (value) => value);
// NUMERIC -> JS number (amounts are well within safe range).
pg.types.setTypeParser(1700, (value) => Number(value));

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
