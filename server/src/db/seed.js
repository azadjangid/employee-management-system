/**
 * Fills the database with demo data (the same people the UI used to hard-code).
 * Dates are relative to today so the dashboard always has recent activity.
 * Safe to re-run: it wipes the data tables first.
 */
import { fileURLToPath } from "node:url";
import { pool, withTransaction } from "./pool.js";
import { migrate } from "./migrate.js";
import { hashPassword } from "../lib/auth.js";
import { generatePayslips, monthRange } from "../lib/payroll.js";

// Demo logins. Everyone except the admin uses DEMO_PASSWORD.
export const ADMIN_PASSWORD = "admin123";
export const DEMO_PASSWORD = "password123";

const DEPARTMENTS = [
  ["Engineering", "Builds and maintains our products"],
  ["Design", "Product and visual design"],
  ["HR", "People operations and recruitment"],
  ["Sales", "Customer acquisition"],
  ["Marketing", "Brand and growth"],
  ["Administration", "Company administration"],
];

// [first, last, email, phone, designation, department, status, joiningDate, location]
const EMPLOYEES = [
  ["Admin", "User", "admin@employeehub.com", "+91 98765 43200", "HR Administrator", "Administration", "Active", "2024-01-15", "Pune, Maharashtra"],
  ["Rahul", "Sharma", "rahul.sharma@example.com", "+91 98765 43210", "Frontend Developer", "Engineering", "Active", "2025-01-15", "Pune, Maharashtra"],
  ["Priya", "Mehta", "priya.mehta@example.com", "+91 98765 43211", "UI/UX Designer", "Design", "Active", "2024-11-10", "Mumbai, Maharashtra"],
  ["Amit", "Patel", "amit.patel@example.com", "+91 98765 43212", "Engineering Lead", "Engineering", "Active", "2025-02-20", "Ahmedabad, Gujarat"],
  ["Neha", "Singh", "neha.singh@example.com", "+91 98765 43213", "HR Executive", "HR", "On Leave", "2024-08-05", "Delhi"],
  ["Vikas", "Kumar", "vikas.kumar@example.com", "+91 98765 43214", "Sales Executive", "Sales", "Active", "2025-03-12", "Jaipur, Rajasthan"],
  ["Anjali", "Verma", "anjali.verma@example.com", "+91 98765 43215", "Marketing Executive", "Marketing", "Active", "2025-04-01", "Bengaluru, Karnataka"],
  ["Rohit", "Gupta", "rohit.gupta@example.com", "+91 98765 43216", "QA Engineer", "Engineering", "Inactive", "2023-12-18", "Pune, Maharashtra"],
  ["Sneha", "Joshi", "sneha.joshi@example.com", "+91 98765 43217", "HR Manager", "HR", "Active", "2023-06-22", "Pune, Maharashtra"],
  ["Karan", "Shah", "karan.shah@example.com", "+91 98765 43218", "Sales Manager", "Sales", "Active", "2022-10-14", "Surat, Gujarat"],
  ["Pooja", "Nair", "pooja.nair@example.com", "+91 98765 43219", "Product Designer", "Design", "On Leave", "2024-05-30", "Kochi, Kerala"],
];

// Everyone else is a plain employee. Managers see their own department.
const ROLES_BY_EMAIL = {
  "admin@employeehub.com": "admin",
  "sneha.joshi@example.com": "manager", // HR
  "karan.shah@example.com": "manager", // Sales
  "amit.patel@example.com": "manager", // Engineering
};

// Monthly basic pay by email; HRA, allowances and deductions are derived from it.
const BASIC_BY_EMAIL = {
  "admin@employeehub.com": 60000,
  "rahul.sharma@example.com": 45000,
  "priya.mehta@example.com": 42000,
  "amit.patel@example.com": 80000,
  "neha.singh@example.com": 32000,
  "vikas.kumar@example.com": 30000,
  "anjali.verma@example.com": 33000,
  "rohit.gupta@example.com": 38000,
  "sneha.joshi@example.com": 65000,
  "karan.shah@example.com": 70000,
  "pooja.nair@example.com": 44000,
};

// Department heads (the managers, plus the admin for Administration).
const HEADS = {
  Engineering: "amit.patel@example.com",
  HR: "sneha.joshi@example.com",
  Sales: "karan.shah@example.com",
  Administration: "admin@employeehub.com",
};

