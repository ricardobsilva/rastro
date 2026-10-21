import {
  assigneesOf, cardStatus, compareCards, dueMinute, finishMessage, fmtMinute, greeting, longDate, missingRequiredMessage,
} from '@rastro/domain';
import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { HttpError, parse, route } from '../http.js';
import { loadChecklists, loadEmployeesForAssignment, loadItems } from '../repos/config.js';
import type { EmployeeRow } from '../repos/employees.js';
import { requireEmployee } from '../security/employee.js';
import { type ExecutionRow, currentDay, itemsOf, syncDay } from '../services/day.js';
import { assertEditable, executionView, ownExecution, setItemDone, setItemNote, visibleItem } from '../services/execution.js';

const noteSchema = z.object({ note: z.string({ message: 'Informe a observação.' }) });
const doneSchema = z.object({ done: z.boolean({ message: 'Informe se o item foi concluído.' }) });

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

    const startedIds = new Set(execs.map((e) => e.checklist_id));
    const items = new Map(loadItems(db).map((i) => [i.id, i]));
    const employees = loadEmployeesForAssignment(db);
    const onDemand = loadChecklists(db)
      .filter((c) => c.active && c.period === 'ondemand' && !startedIds.has(c.id))
      .filter((c) => assigneesOf(c, employees).some((e) => e.id === emp.id))
      .map((c) => ({ checklistId: c.id, name: c.name, description: c.description, itemCount: c.itemIds.filter((id) => items.get(id)?.active).length }))
      .filter((c) => c.itemCount > 0);

    const total = cards.reduce((n, c) => n + c.total, 0);
    const done = cards.reduce((n, c) => n + c.done, 0);
    res.json({
      date: now.date, dateLabel: longDate(now.date), now: fmtMinute(now.minute), greeting: greeting(now.minute),
      summary: { total, done, pending: total - done, late: cards.reduce((n, c) => n + c.late, 0) },
      cards: cards.map(({ due: _due, late: _late, ...c }) => c),
      onDemand,
    });
  }));

  r.get('/me/executions/:id', route((req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const now = currentDay(db, clock);
    res.json(executionView(db, ownExecution(db, req.params.id!, emp, now.date), now));
  }));

  r.put('/me/executions/:id/items/:itemId', route((req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const { done } = parse(doneSchema, req.body);
    const at = clock();
    const now = currentDay(db, () => at);
    const exec = ownExecution(db, req.params.id!, emp, now.date);
    assertEditable(exec, now.date);
    setItemDone(db, { now, at, emp, exec, item: visibleItem(db, exec, req.params.itemId!), done });
    res.json(executionView(db, exec, now));
  }));

  r.put('/me/executions/:id/items/:itemId/note', route((req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const { note } = parse(noteSchema, req.body);
    const at = clock();
    const now = currentDay(db, () => at);
    const exec = ownExecution(db, req.params.id!, emp, now.date);
    assertEditable(exec, now.date);
    setItemNote(db, { now, at, emp, exec, item: visibleItem(db, exec, req.params.itemId!), note });
    res.json(executionView(db, exec, now));
  }));

  r.post('/me/executions/:id/finish', route((req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const now = currentDay(db, clock);
    const exec = ownExecution(db, req.params.id!, emp, now.date);
    assertEditable(exec, now.date);
    const { items } = executionView(db, exec, now);
    const missing = items.filter((i) => i.required && i.status !== 'done');
    if (missing.length)
      throw new HttpError(422, missingRequiredMessage(missing.map((i) => i.name)), { missing: missing.map((i) => i.itemId) });
    const pending = items.filter((i) => i.status !== 'done').length;
    res.json({ pending, ...finishMessage(pending) });
  }));

  r.post('/me/ondemand/:checklistId/start', route((req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const now = currentDay(db, clock);
    const c = loadChecklists(db).find((x) => x.id === req.params.checklistId && x.active);
    if (!c) throw new HttpError(404, 'Checklist não encontrado.');
    if (c.period !== 'ondemand') throw new HttpError(422, 'Este checklist não é sob demanda.');
    if (!assigneesOf(c, loadEmployeesForAssignment(db)).some((e) => e.id === emp.id))
      throw new HttpError(403, 'Este checklist não está atribuído a você.');

    const existing = db
      .prepare('SELECT id FROM executions WHERE op_date = ? AND checklist_id = ? AND employee_id = ? AND started_manually = 1')
      .get(now.date, c.id, emp.id) as { id: number } | undefined;
    if (existing) return res.json({ executionId: existing.id });

    const { lastInsertRowid } = db
      .prepare('INSERT INTO executions (op_date, checklist_id, employee_id, checklist_name, description, due_time, started_manually) VALUES (?, ?, ?, ?, ?, NULL, 1)')
      .run(now.date, c.id, emp.id, c.name, c.description);
    syncDay(db, now.date, now.dow);
    res.status(201).json({ executionId: Number(lastInsertRowid) });
  }));

  r.get('/me/activities', route((_req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const now = currentDay(db, clock);
    const rows = db
      .prepare('SELECT id, minute, item_name, checklist_name, action, note FROM audit_events WHERE op_date = ? AND employee_id = ? ORDER BY minute DESC, id DESC')
      .all(now.date, emp.id) as { id: number; minute: number; item_name: string; checklist_name: string; action: string; note: string }[];
    res.json(rows.map((e) => ({
      id: e.id, time: fmtMinute(e.minute), itemName: e.item_name, checklistName: e.checklist_name, action: e.action, note: e.note,
    })));
  }));

  return r;
}
