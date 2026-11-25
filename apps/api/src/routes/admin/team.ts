import { longDate } from '@rastro/domain';
import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { HttpError, route } from '../../http.js';
import { loadUnits, parseUnitFilter } from '../../repos/units.js';
import { requireAdmin } from '../../security/admin.js';
import { currentDay } from '../../services/day.js';
import { type ReportRow, parseReportDate, reportRows } from '../../services/report.js';

function teamRow(employeeId: string, rows: ReportRow[], unitName: Map<string, string>) {
  const mine = rows.filter((r) => r.employeeId === employeeId);
  const groups = new Map<number, { executionId: number; checklistName: string; unit: string | null; dueTime: string | null; items: { itemName: string; status: string; doneAt: string | null; note: string }[] }>();
  for (const r of mine) {
    const g = groups.get(r.executionId) ?? { executionId: r.executionId, checklistName: r.checklistName, unit: unitName.get(r.unitId ?? '') ?? null, dueTime: r.dueTime, items: [] };
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

  const load = async (query: { date?: unknown; unitId?: unknown }) => {
    const now = await currentDay(db, clock);
    const date = parseReportDate(query.date, now.date);
    const units = await loadUnits(db);
    const unitId = parseUnitFilter(query.unitId, units);
    const rows = (await reportRows(db, date, now)).filter((x) => !unitId || x.unitId === unitId);
    return { now, date, rows, unitName: new Map(units.map((u) => [u.id, u.name])) };
  };

  r.get('/admin/team', route(async (req, res) => {
    const { now, date, rows, unitName } = await load(req.query);
    const ids = ((await db.prepare('SELECT id FROM employees ORDER BY active DESC, rowid').all()) as { id: string }[]).map((e) => e.id);
    res.json({ date, isToday: date === now.date, dateLabel: longDate(date), rows: ids.map((id) => teamRow(id, rows, unitName)) });
  }));

  r.get('/admin/team/:id', route(async (req, res) => {
    if (!(await db.prepare('SELECT 1 FROM employees WHERE id = ?').get(req.params.id!))) throw new HttpError(404, 'Funcionário não encontrado.');
    const { rows, unitName } = await load(req.query);
    res.json(teamRow(req.params.id!, rows, unitName));
  }));

  return r;
}
