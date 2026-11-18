import { type ItemStatus, appliesOn, assigneesOf, dueMinute, itemStatus, operationalNow } from '@rastro/domain';
import type { Db, Stmt } from '../db/index.js';
import { type ItemConfig, loadConfig } from '../repos/config.js';

type ExistingExec = {
  id: number; checklist_id: string; employee_id: string; checklist_name: string; description: string;
  due_time: string | null; started_manually: number; visible: number;
};
type ExistingItem = {
  id: number; execution_id: number; item_id: string; item_name: string; description: string; category: string;
  required: number; allow_note: number; position: number; visible: number;
};

/**
 * Materializa as instâncias do dia operacional a partir da configuração atual.
 * Só é chamado para o dia corrente: assim mudanças valem "a partir de hoje" e dias anteriores ficam congelados.
 * Itens já concluídos nunca são apagados; o que sai da configuração só fica invisível.
 *
 * Roda a cada requisição, então compara com o que já está gravado e só escreve a diferença:
 * uma leitura em lote e, quando algo mudou, uma escrita em lote (atômica). Sem mudança, nada é escrito.
 * Inserções toleram corrida entre requisições simultâneas (INSERT OR IGNORE / ON CONFLICT).
 */
export async function syncDay(db: Db, date: string, dow: number): Promise<void> {
  const config = await loadConfig(db, [
    { sql: 'SELECT id, checklist_id, employee_id, checklist_name, description, due_time, started_manually, visible FROM executions WHERE op_date = ?', args: [date] },
    { sql: `SELECT ei.id, ei.execution_id, ei.item_id, ei.item_name, ei.description, ei.category, ei.required, ei.allow_note, ei.position, ei.visible
      FROM execution_items ei JOIN executions e ON e.id = ei.execution_id WHERE e.op_date = ?`, args: [date] },
  ]);
  const execRows = config.extra[0] as ExistingExec[];
  const itemRows = config.extra[1] as ExistingItem[];
  const items = new Map(config.items.map((i) => [i.id, i]));

  const execByKey = new Map(execRows.map((e) => [`${e.checklist_id}|${e.employee_id}`, e]));
  const itemsByExec = new Map<number, Map<string, ExistingItem>>();
  for (const r of itemRows) {
    const m = itemsByExec.get(r.execution_id) ?? new Map<string, ExistingItem>();
    m.set(r.item_id, r);
    itemsByExec.set(r.execution_id, m);
  }

  const writes: Stmt[] = [];
  const stmt = (sql: string, ...args: Stmt['args']) => writes.push({ sql, args });
  const execIdOf = '(SELECT id FROM executions WHERE op_date = ? AND checklist_id = ? AND employee_id = ?)';
  const upsertItem = (execRef: string, execArgs: Stmt['args'], it: ItemConfig, position: number) =>
    stmt(`
      INSERT INTO execution_items (execution_id, item_id, item_name, description, category, required, allow_note, position, visible)
      VALUES (${execRef}, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT (execution_id, item_id) DO UPDATE SET
        item_name = excluded.item_name, description = excluded.description, category = excluded.category,
        required = excluded.required, allow_note = excluded.allow_note, position = excluded.position, visible = 1`,
    ...execArgs, it.id, it.name, it.description, it.category, +it.required, +it.allowNote, position);

  const keep = new Set<number>();
  for (const c of config.checklists) {
    const auto = appliesOn(c, dow);
    const onDemand = c.active && c.period === 'ondemand';
    if (!auto && !onDemand) continue;
    const activeItems = c.itemIds.map((id) => items.get(id)).filter((i): i is ItemConfig => !!i?.active);
    if (activeItems.length === 0) continue;

    for (const emp of assigneesOf(c, config.employees)) {
      const existing = execByKey.get(`${c.id}|${emp.id}`);
      // Sob demanda só existe depois que o funcionário inicia.
      if (onDemand && !existing?.started_manually) continue;

      if (!existing) {
        stmt('INSERT OR IGNORE INTO executions (op_date, checklist_id, employee_id, checklist_name, description, due_time) VALUES (?, ?, ?, ?, ?, ?)',
          date, c.id, emp.id, c.name, c.description, c.dueTime);
        activeItems.forEach((it, position) => upsertItem(execIdOf, [date, c.id, emp.id], it, position));
        continue;
      }

      keep.add(existing.id);
      if (existing.checklist_name !== c.name || existing.description !== c.description || existing.due_time !== c.dueTime || !existing.visible)
        stmt('UPDATE executions SET checklist_name = ?, description = ?, due_time = ?, visible = 1 WHERE id = ?', c.name, c.description, c.dueTime, existing.id);

      const current = itemsByExec.get(existing.id) ?? new Map<string, ExistingItem>();
      const wanted = new Set<string>();
      activeItems.forEach((it, position) => {
        wanted.add(it.id);
        const row = current.get(it.id);
        if (!row) return upsertItem('?', [existing.id], it, position);
        if (row.item_name !== it.name || row.description !== it.description || row.category !== it.category
          || row.required !== +it.required || row.allow_note !== +it.allowNote || row.position !== position || !row.visible)
          stmt('UPDATE execution_items SET item_name = ?, description = ?, category = ?, required = ?, allow_note = ?, position = ?, visible = 1 WHERE id = ?',
            it.name, it.description, it.category, +it.required, +it.allowNote, position, row.id);
      });
      for (const row of current.values())
        if (row.visible && !wanted.has(row.item_id)) stmt('UPDATE execution_items SET visible = 0 WHERE id = ?', row.id);
    }
  }
  for (const e of execRows) if (e.visible && !keep.has(e.id)) stmt('UPDATE executions SET visible = 0 WHERE id = ?', e.id);

  await db.batch(writes);
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

/**
 * Itens visíveis de várias execuções numa única consulta, com status calculado.
 * `nowOf` dá o minuto de referência de cada execução (para dias passados, o fim do dia).
 */
export async function itemsOfMany(db: Db, execs: ExecutionRow[], nowOf: (e: ExecutionRow) => number): Promise<Map<number, ItemView[]>> {
  const out = new Map<number, ItemView[]>(execs.map((e) => [e.id, []]));
  if (execs.length === 0) return out;
  const rows = (await db
    .prepare(`SELECT * FROM execution_items WHERE visible = 1 AND execution_id IN (${execs.map(() => '?').join(', ')}) ORDER BY execution_id, position`)
    .all(...execs.map((e) => e.id))) as ExecutionItemRow[];
  const byId = new Map(execs.map((e) => [e.id, e]));
  for (const r of rows) {
    const exec = byId.get(r.execution_id)!;
    out.get(exec.id)!.push({ ...r, status: itemStatus({ done: !!r.done, due: dueMinute(exec.due_time), now: nowOf(exec) }) });
  }
  return out;
}

/** Itens visíveis de uma execução com status calculado. Para dias passados, "agora" é o fim do dia. */
export async function itemsOf(db: Db, exec: ExecutionRow, now: number): Promise<ItemView[]> {
  return (await itemsOfMany(db, [exec], () => now)).get(exec.id)!;
}

export async function currentDay(db: Db, clock: () => Date) {
  const now = operationalNow(clock());
  await syncDay(db, now.date, now.dow);
  return now;
}
