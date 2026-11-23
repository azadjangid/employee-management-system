-- Access roles. Managers see and act on people in their own department.
ALTER TABLE employees
  ADD COLUMN role TEXT NOT NULL DEFAULT 'employee'
  CHECK (role IN ('admin', 'manager', 'employee'));

-- Before roles existed the only way in was the admin account.
UPDATE employees SET role = 'admin' WHERE lower(email) = 'admin@employeehub.com';

-- Who approved / rejected a request.
ALTER TABLE leaves
  ADD COLUMN reviewed_by INTEGER REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE reimbursements
  ADD COLUMN reviewed_by INTEGER REFERENCES employees(id) ON DELETE SET NULL;
