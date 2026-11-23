import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { query } from "./db/pool.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/auth.js";

import departments from "./routes/departments.js";
import employees from "./routes/employees.js";
import attendance from "./routes/attendance.js";
import leaves from "./routes/leaves.js";
import reimbursements from "./routes/reimbursements.js";
import dashboard from "./routes/dashboard.js";
import auth from "./routes/auth.js";
import profile from "./routes/profile.js";
import notifications from "./routes/notifications.js";
import search from "./routes/search.js";
import payroll from "./routes/payroll.js";
import auditLogs from "./routes/auditLogs.js";
import { authorize } from "./middleware/authorize.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin.split(","), credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  // Behind a proxy (Render, Nginx...) this makes rate limiting see the real client IP.
  app.set("trust proxy", 1);

  app.get("/api/health", async (req, res) => {
    await query("SELECT 1");
    res.json({ status: "ok" });
  });

  // Public
  app.use("/api/auth", auth);

  // Everything below needs a signed-in user.
  app.use("/api", requireAuth);
  app.use("/api/profile", profile);
  app.use("/api/notifications", notifications);
  app.use("/api/search", search);
  app.use("/api/departments", departments);
  app.use("/api/employees", employees);
  app.use("/api/attendance", attendance);
  app.use("/api/leaves", leaves);
  app.use("/api/reimbursements", reimbursements);
  app.use("/api/dashboard", dashboard);
  app.use("/api/payroll", payroll);
  app.use("/api/audit-logs", authorize("admin"), auditLogs);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
