import type { Period } from '@rastro/domain';
import type { Db, Stmt } from '../db/index.js';

export type ChecklistConfig = {
  id: string; name: string; description: string; period: Period; days: number[]; dueTime: string | null; active: boolean;
  itemIds: string[]; employeeIds: string[];
};

export type ItemConfig = {
  id: string; name: string; description: string; category: string; required: boolean; allowNote: boolean; active: boolean;
};

type ChecklistRow = { id: string; name: string; description: string; period: Period; days: string; due_time: string | null; active: number };
type ItemRow = { id: string; name: string; description: string; category: string; required: number; allow_note: number; active: number };

const CONFIG_QUERIES = {
  checklists: 'SELECT * FROM checklists ORDER BY rowid',
  checklistItems: 'SELECT checklist_id, item_id FROM checklist_items ORDER BY checklist_id, position',
  checklistEmployees: 'SELECT checklist_id, employee_id FROM checklist_employees ORDER BY rowid',
  items: 'SELECT * FROM items ORDER BY rowid',
  employees: 'SELECT id, grp, active FROM employees ORDER BY rowid',
};

export type Config = {
  checklists: ChecklistConfig[];
  items: ItemConfig[];
  employees: { id: string; group: string; active: boolean }[];
};

/**
 * Checklists, itens e equipe numa única ida ao banco.
 * `extra`: leituras adicionais que vão no mesmo lote; os resultados voltam em `extra`.
 */
export async function loadConfig(db: Db, extra: Stmt[] = []): Promise<Config & { extra: unknown[][] }> {
  const [cl, ci, ce, it, em, ...rest] = await db.readMany([
    ...Object.values(CONFIG_QUERIES).map((sql) => ({ sql, args: [] })),
    ...extra,
  ]);
  return {
    checklists: toChecklists(cl as ChecklistRow[], ci as ChecklistItemRow[], ce as ChecklistEmployeeRow[]),
    items: (it as ItemRow[]).map(toItem),
    employees: toAssignment(em as EmployeeAssignmentRow[]),
    extra: rest,
  };
}

type ChecklistItemRow = { checklist_id: string; item_id: string };
type ChecklistEmployeeRow = { checklist_id: string; employee_id: string };
type EmployeeAssignmentRow = { id: string; grp: string; active: number };

export async function loadChecklists(db: Db): Promise<ChecklistConfig[]> {
  const q = CONFIG_QUERIES;
  const [rows, items, emps] = await db.readMany([q.checklists, q.checklistItems, q.checklistEmployees].map((sql) => ({ sql, args: [] })));
  return toChecklists(rows as ChecklistRow[], items as ChecklistItemRow[], emps as ChecklistEmployeeRow[]);
}

function toChecklists(rows: ChecklistRow[], items: ChecklistItemRow[], emps: ChecklistEmployeeRow[]): ChecklistConfig[] {
  return rows.map((r) => ({
    id: r.id, name: r.name, description: r.description, period: r.period, days: JSON.parse(r.days) as number[],
    dueTime: r.due_time, active: !!r.active,
    itemIds: items.filter((i) => i.checklist_id === r.id).map((i) => i.item_id),
    employeeIds: emps.filter((x) => x.checklist_id === r.id).map((x) => x.employee_id),
  }));
}

export const toItem = (r: ItemRow): ItemConfig => ({
  id: r.id, name: r.name, description: r.description, category: r.category,
  required: !!r.required, allowNote: !!r.allow_note, active: !!r.active,
});

export async function loadItems(db: Db): Promise<ItemConfig[]> {
  return ((await db.prepare(CONFIG_QUERIES.items).all()) as ItemRow[]).map(toItem);
}

const toAssignment = (rows: EmployeeAssignmentRow[]) => rows.map((e) => ({ id: e.id, group: e.grp, active: !!e.active }));

export async function loadEmployeesForAssignment(db: Db) {
  return toAssignment((await db.prepare(CONFIG_QUERIES.employees).all()) as EmployeeAssignmentRow[]);
}
