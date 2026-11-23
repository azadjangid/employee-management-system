-- In-app notifications (bell icon).
CREATE TABLE notifications (
  id           SERIAL PRIMARY KEY,
  recipient_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT,
  link         TEXT,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_recipient_idx ON notifications (recipient_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (recipient_id) WHERE read_at IS NULL;
