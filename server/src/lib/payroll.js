/**
 * Payroll calculation. All amounts are monthly, in INR.
 *
 *   gross       = basic + hra + allowances
 *   LOP days    = days marked Absent in the month that aren't covered by approved leave
 *   LOP         = gross / working days × LOP days
 *   deductions  = LOP + PF + professional tax + TDS
 *   net pay     = gross − deductions + approved reimbursements paid with this run
 *
 * Working days are the days in the month except Sundays.
 */

/** "2026-11" -> { start: "2026-11-01", end: "2026-11-30", workingDays } */
export function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0) workingDays++;
  }
  const pad = (n) => String(n).padStart(2, "0");
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(daysInMonth)}`,
    workingDays,
  };
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Create the payslips for a run inside an open transaction `db`.
 * Also reserves approved, not-yet-paid reimbursements for this run.
 * Returns the number of payslips created.
 */
export async function generatePayslips(db, run) {
  const { start, end, workingDays } = monthRange(run.month.slice(0, 7));

  const { rows: people } = await db.query(
    `SELECT e.id, s.basic, s.hra, s.allowances, s.pf, s.professional_tax, s.tds,
            (SELECT count(*)::int FROM attendance a
              WHERE a.employee_id = e.id AND a.status = 'Absent'
                AND a.date BETWEEN $1 AND $2
                AND NOT EXISTS (
                  SELECT 1 FROM leaves l
                  WHERE l.employee_id = e.id AND l.status = 'Approved'
                    AND a.date BETWEEN l.from_date AND l.to_date)) AS lop_days
     FROM employees e
     JOIN salaries s ON s.employee_id = e.id
     WHERE e.status <> 'Inactive' AND e.joining_date <= $2
     ORDER BY e.id`,
    [start, end]
  );

  // Approved claims up to the end of the month that haven't been paid yet.
  const { rows: claims } = await db.query(
    `UPDATE reimbursements SET payroll_run_id = $1, updated_at = now()
     WHERE status = 'Approved' AND payroll_run_id IS NULL AND expense_date <= $2
       AND employee_id = ANY($3)
     RETURNING employee_id, amount`,
    [run.id, end, people.map((p) => p.id)]
  );
  const claimTotals = {};
  for (const c of claims) claimTotals[c.employee_id] = (claimTotals[c.employee_id] ?? 0) + c.amount;

  for (const p of people) {
    const gross = round2(p.basic + p.hra + p.allowances);
    const lopDays = Math.min(p.lop_days, workingDays);
    const lop = round2((gross / workingDays) * lopDays);
    const deductions = round2(lop + p.pf + p.professional_tax + p.tds);
    const reimbursements = round2(claimTotals[p.id] ?? 0);
    const net = Math.max(0, round2(gross - deductions + reimbursements));
    await db.query(
      `INSERT INTO payslips (run_id, employee_id, basic, hra, allowances, gross, working_days,
         lop_days, lop_deduction, pf, professional_tax, tds, total_deductions, reimbursements, net_pay)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [run.id, p.id, p.basic, p.hra, p.allowances, gross, workingDays, lopDays, lop, p.pf,
        p.professional_tax, p.tds, deductions, reimbursements, net]
    );
  }
  return people.length;
}

/** Undo generatePayslips for a draft run (before regenerating or deleting it). */
export async function clearPayslips(db, runId) {
  await db.query("UPDATE reimbursements SET payroll_run_id = NULL WHERE payroll_run_id = $1", [runId]);
  await db.query("DELETE FROM payslips WHERE run_id = $1", [runId]);
}
