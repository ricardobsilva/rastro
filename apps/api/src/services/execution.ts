import { type OperationalNow, cardStatus, fmtMinute } from '@rastro/domain';
import type { Db } from '../db/index.js';
import { HttpError } from '../http.js';
import type { EmployeeRow } from '../repos/employees.js';
import { type ExecutionItemRow, type ExecutionRow, itemsOf } from './day.js';

const END_OF_DAY = Number.POSITIVE_INFINITY;

/** Carrega a execução do funcionário: 404 se não existe/está oculta, 403 se é de outra pessoa. */
export function ownExecution(db: Db, idParam: string, emp: EmployeeRow, today: string): ExecutionRow & { visible: number } {
  const id = Number(idParam);
  const exec = Number.isInteger(id)
    ? (db.prepare('SELECT * FROM executions WHERE id = ?').get(id) as (ExecutionRow & { visible: number }) | undefined)
    : undefined;
  if (!exec || (exec.op_date === today && !exec.visible)) throw new HttpError(404, 'Checklist não encontrado.');
  if (exec.employee_id !== emp.id) throw new HttpError(403, 'Este checklist pertence a outro funcionário.');
  return exec;
}

export function assertEditable(exec: ExecutionRow, today: string) {
  if (exec.op_date !== today) throw new HttpError(409, 'Este checklist é de um dia anterior.');
}

export function visibleItem(db: Db, exec: ExecutionRow, itemId: string): ExecutionItemRow {
  const item = db
    .prepare('SELECT * FROM execution_items WHERE execution_id = ? AND item_id = ? AND visible = 1')
    .get(exec.id, itemId) as ExecutionItemRow | undefined;
  if (!item) throw new HttpError(404, 'Item não encontrado neste checklist.');
  return item;
}

export function executionView(db: Db, exec: ExecutionRow, now: OperationalNow) {
  const items = itemsOf(db, exec, exec.op_date === now.date ? now.minute : END_OF_DAY);
  const done = items.filter((i) => i.status === 'done').length;
  return {
    id: exec.id, date: exec.op_date, checklistId: exec.checklist_id, name: exec.checklist_name, description: exec.description,
    dueTime: exec.due_time, done, total: items.length, status: cardStatus(items.map((i) => i.status)),
    items: items.map((i) => ({
      itemId: i.item_id, name: i.item_name, description: i.description, required: !!i.required, allowNote: !!i.allow_note,
      status: i.status, doneAt: i.done && i.done_at !== null ? fmtMinute(i.done_at) : null,
      undoneAt: !i.done && i.undone_at !== null ? fmtMinute(i.undone_at) : null, note: i.note,
    })),
  };
}

type EventInput = {
  now: OperationalNow; at: Date; emp: EmployeeRow; exec: ExecutionRow; item: ExecutionItemRow;
  action: 'done' | 'undone' | 'note'; note?: string;
};

export function recordEvent(db: Db, e: EventInput) {
  db.prepare(`
    INSERT INTO audit_events (op_date, minute, at, employee_id, employee_name, execution_id, checklist_id, checklist_name, item_id, item_name, action, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    e.now.date, e.now.minute, e.at.toISOString(), e.emp.id, e.emp.name, e.exec.id, e.exec.checklist_id, e.exec.checklist_name,
    e.item.item_id, e.item.item_name, e.action, e.note ?? '',
  );
}

/** Marca/desmarca. Idempotente: pedir o estado atual não gera evento. */
export function setItemDone(db: Db, args: { now: OperationalNow; at: Date; emp: EmployeeRow; exec: ExecutionRow; item: ExecutionItemRow; done: boolean }) {
  const { item, done, now } = args;
  if (!!item.done === done) return;
  db.transaction(() => {
    if (done) db.prepare('UPDATE execution_items SET done = 1, done_at = ?, undone_at = NULL WHERE id = ?').run(now.minute, item.id);
    else db.prepare('UPDATE execution_items SET done = 0, done_at = NULL, undone_at = ? WHERE id = ?').run(now.minute, item.id);
    recordEvent(db, { ...args, action: done ? 'done' : 'undone' });
  })();
}

export const NOTE_MAX = 500;

/** Salva observação aparada. Texto vazio limpa sem evento; texto igual ao atual não gera evento. */
export function setItemNote(db: Db, args: { now: OperationalNow; at: Date; emp: EmployeeRow; exec: ExecutionRow; item: ExecutionItemRow; note: string }) {
  const { item } = args;
  if (!item.allow_note) throw new HttpError(422, 'Este item não permite observação.');
  const note = args.note.trim();
  if (note.length > NOTE_MAX) throw new HttpError(422, `A observação pode ter até ${NOTE_MAX} caracteres.`);
  if (note === item.note) return;
  db.transaction(() => {
    db.prepare('UPDATE execution_items SET note = ? WHERE id = ?').run(note, item.id);
    if (note) recordEvent(db, { ...args, action: 'note', note });
  })();
}
