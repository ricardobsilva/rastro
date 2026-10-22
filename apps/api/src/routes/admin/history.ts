import { fmtMinute, initials, shortDate } from '@rastro/domain';
import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { HttpError, route } from '../../http.js';
import { requireAdmin } from '../../security/admin.js';
import { currentDay } from '../../services/day.js';

const ACTIONS = ['done', 'undone', 'note'];
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const int = (v: unknown, def: number) => (typeof v === 'string' && /^-?\d+$/.test(v) ? Number(v) : def);

type EventRow = {
  id: number; op_date: string; minute: number; employee_id: string; employee_name: string;
  checklist_name: string; item_name: string; action: string; note: string;
};

/** Somente leitura: o log de auditoria não tem rotas de alteração. */
export function adminHistoryRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/admin/history', requireAdmin(db, clock));

  r.get('/admin/history', route((req, res) => {
    const { date, employeeId, action, q } = req.query as Record<string, string | undefined>;
    if (action && action !== 'all' && !ACTIONS.includes(action)) throw new HttpError(422, 'Ação inválida.');
    if (date && date !== 'all' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(422, 'Data inválida.');

    const where: string[] = [];
    const args: string[] = [];
    if (date && date !== 'all') { where.push('op_date = ?'); args.push(date); }
    if (employeeId && employeeId !== 'all') { where.push('employee_id = ?'); args.push(employeeId); }
    if (action && action !== 'all') { where.push('action = ?'); args.push(action); }
    let rows = db
      .prepare(`SELECT * FROM audit_events ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY op_date DESC, minute DESC, id DESC`)
      .all(...args) as EventRow[];
    const query = fold((q ?? '').trim());
    if (query) rows = rows.filter((e) => fold(e.item_name).includes(query) || fold(e.checklist_name).includes(query));

    const today = currentDay(db, clock).date;
    const colors = new Map((db.prepare('SELECT id, color FROM employees').all() as { id: string; color: string }[]).map((e) => [e.id, e.color]));
    const offset = Math.max(0, int(req.query.offset, 0));
    const limit = Math.min(200, Math.max(1, int(req.query.limit, 40)));
    res.json({
      total: rows.length,
      undone: rows.filter((e) => e.action === 'undone').length,
      rows: rows.slice(offset, offset + limit).map((e) => ({
        id: e.id, date: e.op_date, dateLabel: e.op_date === today ? 'Hoje' : shortDate(e.op_date), time: fmtMinute(e.minute),
        checklistName: e.checklist_name, itemName: e.item_name, employeeId: e.employee_id, employeeName: e.employee_name,
        initials: initials(e.employee_name), color: colors.get(e.employee_id) ?? '#6B6A63', action: e.action, note: e.note,
      })),
    });
  }));

  return r;
}
