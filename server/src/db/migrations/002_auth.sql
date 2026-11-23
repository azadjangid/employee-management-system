-- Login: hashed passwords and password reset tokens.

ALTER TABLE employees
  ADD COLUMN password_hash       TEXT,
  ADD COLUMN password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN last_login_at       TIMESTAMPTZ;

CREATE TABLE password_reset_tokens (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_employee_idx ON password_reset_tokens (employee_id);