// [email, type, fromOffsetDays, length, reason, status, appliedOffsetDays]
const LEAVES = [
  ["rahul.sharma@example.com", "Casual Leave", 5, 2, "Personal work", "Pending", -3],
  ["priya.mehta@example.com", "Sick Leave", -4, 1, "Not feeling well", "Approved", -5],
  ["amit.patel@example.com", "Earned Leave", 10, 3, "Family vacation", "Pending", -2],
  ["neha.singh@example.com", "Casual Leave", -1, 3, "Personal work", "Approved", -8],
  ["vikas.kumar@example.com", "Sick Leave", -9, 1, "Fever", "Rejected", -10],
  ["anjali.verma@example.com", "Earned Leave", 15, 3, "Travel", "Pending", -1],
  ["pooja.nair@example.com", "Earned Leave", -2, 5, "Family function", "Approved", -12],
];

// [email, category, amount, offsetDays, description, status, paymentMethod, receipt]
const REIMBURSEMENTS = [
  ["rahul.sharma@example.com", "Travel", 12500, -3, "Client meeting travel expenses", "Pending", "Bank Transfer", "travel-receipt.pdf"],
  ["priya.mehta@example.com", "Food", 2450, -5, "Team lunch expenses", "Approved", "Bank Transfer", "food-receipt.jpg"],
  ["amit.patel@example.com", "Internet", 1800, -8, "Monthly internet reimbursement", "Paid", "Bank Transfer", "internet-bill.pdf"],
  ["neha.singh@example.com", "Travel", 6800, -10, "Travel for recruitment event", "Rejected", "Bank Transfer", "travel-bill.pdf"],
  ["vikas.kumar@example.com", "Equipment", 9500, -13, "Purchase of external monitor", "Approved", "Company Card", "monitor-invoice.pdf"],
  ["anjali.verma@example.com", "Office Supplies", 3200, -16, "Office stationery purchase", "Pending", "Cash", "stationery.pdf"],
];

