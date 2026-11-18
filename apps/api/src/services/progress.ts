import type { Db } from '../db/index.js';
import { type ExecutionRow, itemsOfMany } from './day.js';

export type Progress = { done: number; total: number; late: number };

/** Progresso por funcionário num dia (instâncias visíveis). */
export async function progressByEmployee(db: Db, date: string, now: number): Promise<Map<string, Progress>> {
  const execs = (await db.prepare('SELECT * FROM executions WHERE op_date = ? AND visible = 1').all(date)) as ExecutionRow[];
  const items = await itemsOfMany(db, execs, () => now);
  const out = new Map<string, Progress>();
  for (const e of execs) {
    const p = out.get(e.employee_id) ?? { done: 0, total: 0, late: 0 };
    for (const i of items.get(e.id)!) {
      p.total++;
      if (i.status === 'done') p.done++;
      if (i.status === 'late') p.late++;
    }
    out.set(e.employee_id, p);
  }
  return out;
}
