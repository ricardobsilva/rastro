export const SCHEMA = `
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  grp TEXT NOT NULL,
  pin TEXT UNIQUE,
  color TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  allow_note INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL CHECK (period IN ('daily','weekdays','weekly','ondemand')),
  days TEXT NOT NULL DEFAULT '[]',
  due_time TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS checklist_items (
  checklist_id TEXT NOT NULL REFERENCES checklists(id),
  item_id TEXT NOT NULL REFERENCES items(id),
  position INTEGER NOT NULL,
  PRIMARY KEY (checklist_id, item_id)
);

CREATE TABLE IF NOT EXISTS checklist_roles (
  checklist_id TEXT NOT NULL REFERENCES checklists(id),
  grp TEXT NOT NULL,
  PRIMARY KEY (checklist_id, grp)
);

CREATE TABLE IF NOT EXISTS checklist_employees (
  checklist_id TEXT NOT NULL REFERENCES checklists(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  PRIMARY KEY (checklist_id, employee_id)
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  authorized_by TEXT NOT NULL REFERENCES employees(id),
  created_at TEXT NOT NULL,
  employee_id TEXT REFERENCES employees(id),
  session_since TEXT
);

-- Instância diária: um checklist executado por um funcionário num dia operacional.
-- Guarda snapshot de nome e prazo; dias anteriores nunca são ressincronizados.
CREATE TABLE IF NOT EXISTS executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op_date TEXT NOT NULL,
  checklist_id TEXT NOT NULL REFERENCES checklists(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  checklist_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_time TEXT,
  started_manually INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  UNIQUE (op_date, checklist_id, employee_id)
);

CREATE TABLE IF NOT EXISTS execution_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id INTEGER NOT NULL REFERENCES executions(id),
  item_id TEXT NOT NULL REFERENCES items(id),
  item_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  required INTEGER NOT NULL,
  allow_note INTEGER NOT NULL,
  position INTEGER NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  done INTEGER NOT NULL DEFAULT 0,
  done_at INTEGER,
  undone_at INTEGER,
  note TEXT NOT NULL DEFAULT '',
  UNIQUE (execution_id, item_id)
);

-- Log de auditoria append-only: nunca há UPDATE nem DELETE nesta tabela.
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op_date TEXT NOT NULL,
  minute INTEGER NOT NULL,
  at TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  employee_name TEXT NOT NULL,
  execution_id INTEGER REFERENCES executions(id),
  checklist_id TEXT NOT NULL,
  checklist_name TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('done','undone','note')),
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS audit_events_date ON audit_events (op_date, minute);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
`;