const addDays = (base, n) => {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Small deterministic PRNG so re-seeding gives the same attendance.
function rng(seed) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

export async function seed({ log = console.log } = {}) {
  await migrate({ log: () => {} });
  const today = new Date().toISOString().slice(0, 10);

  await withTransaction(async (db) => {
    await db.query(
      "TRUNCATE audit_logs, payslips, payroll_runs, salaries, notifications, password_reset_tokens, reimbursements, leaves, attendance, employees, departments RESTART IDENTITY CASCADE"
    );

    const deptIds = {};
    for (const [name, description] of DEPARTMENTS) {
      const { rows } = await db.query(
        "INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING id",
        [name, description]
      );
      deptIds[name] = rows[0].id;
    }

    const empIds = {};
    for (const [i, e] of EMPLOYEES.entries()) {
      const [first, last, email, phone, designation, dept, status, joining, location] = e;
      const { rows } = await db.query(
        `INSERT INTO employees (employee_code, first_name, last_name, email, phone, designation,
           department_id, status, joining_date, location, created_at, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9::date, $11, $12)
         RETURNING id`,
        [`EMP${String(i + 1).padStart(3, "0")}`, first, last, email, phone, designation,
          deptIds[dept], status, joining, location,
          await hashPassword(i === 0 ? ADMIN_PASSWORD : DEMO_PASSWORD),
          ROLES_BY_EMAIL[email] ?? "employee"]
      );
      empIds[email] = rows[0].id;
    }

    // Attendance for the last 14 days (skipping Sundays) for active staff.
    const rand = rng(42);
    const active = EMPLOYEES.filter((e) => e[6] !== "Inactive");
    let attendanceCount = 0;
    for (let offset = -13; offset <= 0; offset++) {
      const day = addDays(today, offset);
      if (new Date(day).getUTCDay() === 0) continue;
      for (const e of active) {
        const r = rand();
        let status = "Present";
        let checkIn = `09:${String(Math.floor(rand() * 10)).padStart(2, "0")}`;
        let checkOut = `18:${String(Math.floor(rand() * 30)).padStart(2, "0")}`;
        if (e[6] === "On Leave" || r < 0.07) {
          status = "Absent";
          checkIn = checkOut = null;
        } else if (r < 0.17) {
          status = "Late";
          checkIn = `09:${String(20 + Math.floor(rand() * 30)).padStart(2, "0")}`;
        } else if (r < 0.22) {
          status = "Half Day";
          checkOut = "13:30";
        }
        await db.query(
          `INSERT INTO attendance (employee_id, date, check_in, check_out, status)
           VALUES ($1, $2, $3, $4, $5)`,
          [empIds[e[2]], day, checkIn, checkOut, status]
        );
        attendanceCount++;
      }
    }

    for (const [email, type, from, len, reason, status, applied] of LEAVES) {
      await db.query(
        `INSERT INTO leaves (employee_id, leave_type, from_date, to_date, reason, status,
           applied_on, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $6 <> 'Pending' THEN now() END)`,
        [empIds[email], type, addDays(today, from), addDays(today, from + len - 1), reason,
          status, addDays(today, applied)]
      );
    }

    for (const [email, category, amount, offset, description, status, method, receipt] of REIMBURSEMENTS) {
      await db.query(
        `INSERT INTO reimbursements (employee_id, category, amount, expense_date, description,
           status, payment_method, receipt, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $6 <> 'Pending' THEN now() END)`,
        // Demo claims have no uploaded file, so no receipt name either.
        [empIds[email], category, amount, addDays(today, offset), description, status, method,
          receipt && null]
      );
    }

    // Bell notifications for requests still waiting on an approver.
    await db.query(`
      INSERT INTO notifications (recipient_id, title, body, link, created_at)
      SELECT a.id, 'New leave request',
             e.first_name || ' ' || e.last_name || ' requested ' || l.days || ' day(s) of ' || l.leave_type || '.',
             '/leaves', l.applied_on
      FROM leaves l
      JOIN employees e ON e.id = l.employee_id
      JOIN employees a ON a.id <> e.id
        AND (a.role = 'admin' OR (a.role = 'manager' AND a.department_id = e.department_id))
      WHERE l.status = 'Pending'`);
    await db.query(`
      INSERT INTO notifications (recipient_id, title, body, link, created_at)
      SELECT a.id, 'New reimbursement claim',
             e.first_name || ' ' || e.last_name || ' submitted a ₹' || r.amount::int || ' ' || r.category || ' claim.',
             '/reimbursements', r.expense_date
      FROM reimbursements r
      JOIN employees e ON e.id = r.employee_id
      JOIN employees a ON a.id <> e.id
        AND (a.role = 'admin' OR (a.role = 'manager' AND a.department_id = e.department_id))
      WHERE r.status = 'Pending'`);

    for (const [dept, email] of Object.entries(HEADS)) {
      await db.query("UPDATE departments SET head_id = $1 WHERE id = $2", [empIds[email], deptIds[dept]]);
    }

    for (const [email, basic] of Object.entries(BASIC_BY_EMAIL)) {
      const gross = basic * 1.7; // basic + 40% HRA + 30% allowances
      const tds = gross * 12 > 1_200_000 ? Math.round(basic * 0.1) : 0;
      await db.query(
        `INSERT INTO salaries (employee_id, basic, hra, allowances, pf, professional_tax, tds)
         VALUES ($1, $2, $3, $4, $5, 200, $6)`,
        [empIds[email], basic, basic * 0.4, basic * 0.3, Math.min(1800, basic * 0.12), tds]
      );
    }

    // A paid payroll run for last month, so payslips exist from the start.
    const now = new Date();
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const lastMonth = last.toISOString().slice(0, 7);
    const { start, workingDays } = monthRange(lastMonth);
    const { rows: runRows } = await db.query(
      `INSERT INTO payroll_runs (month, working_days, created_by, status, paid_at)
       VALUES ($1, $2, $3, 'Paid', now()) RETURNING id, month::text`,
      [start, workingDays, empIds["admin@employeehub.com"]]
    );
    await generatePayslips(db, runRows[0]);
    await db.query(
      "UPDATE reimbursements SET status = 'Paid' WHERE payroll_run_id = $1 AND status = 'Approved'",
      [runRows[0].id]
    );

    log(
      `Seeded ${DEPARTMENTS.length} departments, ${EMPLOYEES.length} employees, ` +
        `${attendanceCount} attendance records, ${LEAVES.length} leaves, ` +
        `${REIMBURSEMENTS.length} reimbursements.\n` +
        `Sign in as admin@employeehub.com / ${ADMIN_PASSWORD}. Managers: sneha.joshi, karan.shah, ` +
        `amit.patel @example.com; everyone else is an employee. Password for all of them: ${DEMO_PASSWORD}.`
    );
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
