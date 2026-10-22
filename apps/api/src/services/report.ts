import { type ItemStatus, type OperationalNow, WEEKDAYS_SHORT, addDays, dueMinute, fmtMinute, shortDate } from '@rastro/domain';
import type { Db } from '../db/index.js';
import { HttpError } from '../http.js';
import { type ExecutionRow, itemsOf } from './day.js';

export const HISTORY_DAYS = 7;

export type ReportRow = {
  date: string; executionId: number; checklistId: string; checklistName: string; dueTime: string | null; due: number | null;
  employeeId: string; itemId: string; itemName: string; category: string; status: ItemStatus; doneAt: string | null; note: string;
};

/** Linhas (uma por item atribuído) de um dia. Dias anteriores são avaliados no fim do dia: pendente com prazo = não feito. */
export function reportRows(db: Db, date: string, now: OperationalNow): ReportRow[] {
  const minute = date === now.date ? now.minute : Number.POSITIVE_INFINITY;
  const execs = db.prepare('SELECT * FROM executions WHERE op_date = ? AND visible = 1 ORDER BY id').all(date) as ExecutionRow[];
  return execs.flatMap((e) =>
    itemsOf(db, e, minute).map((i) => ({
      date, executionId: e.id, checklistId: e.checklist_id, checklistName: e.checklist_name, dueTime: e.due_time, due: dueMinute(e.due_time),
      employeeId: e.employee_id, itemId: i.item_id, itemName: i.item_name, category: i.category, status: i.status,
      doneAt: i.done && i.done_at !== null ? fmtMinute(i.done_at) : null, note: i.note,
    })),
  );
}

export function dateOptions(today: string) {
  return Array.from({ length: HISTORY_DAYS + 1 }, (_, n) => {
    const value = addDays(today, -n);
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    const wd = WEEKDAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return { value, label: `${n === 0 ? 'Hoje' : n === 1 ? 'Ontem' : wd} · ${shortDate(value)}` };
  });
}

/** Valida a data pedida (YYYY-MM-DD, entre hoje-7 e hoje). Ausente = hoje. */
export function parseReportDate(raw: unknown, today: string): string {
  if (raw === undefined || raw === '') return today;
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new HttpError(422, 'Data inválida.');
  if (!dateOptions(today).some((o) => o.value === raw)) throw new HttpError(422, 'Data fora do período disponível.');
  return raw;
}
