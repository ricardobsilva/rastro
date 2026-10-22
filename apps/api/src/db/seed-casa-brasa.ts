import type { Db } from './index.js';
import { CHECKLISTS, EMPLOYEES } from './casa-brasa-data.js';
import { ITEMS } from './seed-data.js';

/** Restaurante fictício completo (equipe, itens e listas). Só para testes e demonstração local, nunca em produção. */
export function seedCasaBrasa(db: Db): void {
  const insEmp = db.prepare(
    'INSERT OR IGNORE INTO employees (id, name, role, grp, pin, color, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const insItem = db.prepare(
    'INSERT OR IGNORE INTO items (id, name, description, category, required, allow_note, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const insCl = db.prepare(
    'INSERT OR IGNORE INTO checklists (id, name, description, period, days, due_time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
  );
  const insClItem = db.prepare('INSERT OR IGNORE INTO checklist_items (checklist_id, item_id, position) VALUES (?, ?, ?)');
  const insClRole = db.prepare('INSERT OR IGNORE INTO checklist_roles (checklist_id, grp) VALUES (?, ?)');
  const insClEmp = db.prepare('INSERT OR IGNORE INTO checklist_employees (checklist_id, employee_id) VALUES (?, ?)');

  db.transaction(() => {
    for (const e of EMPLOYEES) {
      insEmp.run(e.id, e.name, e.role, e.grp, e.pin ?? null, e.color, e.active === false ? 0 : 1);
    }
    for (const i of ITEMS) {
      insItem.run(i.id, i.name, i.description, i.category, +i.required, +i.allowNote, +i.active);
    }
    for (const c of CHECKLISTS) {
      insCl.run(c.id, c.name, c.description, c.period, JSON.stringify(c.days), c.dueTime);
      c.items.forEach((itemId, position) => insClItem.run(c.id, itemId, position));
      c.roles.forEach((grp) => insClRole.run(c.id, grp));
      c.employees.forEach((empId) => insClEmp.run(c.id, empId));
    }
  })();
}
