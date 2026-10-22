import { CATEGORIES, WEEKDAYS_SHORT, addDays, dayOfWeek, firstName, fmtMinute, initials, longDate } from '@rastro/domain';
import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { HttpError, route } from '../../http.js';
import type { EmployeeRow } from '../../repos/employees.js';
import { requireAdmin } from '../../security/admin.js';
import { currentDay } from '../../services/day.js';
import { type ReportRow, dateOptions, parseReportDate, reportRows } from '../../services/report.js';

const STATUSES = ['all', 'done', 'pending', 'late'];
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const str = (v: unknown) => (typeof v === 'string' && v && v !== 'all' ? v : null);

export function adminDashboardRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use(['/admin/dashboard', '/admin/dates'], requireAdmin(db, clock));

  r.get('/admin/dates', route((_req, res) => {
    res.json(dateOptions(currentDay(db, clock).date));
  }));

  r.get('/admin/dashboard', route((req, res) => {
    const now = currentDay(db, clock);
    const date = parseReportDate(req.query.date, now.date);
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    if (!STATUSES.includes(status)) throw new HttpError(422, 'Status inválido.');
    const f = { emp: str(req.query.employeeId), cat: str(req.query.category), cl: str(req.query.checklistId) };
    const filter = (rows: ReportRow[], withStatus = true) =>
      rows.filter((x) => (!f.emp || x.employeeId === f.emp) && (!f.cat || x.category === f.cat) && (!f.cl || x.checklistId === f.cl)
        && (!withStatus || status === 'all' || x.status === status));

    const rows = filter(reportRows(db, date, now));
    const isToday = date === now.date;
    const emps = new Map((db.prepare('SELECT * FROM employees').all() as EmployeeRow[]).map((e) => [e.id, e]));
    const count = (s: string) => rows.filter((x) => x.status === s).length;
    const done = count('done');

    const byCl = new Map<string, { name: string; done: number; late: number; total: number }>();
    for (const x of rows) {
      const g = byCl.get(x.checklistId) ?? { name: x.checklistName, done: 0, late: 0, total: 0 };
      g.total++;
      if (x.status === 'done') g.done++;
      if (x.status === 'late') g.late++;
      byCl.set(x.checklistId, g);
    }

    const late = rows.filter((x) => x.status === 'late').sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
    const pend = new Map<string, { pending: number; late: number }>();
    for (const x of rows) {
      if (x.status === 'done') continue;
      const g = pend.get(x.employeeId) ?? { pending: 0, late: 0 };
      g.pending++;
      if (x.status === 'late') g.late++;
      pend.set(x.employeeId, g);
    }
    const person = (id: string) => {
      const e = emps.get(id)!;
      return { employeeId: id, name: e.name, firstName: firstName(e.name), role: e.role, color: e.color, initials: initials(e.name) };
    };

    res.json({
      date, isToday, now: fmtMinute(now.minute), dateLabel: longDate(date),
      kpis: { total: rows.length, done, pending: count('pending'), late: count('late'), pct: pctOf(done, rows.length), checklists: new Set(rows.map((x) => x.executionId)).size },
      byChecklist: [...byCl.values()].sort((a, b) => a.done / a.total - b.done / b.total),
      lateCount: late.length,
      lateList: late.slice(0, 6).map((x) => ({
        ...person(x.employeeId), itemName: x.itemName, checklistName: x.checklistName, due: x.dueTime,
        delayMin: isToday && x.due !== null ? now.minute - x.due : null,
      })),
      pendingByEmployee: [...pend.entries()].map(([id, g]) => ({ ...person(id), ...g })).sort((a, b) => b.late - a.late || b.pending - a.pending),
      byCategory: CATEGORIES.map((c) => {
        const g = rows.filter((x) => x.category === c);
        return { category: c, n: g.length, pct: pctOf(g.filter((x) => x.status === 'done').length, g.length) };
      }).filter((c) => c.n > 0),
      trend: Array.from({ length: 8 }, (_, i) => {
        const d = addDays(now.date, i - 7);
        const tr = filter(reportRows(db, d, now), false);
        return { date: d, label: d === now.date ? 'Hoje' : WEEKDAYS_SHORT[dayOfWeek(d)], pct: pctOf(tr.filter((x) => x.status === 'done').length, tr.length) };
      }),
    });
  }));

  return r;
}
