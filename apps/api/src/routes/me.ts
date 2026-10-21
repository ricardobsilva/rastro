import { cardStatus, compareCards, dueMinute, fmtMinute, greeting, longDate } from '@rastro/domain';
import { Router } from 'express';
import type { AppContext } from '../context.js';
import { route } from '../http.js';
import type { EmployeeRow } from '../repos/employees.js';
import { type ExecutionRow, currentDay, itemsOf } from '../services/day.js';
import { requireEmployee } from '../security/employee.js';

export function meRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/me', requireEmployee(db));

  r.get('/me/today', route((_req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const now = currentDay(db, clock);
    const execs = db
      .prepare('SELECT * FROM executions WHERE op_date = ? AND employee_id = ? AND visible = 1')
      .all(now.date, emp.id) as ExecutionRow[];

    const cards = execs
      .map((e) => {
        const items = itemsOf(db, e, now.minute);
        const done = items.filter((i) => i.status === 'done').length;
        return {
          executionId: e.id, checklistId: e.checklist_id, name: e.checklist_name, dueTime: e.due_time,
          done, total: items.length, late: items.filter((i) => i.status === 'late').length,
          status: cardStatus(items.map((i) => i.status)), due: dueMinute(e.due_time),
        };
      })
      .filter((c) => c.total > 0)
      .sort(compareCards);

    const total = cards.reduce((n, c) => n + c.total, 0);
    const done = cards.reduce((n, c) => n + c.done, 0);
    res.json({
      date: now.date, dateLabel: longDate(now.date), now: fmtMinute(now.minute), greeting: greeting(now.minute),
      summary: { total, done, pending: total - done, late: cards.reduce((n, c) => n + c.late, 0) },
      cards: cards.map(({ due: _due, late: _late, ...c }) => c),
    });
  }));

  return r;
}
