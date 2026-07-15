-- ============================================================
-- Supplier Cheque Management System - Database Schema (SQLite)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone         TEXT NOT NULL,            -- receives SMS alerts
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  contact_person TEXT,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  bank_name      TEXT,
  notes          TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,   -- soft delete keeps history intact
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchases (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id   INTEGER NOT NULL REFERENCES suppliers(id),
  invoice_no    TEXT,
  description   TEXT,
  total_amount  REAL NOT NULL CHECK (total_amount > 0),
  purchase_date TEXT NOT NULL,                 -- YYYY-MM-DD
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date     ON purchases(purchase_date);

-- Cheque lifecycle: issued -> pending -> partially_paid -> cleared | bounced | cancelled
CREATE TABLE IF NOT EXISTS cheques (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  cheque_number TEXT NOT NULL UNIQUE,          -- duplicate cheque numbers rejected
  supplier_id   INTEGER NOT NULL REFERENCES suppliers(id),
  amount        REAL NOT NULL CHECK (amount > 0),
  issue_date    TEXT NOT NULL,
  due_date      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'issued'
                CHECK (status IN ('issued','pending','partially_paid','cleared','bounced','cancelled')),
  bank_name     TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cheques_supplier ON cheques(supplier_id);
CREATE INDEX IF NOT EXISTS idx_cheques_due      ON cheques(due_date);
CREATE INDEX IF NOT EXISTS idx_cheques_status   ON cheques(status);

-- Partial payments: a purchase may be settled by many cheques, and a cheque
-- may cover several purchases. Allocations track exactly how much of each
-- cheque is applied to each purchase.
CREATE TABLE IF NOT EXISTS cheque_allocations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  cheque_id        INTEGER NOT NULL REFERENCES cheques(id) ON DELETE CASCADE,
  purchase_id      INTEGER NOT NULL REFERENCES purchases(id),
  allocated_amount REAL NOT NULL CHECK (allocated_amount > 0),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alloc_cheque   ON cheque_allocations(cheque_id);
CREATE INDEX IF NOT EXISTS idx_alloc_purchase ON cheque_allocations(purchase_id);

-- Daily sales revenue entries; every entry auto-records a deposit into savings
CREATE TABLE IF NOT EXISTS revenue_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL,
  amount     REAL NOT NULL CHECK (amount > 0),
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_revenue_date ON revenue_entries(entry_date);

-- Single designated savings account with running-balance ledger
CREATE TABLE IF NOT EXISTS savings_transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL CHECK (type IN ('deposit','cheque_clearance','adjustment')),
  amount        REAL NOT NULL,                -- positive = in, negative = out
  balance_after REAL NOT NULL,
  reference     TEXT,                         -- e.g. revenue entry id / cheque number
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sms_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient    TEXT NOT NULL,
  message      TEXT NOT NULL,
  category     TEXT NOT NULL,                 -- due_7 | due_3 | due_1 | overdue | cleared | bounced | test
  cheque_id    INTEGER REFERENCES cheques(id),
  status       TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','failed')),
  provider_ref TEXT,
  error        TEXT,
  sent_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Guard so the same due-date reminder is never sent twice for one cheque
CREATE TABLE IF NOT EXISTS alerts_sent (
  cheque_id INTEGER NOT NULL REFERENCES cheques(id) ON DELETE CASCADE,
  category  TEXT NOT NULL,
  sent_on   TEXT NOT NULL DEFAULT (date('now')),
  PRIMARY KEY (cheque_id, category)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  action      TEXT NOT NULL,                  -- create | update | delete | login | status_change ...
  entity_type TEXT NOT NULL,                  -- supplier | cheque | purchase | revenue | settings ...
  entity_id   INTEGER,
  details     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
