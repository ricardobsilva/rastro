import { fmtMinute, initials, shortDate } from '@rastro/domain';
import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { HttpError, route } from '../../http.js';
import { loadUnits, parseUnitFilter } from '../../repos/units.js';
import { requireAdmin } from '../../security/admin.js';
import { currentDay } from '../../services/day.js';

const ACTIONS = ['done', 'undone', 'note'];
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const int = (v: unknown, def: number) => (typeof v === 'string' && /^-?\d+$/.test(v) ? Number(v) : def);

type EventRow = {
  id: number; op_date: string; minute: number; employee_id: string; employee_name: string;
  checklist_name: string; item_name: string; action: string; note: string; unit_id: string | null;
};

/** Somente leitura: o log de auditoria não tem rotas de alteração. */
export function adminHistoryRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/admin/history', requireAdmin(db, clock));

  r.get('/admin/history', route(async (req, res) => {
    const { date, employeeId, action, q } = req.query as Record<string, string | undefined>;
    if (action && action !== 'all' && !ACTIONS.includes(action)) throw new HttpError(422, 'Ação inválida.');
    if (date && date !== 'all' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(422, 'Data inválida.');

    const units = await loadUnits(db);
    const unitId = parseUnitFilter(req.query.unitId, units);
    const unitName = new Map(units.map((u) => [u.id, u.name]));

    const where: string[] = [];
    const args: string[] = [];
    if (date && date !== 'all') { where.push('a.op_date = ?'); args.push(date); }
    if (employeeId && employeeId !== 'all') { where.push('a.employee_id = ?'); args.push(employeeId); }
    if (action && action !== 'all') { where.push('a.action = ?'); args.push(action); }
    if (unitId) { where.push('e.unit_id = ?'); args.push(unitId); }
    let rows = (await db
      .prepare(`SELECT a.*, e.unit_id FROM audit_events a LEFT JOIN executions e ON e.id = a.execution_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY a.op_date DESC, a.minute DESC, a.id DESC`)
      .all(...args)) as EventRow[];
    const query = fold((q ?? '').trim());
    if (query) rows = rows.filter((e) => fold(e.item_name).includes(query) || fold(e.checklist_name).includes(query));

    const today = (await currentDay(db, clock)).date;
    const colors = new Map(((await db.prepare('SELECT id, color FROM employees').all()) as { id: string; color: string }[]).map((e) => [e.id, e.color]));
    const offset = Math.max(0, int(req.query.offset, 0));
    const limit = Math.min(200, Math.max(1, int(req.query.limit, 40)));
    res.json({
      total: rows.length,
      undone: rows.filter((e) => e.action === 'undone').length,
      rows: rows.slice(offset, offset + limit).map((e) => ({
        id: e.id, date: e.op_date, dateLabel: e.op_date === today ? 'Hoje' : shortDate(e.op_date), time: fmtMinute(e.minute),
        checklistName: e.checklist_name, unit: unitName.get(e.unit_id ?? '') ?? null, itemName: e.item_name, employeeId: e.employee_id, employeeName: e.employee_name,
        initials: initials(e.employee_name), color: colors.get(e.employee_id) ?? '#6B6A63', action: e.action, note: e.note,
      })),
    });
  }));

  return r;
}
