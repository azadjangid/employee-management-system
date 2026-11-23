# EmployeeHub API

REST API for the EmployeeHub frontend. **Node.js + Express 5 + PostgreSQL** (plain SQL via `pg`, validation with `zod`).

## Setup

1. **Start PostgreSQL** (pick one):
   - Docker: from the project root run `docker compose up -d`
   - Or install PostgreSQL 14+ locally and create a database: `createdb ems`
2. **Configure**: copy `.env.example` to `.env` and adjust `DATABASE_URL` if your user/password differ.
3. **Install and seed**:
   ```bash
   cd server
   npm install
   npm run db:reset   # drops everything, runs migrations, loads demo data
   npm run dev        # http://localhost:5000
   ```

The server also applies pending migrations on start, so `npm run migrate` is only needed if you want to run them by hand.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with auto-reload (nodemon) |
| `npm start` | Start without reload |
| `npm run migrate` | Apply new files in `src/db/migrations/` |
| `npm run seed` | Wipe data tables and load demo data |
| `npm run db:reset` | Drop all tables, migrate, seed |
| `npm test` | Run the API tests against the `ems_test` database (`createdb ems_test` first, or set `TEST_DATABASE_URL`) |

## Conventions

- JSON in and out, camelCase fields. Dates are `YYYY-MM-DD`, times are `HH:MM` (24h; the API also accepts `09:05 AM`).
- Lists return `{ data: [...], meta: { page, limit, total, totalPages } }` and accept `?page=&limit=` (max 100).
- Single records return `{ data: {...} }`.
- Errors return `{ error: { message, details? } }` with 400 (validation), 404, 409 (duplicate / conflict) or 500.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | DB connectivity check (public) |
| POST | `/api/auth/login` | `{ email, password, rememberMe? }` → sets the `ems_token` cookie, returns `{ user, token }` (public, rate limited) |
| POST | `/api/auth/logout` | Clears the cookie |
| GET | `/api/auth/me` | The signed-in user |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }`; signs out other sessions |
| POST | `/api/auth/forgot-password` | `{ email }`; emails a 1 hour reset link (public, rate limited) |
| POST | `/api/auth/reset-password` | `{ token, password }` (public) |
| GET/PUT | `/api/profile` | Own record. PUT accepts `firstName`, `lastName`, `email`, `phone`, `location` |
| GET | `/api/search?q=` | Top-bar search across employees, leaves and reimbursements (scoped) |
| GET | `/api/notifications` | Latest notifications + `meta.unread` |
| POST | `/api/notifications/:id/read`, `/api/notifications/read-all` | Mark as read |
| GET | `/api/leaves/summary` | Count and days per status |
| GET | `/api/dashboard` | Stats, last 7 days attendance, department split, recent employees, pending leaves |
| GET/POST | `/api/departments` | `{ name, description?, headId? }`; list includes `headName`, `employeeCount`, `activeCount` |
| GET/PUT/DELETE | `/api/departments/:id` | Deleting a department un-assigns its employees |
| GET | `/api/employees` | `search`, `status`, `department` or `departmentId`, `sort` (`name`/`joiningDate`/`createdAt`), `order` |
| POST | `/api/employees` | `name` (or `firstName`/`lastName`), `email` required; `department` by name or `departmentId`; `employeeCode` auto-generated |
| GET/PUT/DELETE | `/api/employees/:id` | PUT is partial. Delete cascades to attendance, leaves and reimbursements |
| GET | `/api/attendance` | `date`, `from`, `to`, `employeeId`, `department`, `status`, `search` |
| GET | `/api/attendance/summary?date=` | Count per status for a day (default today) |
| POST | `/api/attendance` | One record per employee per day (409 if it exists) |
| GET/PUT/DELETE | `/api/attendance/:id` | |
| GET | `/api/leaves` | `status`, `leaveType`, `employeeId`, `department`, `search`, `from`, `to` |
| POST | `/api/leaves` | `days` is computed; overlapping requests are rejected (409) |
| GET/PUT/DELETE | `/api/leaves/:id` | Only pending requests can be edited |
| PATCH | `/api/leaves/:id/status` | `{ "status": "Approved" \| "Rejected" }`, pending only |
| GET | `/api/reimbursements` | `status`, `category`, `employeeId`, `department`, `search`, `from`, `to` |
| GET | `/api/reimbursements/summary` | Count and total per status |
| POST | `/api/reimbursements` | |
| GET/PUT/DELETE | `/api/reimbursements/:id` | Only pending claims can be edited |
| PATCH | `/api/reimbursements/:id/status` | Pending → Approved/Rejected, Approved → Paid |
| POST | `/api/reimbursements/:id/receipt` | `multipart/form-data`, field `receipt`: PDF, JPG, PNG or WebP up to 5 MB. Replaces any earlier file |
| GET | `/api/reimbursements/:id/receipt` | The file (inline; add `?download=1` to download) |
| DELETE | `/api/reimbursements/:id/receipt` | Remove the file |
| GET | `/api/payroll/salaries` | Admin. Salary structure for everyone not Inactive |
| PUT | `/api/payroll/salaries/:employeeId` | Admin. `{ basic, hra, allowances, pf, professionalTax, tds }` (monthly ₹) |
| GET/POST | `/api/payroll/runs` | Admin. POST `{ month: "YYYY-MM" }` creates a draft run with payslips (409 if the month exists) |
| GET/DELETE | `/api/payroll/runs/:id` | Admin. GET includes `payslips`; only drafts can be deleted |
| POST | `/api/payroll/runs/:id/recalculate` | Admin. Rebuild a draft's payslips |
| POST | `/api/payroll/runs/:id/pay` | Admin. Lock the run, mark its reimbursements Paid, notify employees |
| GET | `/api/payroll/payslips` | Own payslips from paid runs (admins may pass `?employeeId=`) |
| GET | `/api/payroll/payslips/:id` | One payslip |
| GET | `/api/audit-logs` | Admin. `search`, `actorId`, `entityType`, `action` (prefix, e.g. `leave`), `from`, `to` |
| GET | `/api/audit-logs/facets` | Admin. Entity types and actions for the filter dropdowns |

## Authentication

- Passwords are hashed with bcrypt. Logins get a JWT stored in an **httpOnly cookie** (`ems_token`, SameSite=Lax), so page scripts can't read it. Scripts and Postman can send `Authorization: Bearer <token>` instead (the token is in the login response).
- Without "remember me" the cookie lasts until the browser closes (token valid `JWT_EXPIRES_IN`, default 12h). With it, `REMEMBER_ME_EXPIRES_IN` (default 7d).
- Changing or resetting a password invalidates every older token. Setting an employee to `Inactive` blocks them immediately.
- Every route except `/api/health` and the public auth routes requires a login.
- Demo logins after `npm run seed`: `admin@employeehub.com` / `admin123`, and every other seeded employee / `password123`.
- **Email:** no provider is wired up yet. Reset emails are printed to the server console, and outside production the forgot-password response also includes `devResetUrl` so you can test the flow. Plug a provider into `src/lib/mailer.js` before going live.
- **Production:** set `NODE_ENV=production` and a long random `JWT_SECRET` (the server refuses to start without one), and serve over HTTPS.

## Notifications

Created automatically: a new leave or claim notifies the admins and the department's manager; an approval, rejection or payment notifies the employee. The frontend polls `/api/notifications` every minute.

## Payroll

All amounts are monthly, in INR.

- **Gross** = basic + HRA + allowances.
- **Working days** = days in the month except Sundays.
- **Loss of pay** = gross ÷ working days × days marked Absent that aren't covered by approved leave.
- **Net pay** = gross − (loss of pay + PF + professional tax + TDS) + approved reimbursements, never below 0.

Approved reimbursements dated up to the end of the month are reserved by the run and become Paid when the run is paid. Active employees without a salary are left out. Seeding creates salaries for everyone and a paid run for last month.

## Receipts

Files are stored on disk under `UPLOAD_DIR/receipts` (default `server/uploads/receipts`) with random names; the database keeps the original name, type and size. The file's first bytes must match its type. Only people who can see the claim can download it. Employees and managers can change a receipt while the claim is pending; admins at any time. For several servers, or hosts with a temporary disk (Render, Heroku), move storage to S3 or similar in `src/lib/uploads.js`.

## Audit log

Every change is recorded in `audit_logs`: who, what (`action` like `leave.approve`), a readable summary, before/after values for edits, and the IP. Sign-ins and failed sign-ins are logged too. Passwords are never logged. The log is read-only from the app.

## Roles

Every employee has a `role`: `admin`, `manager` or `employee`. Only admins can change it (`PUT /api/employees/:id { "role": "manager" }`), and the last active admin can't be demoted, deactivated or deleted.

| | admin | manager | employee |
| --- | --- | --- | --- |
| Sees | everyone | their own department | only themselves |
| Employees | full CRUD, set roles/passwords | read their department | – (uses `/api/profile`) |
| Departments | full CRUD | read | read |
| Attendance | record/edit anyone | record/edit their department | view own, `POST /check-in`, `POST /check-out`, `GET /today` |
| Leaves & reimbursements | everything, can approve own | approve/reject their department (not their own) | file, edit and cancel own pending requests |
| Mark reimbursement Paid | ✓ | – | – |
| Payroll and salaries | ✓ | – | – |
| Own payslips (paid runs) | ✓ | ✓ | ✓ |
| Audit log | ✓ | – | – |
| Dashboard (`scope` in response) | `company` | `department` | `self` |

Records outside your scope return 404 (so the API doesn't reveal they exist). Actions your role can't do return 403. Requests default to the signed-in user when `employeeId` is left out.

Seeded roles: admin `admin@employeehub.com`; managers `sneha.joshi@example.com` (HR), `karan.shah@example.com` (Sales), `amit.patel@example.com` (Engineering); everyone else is an employee.

## Schema

`src/db/migrations/`: `001_core.sql` (departments, employees, attendance, leaves, reimbursements), `002_auth.sql` (password hash, reset tokens), `003_roles.sql` (role, reviewed_by), `004_notifications.sql`, `005_payroll_audit_receipts.sql` (department heads, salaries, payroll runs, payslips, receipt files, audit log). New changes go in a new numbered file (`002_...sql`); never edit one that has already run.
