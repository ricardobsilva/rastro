import { longDate } from '@rastro/domain';
import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { HttpError, route } from '../../http.js';
import { requireAdmin } from '../../security/admin.js';
import { currentDay } from '../../services/day.js';
import { type ReportRow, parseReportDate, reportRows } from '../../services/report.js';

function teamRow(employeeId: string, rows: ReportRow[]) {
  const mine = rows.filter((r) => r.employeeId === employeeId);
  const groups = new Map<number, { checklistName: string; dueTime: string | null; items: { itemName: string; status: string; doneAt: string | null; note: string }[] }>();
  for (const r of mine) {
    const g = groups.get(r.executionId) ?? { checklistName: r.checklistName, dueTime: r.dueTime, items: [] };
    g.items.push({ itemName: r.itemName, status: r.status, doneAt: r.doneAt, note: r.note });
    groups.set(r.executionId, g);
  }
  return {
    employeeId, total: mine.length, done: mine.filter((r) => r.status === 'done').length,
    late: mine.filter((r) => r.status === 'late').length, groups: [...groups.values()],
  };
}

export function adminTeamRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/admin/team', requireAdmin(db, clock));

  const load = (rawDate: unknown) => {
    const now = currentDay(db, clock);
    const date = parseReportDate(rawDate, now.date);
    return { now, date, rows: reportRows(db, date, now) };
  };

  r.get('/admin/team', route((req, res) => {
    const { now, date, rows } = load(req.query.date);
    const ids = (db.prepare('SELECT id FROM employees ORDER BY active DESC, rowid').all() as { id: string }[]).map((e) => e.id);
    res.json({ date, isToday: date === now.date, dateLabel: longDate(date), rows: ids.map((id) => teamRow(id, rows)) });
  }));

  r.get('/admin/team/:id', route((req, res) => {
    if (!db.prepare('SELECT 1 FROM employees WHERE id = ?').get(req.params.id)) throw new HttpError(404, 'Funcionário não encontrado.');
    res.json(teamRow(req.params.id!, load(req.query.date).rows));
  }));

  return r;
}
