import type { Period } from '@rastro/domain';
import type { Db } from '../db/index.js';

export type ChecklistConfig = {
  id: string; name: string; description: string; period: Period; days: number[]; dueTime: string | null; active: boolean;
  itemIds: string[]; roles: string[]; employeeIds: string[];
};

export type ItemConfig = {
  id: string; name: string; description: string; category: string; required: boolean; allowNote: boolean; active: boolean;
};

type ChecklistRow = { id: string; name: string; description: string; period: Period; days: string; due_time: string | null; active: number };
type ItemRow = { id: string; name: string; description: string; category: string; required: number; allow_note: number; active: number };

export function loadChecklists(db: Db): ChecklistConfig[] {
  const rows = db.prepare('SELECT * FROM checklists ORDER BY rowid').all() as ChecklistRow[];
  const items = db.prepare('SELECT checklist_id, item_id FROM checklist_items ORDER BY checklist_id, position').all() as { checklist_id: string; item_id: string }[];
  const roles = db.prepare('SELECT checklist_id, grp FROM checklist_roles ORDER BY rowid').all() as { checklist_id: string; grp: string }[];
  const emps = db.prepare('SELECT checklist_id, employee_id FROM checklist_employees ORDER BY rowid').all() as { checklist_id: string; employee_id: string }[];
  return rows.map((r) => ({
    id: r.id, name: r.name, description: r.description, period: r.period, days: JSON.parse(r.days) as number[],
    dueTime: r.due_time, active: !!r.active,
    itemIds: items.filter((i) => i.checklist_id === r.id).map((i) => i.item_id),
    roles: roles.filter((x) => x.checklist_id === r.id).map((x) => x.grp),
    employeeIds: emps.filter((x) => x.checklist_id === r.id).map((x) => x.employee_id),
  }));
}

export const toItem = (r: ItemRow): ItemConfig => ({
  id: r.id, name: r.name, description: r.description, category: r.category,
  required: !!r.required, allowNote: !!r.allow_note, active: !!r.active,
});

export function loadItems(db: Db): ItemConfig[] {
  return (db.prepare('SELECT * FROM items ORDER BY rowid').all() as ItemRow[]).map(toItem);
}

export function loadEmployeesForAssignment(db: Db) {
  return (db.prepare('SELECT id, grp, active FROM employees').all() as { id: string; grp: string; active: number }[]).map((e) => ({
    id: e.id, group: e.grp, active: !!e.active,
  }));
}
