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
`;
