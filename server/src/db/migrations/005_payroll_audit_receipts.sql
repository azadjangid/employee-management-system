-- Step 6: department heads, payroll, audit log, receipt uploads.

-- Departments: optional head (shown on the Departments page).
ALTER TABLE departments
  ADD COLUMN head_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
-- "Finance" and "finance" are the same department.
CREATE UNIQUE INDEX departments_name_lower_idx ON departments (lower(name));

-- Monthly salary structure per employee (amounts in INR).
CREATE TABLE salaries (
  employee_id      INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  basic            NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (basic >= 0),
  hra              NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (hra >= 0),
  allowances       NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
  pf               NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (pf >= 0),
  professional_tax NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (professional_tax >= 0),
  tds              NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tds >= 0),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One payroll run per month. Draft runs can be regenerated or deleted; paid runs are locked.
CREATE TABLE payroll_runs (
  id           SERIAL PRIMARY KEY,
  month        DATE NOT NULL UNIQUE CHECK (extract(day FROM month) = 1),
  status       TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Paid')),
  working_days INTEGER NOT NULL,
  created_by   INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payslips (
  id                SERIAL PRIMARY KEY,
  run_id            INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id       INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  basic             NUMERIC(12, 2) NOT NULL,
  hra               NUMERIC(12, 2) NOT NULL,
  allowances        NUMERIC(12, 2) NOT NULL,
  gross             NUMERIC(12, 2) NOT NULL,
  working_days      INTEGER NOT NULL,
  lop_days          INTEGER NOT NULL DEFAULT 0,
  lop_deduction     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pf                NUMERIC(12, 2) NOT NULL DEFAULT 0,
  professional_tax  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tds               NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_deductions  NUMERIC(12, 2) NOT NULL,
  reimbursements    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_pay           NUMERIC(12, 2) NOT NULL,
  UNIQUE (run_id, employee_id)
);
CREATE INDEX payslips_employee_idx ON payslips (employee_id);

-- Approved claims are paid out with payroll; remember which run paid them.
ALTER TABLE reimbursements
  ADD COLUMN payroll_run_id INTEGER REFERENCES payroll_runs(id) ON DELETE SET NULL,
  ADD COLUMN receipt_path   TEXT,
  ADD COLUMN receipt_mime   TEXT,
  ADD COLUMN receipt_size   INTEGER;

-- Who did what, when.
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  actor_name  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   INTEGER,
  summary     TEXT NOT NULL,
  changes     JSONB,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id);
