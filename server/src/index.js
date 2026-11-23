import { createApp } from "./app.js";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";

// Apply any pending migrations on boot so a fresh database just works.
await migrate();

createApp().listen(config.port, () => {
  console.log(`EmployeeHub API listening on http://localhost:${config.port}`);
});
