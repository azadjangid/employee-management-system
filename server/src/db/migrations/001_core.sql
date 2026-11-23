-- Core HR tables: departments, employees, attendance, leaves, reimbursements.

CREATE TABLE departments (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employees (
  id            SERIAL PRIMARY KEY,
  employee_code TEXT NOT NULL UNIQUE,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL,
  phone         TEXT,
  designation   TEXT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'Active'
                CHECK (status IN ('Active', 'Inactive', 'On Leave')),
  joining_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  location      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX employees_email_key ON employees (lower(email));
CREATE INDEX employees_department_idx ON employees (department_id);

CREATE TABLE attendance (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  check_in    TIME,
  check_out   TIME,
  status      TEXT NOT NULL
              CHECK (status IN ('Present', 'Late', 'Absent', 'Half Day')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date),
  CHECK (check_out IS NULL OR check_in IS NULL OR check_out >= check_in)
);
CREATE INDEX attendance_date_idx ON attendance (date);

CREATE TABLE leaves (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type  TEXT NOT NULL
              CHECK (leave_type IN ('Casual Leave', 'Sick Leave', 'Earned Leave')),
  from_date   DATE NOT NULL,
  to_date     DATE NOT NULL,
  days        INTEGER GENERATED ALWAYS AS (to_date - from_date + 1) STORED,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Pending'
              CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  applied_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (to_date >= from_date)
);
CREATE INDEX leaves_employee_idx ON leaves (employee_id);
CREATE INDEX leaves_status_idx ON leaves (status);

CREATE TABLE reimbursements (
  id             SERIAL PRIMARY KEY,
  employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category       TEXT NOT NULL
                 CHECK (category IN ('Travel', 'Food', 'Internet', 'Equipment',
                                     'Office Supplies', 'Medical', 'Other')),
  amount         NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  expense_date   DATE NOT NULL,
  description    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'Pending'
                 CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Paid')),
  payment_method TEXT NOT NULL DEFAULT 'Bank Transfer'
                 CHECK (payment_method IN ('Bank Transfer', 'Cash', 'Company Card')),
  receipt        TEXT,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reimbursements_employee_idx ON reimbursements (employee_id);
CREATE INDEX reimbursements_status_idx ON reimbursements (status);
