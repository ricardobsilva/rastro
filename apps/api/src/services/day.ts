import { type ItemStatus, appliesOn, assigneesOf, dueMinute, itemStatus, operationalNow } from '@rastro/domain';
import type { Db } from '../db/index.js';
import { loadChecklists, loadEmployeesForAssignment, loadItems } from '../repos/config.js';

/**
 * Materializa as instâncias do dia operacional a partir da configuração atual.
 * Só é chamado para o dia corrente: assim mudanças valem "a partir de hoje" e dias anteriores ficam congelados.
 * Itens já concluídos nunca são apagados; o que sai da configuração só fica invisível.
 */
export function syncDay(db: Db, date: string, dow: number): void {
  const checklists = loadChecklists(db);
  const items = new Map(loadItems(db).map((i) => [i.id, i]));
  const employees = loadEmployeesForAssignment(db);

  const findExec = db.prepare('SELECT id, started_manually FROM executions WHERE op_date = ? AND checklist_id = ? AND employee_id = ?');
  const insertExec = db.prepare(
    'INSERT INTO executions (op_date, checklist_id, employee_id, checklist_name, description, due_time) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const updateExec = db.prepare('UPDATE executions SET checklist_name = ?, description = ?, due_time = ?, visible = 1 WHERE id = ?');
  const upsertItem = db.prepare(`
    INSERT INTO execution_items (execution_id, item_id, item_name, description, category, required, allow_note, position, visible)
    VALUES (@exec, @item, @name, @description, @category, @required, @allowNote, @position, 1)
    ON CONFLICT (execution_id, item_id) DO UPDATE SET
      item_name = excluded.item_name, description = excluded.description, category = excluded.category,
      required = excluded.required, allow_note = excluded.allow_note, position = excluded.position, visible = 1`);

  db.transaction(() => {
    db.prepare('UPDATE executions SET visible = 0 WHERE op_date = ?').run(date);
    for (const c of checklists) {
      const auto = appliesOn(c, dow);
      const onDemand = c.active && c.period === 'ondemand';
      if (!auto && !onDemand) continue;
      const activeItems = c.itemIds.map((id) => items.get(id)).filter((i) => i?.active);
      if (activeItems.length === 0) continue;

      for (const emp of assigneesOf(c, employees)) {
        const existing = findExec.get(date, c.id, emp.id) as { id: number; started_manually: number } | undefined;
        // Sob demanda só existe depois que o funcionário inicia.
        if (onDemand && !existing?.started_manually) continue;
        let execId: number;
        if (existing) {
          execId = existing.id;
          updateExec.run(c.name, c.description, c.dueTime, execId);
        } else {
          execId = Number(insertExec.run(date, c.id, emp.id, c.name, c.description, c.dueTime).lastInsertRowid);
        }
        db.prepare('UPDATE execution_items SET visible = 0 WHERE execution_id = ?').run(execId);
        activeItems.forEach((it, position) =>
          upsertItem.run({
            exec: execId, item: it!.id, name: it!.name, description: it!.description, category: it!.category,
            required: +it!.required, allowNote: +it!.allowNote, position,
          }),
        );
      }
    }
  })();
}

export type ExecutionRow = {
  id: number; op_date: string; checklist_id: string; employee_id: string; checklist_name: string; description: string;
  due_time: string | null; started_manually: number;
};

export type ExecutionItemRow = {
  id: number; execution_id: number; item_id: string; item_name: string; description: string; category: string;
  required: number; allow_note: number; position: number; done: number; done_at: number | null; undone_at: number | null; note: string;
};

export type ItemView = ExecutionItemRow & { status: ItemStatus };

/** Itens visíveis de uma execução com status calculado. Para dias passados, "agora" é o fim do dia. */
export function itemsOf(db: Db, exec: ExecutionRow, now: number): ItemView[] {
  const rows = db
    .prepare('SELECT * FROM execution_items WHERE execution_id = ? AND visible = 1 ORDER BY position')
    .all(exec.id) as ExecutionItemRow[];
  const due = dueMinute(exec.due_time);
  return rows.map((r) => ({ ...r, status: itemStatus({ done: !!r.done, due, now }) }));
}

export function currentDay(db: Db, clock: () => Date) {
  const now = operationalNow(clock());
  syncDay(db, now.date, now.dow);
  return now;
}
