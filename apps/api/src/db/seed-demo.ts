import { addDays, dayOfWeek, operationalNow } from '@rastro/domain';
import { syncDay } from '../services/day.js';
import type { Db } from './index.js';

// Marcações de hoje do protótipo: [checklist, funcionário, item, HH:mm, observação?]
const TODAY_MARKS: [string, string, string, string, string?][] = [
  ['c1', 'e1', 'i1', '09:52'], ['c1', 'e1', 'i2', '09:58'], ['c1', 'e1', 'i3', '10:05'], ['c1', 'e1', 'i4', '10:12'], ['c1', 'e1', 'i5', '10:20', 'Restam 3 sacos de 5 kg.'],
  ['c2', 'e1', 'i14', '10:48'], ['c2', 'e1', 'i25', '11:02'], ['c2', 'e1', 'i15', '11:15'],
  ['c1', 'e2', 'i1', '09:40'], ['c1', 'e2', 'i2', '09:44'], ['c1', 'e2', 'i3', '09:50'], ['c1', 'e2', 'i4', '09:57'], ['c1', 'e2', 'i5', '10:03'], ['c1', 'e2', 'i6', '10:11'],
  ['c2', 'e2', 'i14', '10:55'],
  ['c4', 'e4', 'i7', '08:50'], ['c4', 'e4', 'i8', '08:55', 'Câmara 1: 3 °C · Câmara 2: −19 °C'], ['c4', 'e4', 'i11', '09:10'], ['c4', 'e4', 'i10', '09:40'], ['c4', 'e4', 'i6', '09:52'],
  ['c3', 'e3', 'i5', '10:30'], ['c3', 'e3', 'i9', '10:36'],
  ['c6', 'e5', 'i12', '10:20'], ['c6', 'e5', 'i13', '10:35'],
  ['c9', 'e7', 'i4', '08:40'], ['c9', 'e7', 'i16', '09:00'], ['c9', 'e7', 'i11', '09:15'],
];

/** Gerador determinístico (mesma semente do protótipo). */
function mulberry(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Dados de demonstração para validar com o cliente: 7 dias anteriores (≈95% feito, alguns atrasos) e as marcações de hoje.
 * Não roda se já houver eventos, para nunca misturar com uso real.
 */
export function seedDemo(db: Db, at: Date): void {
  if (!db.prepare("SELECT 1 FROM employees WHERE id = 'e1'").get()) throw new Error('Rode o seed base antes do seed de demonstração.');
  if (db.prepare('SELECT 1 FROM audit_events LIMIT 1').get()) return;
  const now = operationalNow(at);
  const rnd = mulberry(11);
  const names = new Map((db.prepare('SELECT id, name FROM employees').all() as { id: string; name: string }[]).map((e) => [e.id, e.name]));

  const mark = db.prepare('UPDATE execution_items SET done = 1, done_at = ?, note = ? WHERE id = ?');
  const event = db.prepare(`INSERT INTO audit_events (op_date, minute, at, employee_id, employee_name, execution_id, checklist_id, checklist_name, item_id, item_name, action, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  type Row = { id: number; execution_id: number; item_id: string; item_name: string; position: number; employee_id: string; checklist_id: string; checklist_name: string; due_time: string | null };
  const rowsOf = (date: string) =>
    db.prepare(`SELECT ei.id, ei.execution_id, ei.item_id, ei.item_name, ei.position, e.employee_id, e.checklist_id, e.checklist_name, e.due_time
      FROM execution_items ei JOIN executions e ON e.id = ei.execution_id WHERE e.op_date = ? AND e.visible = 1 AND ei.visible = 1`).all(date) as Row[];
  const log = (date: string, minute: number, r: Row, action: string, note = '') =>
    event.run(date, minute, at.toISOString(), r.employee_id, names.get(r.employee_id), r.execution_id, r.checklist_id, r.checklist_name, r.item_id, r.item_name, action, note);

  db.transaction(() => {
    for (let d = 7; d >= 1; d--) {
      const date = addDays(now.date, -d);
      syncDay(db, date, dayOfWeek(date));
      // Renomeação simulada: dias mais antigos mostram o nome anterior do checklist.
      if (d >= 5) db.prepare("UPDATE executions SET checklist_name = 'Abertura do salão' WHERE op_date = ? AND checklist_id = 'c1'").run(date);
      for (const r of rowsOf(date)) {
        if (rnd() < 0.05) continue;
        const [h, m] = (r.due_time ?? '12:00').split(':').map(Number) as [number, number];
        const due = h * 60 + m;
        const minute = Math.min(1439, rnd() < 0.08 ? due + 5 + Math.floor(rnd() * 35) : due - 55 + r.position * 7 + Math.floor(rnd() * 6));
        const name = d >= 5 && r.checklist_id === 'c1' ? 'Abertura do salão' : r.checklist_name;
        mark.run(minute, '', r.id);
        log(date, minute, { ...r, checklist_name: name }, 'done');
      }
    }

    syncDay(db, now.date, now.dow);
    const today = rowsOf(now.date);
    for (const [cl, emp, item, hhmm, note] of TODAY_MARKS) {
      const [h, m] = hhmm.split(':').map(Number) as [number, number];
      const minute = h * 60 + m;
      if (minute > now.minute) continue;
      const r = today.find((x) => x.checklist_id === cl && x.employee_id === emp && x.item_id === item);
      if (!r) continue;
      mark.run(minute, note ?? '', r.id);
      log(now.date, minute, r, 'done');
      if (note) log(now.date, minute, r, 'note', note);
    }
    // Uma desmarcação, como no protótipo.
    const recount = today.find((x) => x.checklist_id === 'c3' && x.employee_id === 'e3' && x.item_id === 'i12');
    if (recount && now.minute >= 652) {
      log(now.date, 640, recount, 'done');
      db.prepare('UPDATE execution_items SET undone_at = 652 WHERE id = ?').run(recount.id);
      log(now.date, 652, recount, 'undone', 'Contagem divergente, vou recontar.');
    }
  })();
}
