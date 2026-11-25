import {
  assigneesOf, cardStatus, compareCards, dueMinute, finishMessage, fmtMinute, greeting, longDate, missingRequiredMessage, sameUnit,
} from '@rastro/domain';
import { type Response, Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { HttpError, parse, route } from '../http.js';
import { loadChecklists, loadConfig, loadEmployeesForAssignment } from '../repos/config.js';
import type { EmployeeRow } from '../repos/employees.js';
import { loadUnits } from '../repos/units.js';
import type { DeviceRow } from '../security/device.js';
import { requireEmployee } from '../security/employee.js';
import { type ExecutionRow, currentDay, itemsOfMany, syncDay } from '../services/day.js';
import { assertEditable, executionView, ownExecution, setItemDone, setItemNote, visibleItem } from '../services/execution.js';

const noteSchema = z.object({ note: z.string({ message: 'Informe a observação.' }) });
const doneSchema = z.object({ done: z.boolean({ message: 'Informe se o item foi concluído.' }) });

export function meRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/me', requireEmployee(db));

  /** Unidade do aparelho; null no celular pessoal, que vê todas. */
  const deviceUnit = (res: Response) => (res.locals.device as DeviceRow).unit_id;

  r.get('/me/today', route(async (_req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const now = await currentDay(db, clock);
    const deviceUnitId = deviceUnit(res);
    const execs = ((await db
      .prepare('SELECT * FROM executions WHERE op_date = ? AND employee_id = ? AND visible = 1')
      .all(now.date, emp.id)) as ExecutionRow[]).filter((e) => sameUnit(e.unit_id, deviceUnitId));
    const [itemsByExec, config, units] = await Promise.all([itemsOfMany(db, execs, () => now.minute), loadConfig(db), loadUnits(db)]);
    const unitName = (id: string | null) => units.find((u) => u.id === id)?.name ?? null;

    const cards = execs
      .map((e) => {
        const items = itemsByExec.get(e.id)!;
        const done = items.filter((i) => i.status === 'done').length;
        return {
          executionId: e.id, checklistId: e.checklist_id, name: e.checklist_name, dueTime: e.due_time, unit: unitName(e.unit_id),
          done, total: items.length, late: items.filter((i) => i.status === 'late').length,
          status: cardStatus(items.map((i) => i.status)), due: dueMinute(e.due_time),
        };
      })
      .filter((c) => c.total > 0)
      .sort(compareCards);

    const startedIds = new Set(execs.map((e) => e.checklist_id));
    const items = new Map(config.items.map((i) => [i.id, i]));
    const employees = config.employees;
    const onDemand = config.checklists
      .filter((c) => c.active && c.period === 'ondemand' && !startedIds.has(c.id) && sameUnit(c.unitId, deviceUnitId))
      .filter((c) => assigneesOf(c, employees).some((e) => e.id === emp.id))
      .map((c) => ({ checklistId: c.id, name: c.name, description: c.description, unit: unitName(c.unitId), itemCount: c.itemIds.filter((id) => items.get(id)?.active).length }))
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

  r.get('/me/executions/:id', route(async (req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const now = await currentDay(db, clock);
    res.json(await executionView(db, await ownExecution(db, req.params.id!, emp, now.date, deviceUnit(res)), now));
  }));

  r.put('/me/executions/:id/items/:itemId', route(async (req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const { done } = parse(doneSchema, req.body);
    const at = clock();
    const now = await currentDay(db, () => at);
    const exec = await ownExecution(db, req.params.id!, emp, now.date, deviceUnit(res));
    assertEditable(exec, now.date);
    await setItemDone(db, { now, at, emp, exec, item: await visibleItem(db, exec, req.params.itemId!), done });
    res.json(await executionView(db, exec, now));
  }));

  r.put('/me/executions/:id/items/:itemId/note', route(async (req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const { note } = parse(noteSchema, req.body);
    const at = clock();
    const now = await currentDay(db, () => at);
    const exec = await ownExecution(db, req.params.id!, emp, now.date, deviceUnit(res));
    assertEditable(exec, now.date);
    await setItemNote(db, { now, at, emp, exec, item: await visibleItem(db, exec, req.params.itemId!), note });
    res.json(await executionView(db, exec, now));
  }));

  r.post('/me/executions/:id/finish', route(async (req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const now = await currentDay(db, clock);
    const exec = await ownExecution(db, req.params.id!, emp, now.date, deviceUnit(res));
    assertEditable(exec, now.date);
    const { items } = await executionView(db, exec, now);
    const missing = items.filter((i) => i.required && i.status !== 'done');
    if (missing.length)
      throw new HttpError(422, missingRequiredMessage(missing.map((i) => i.name)), { missing: missing.map((i) => i.itemId) });
    const pending = items.filter((i) => i.status !== 'done').length;
    res.json({ pending, ...finishMessage(pending) });
  }));

  r.post('/me/ondemand/:checklistId/start', route(async (req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const now = await currentDay(db, clock);
    const c = (await loadChecklists(db)).find((x) => x.id === req.params.checklistId && x.active);
    if (!c) throw new HttpError(404, 'Checklist não encontrado.');
    if (c.period !== 'ondemand') throw new HttpError(422, 'Este checklist não é sob demanda.');
    if (!sameUnit(c.unitId, deviceUnit(res))) throw new HttpError(403, 'Este checklist é de outra unidade.');
    if (!assigneesOf(c, await loadEmployeesForAssignment(db)).some((e) => e.id === emp.id))
      throw new HttpError(403, 'Este checklist não está atribuído a você.');

    const existing = (await db
      .prepare('SELECT id FROM executions WHERE op_date = ? AND checklist_id = ? AND employee_id = ? AND started_manually = 1')
      .get(now.date, c.id, emp.id)) as { id: number } | undefined;
    if (existing) return res.json({ executionId: existing.id });

    const { lastInsertRowid } = await db
      .prepare('INSERT INTO executions (op_date, checklist_id, employee_id, checklist_name, description, due_time, started_manually, unit_id) VALUES (?, ?, ?, ?, ?, NULL, 1, ?)')
      .run(now.date, c.id, emp.id, c.name, c.description, c.unitId);
    await syncDay(db, now.date, now.dow);
    res.status(201).json({ executionId: Number(lastInsertRowid) });
  }));

  r.get('/me/activities', route(async (_req, res) => {
    const emp = res.locals.employee as EmployeeRow;
    const now = await currentDay(db, clock);
    const rows = (await db
      .prepare(`SELECT a.id, a.minute, a.item_name, a.checklist_name, a.action, a.note, e.unit_id
        FROM audit_events a LEFT JOIN executions e ON e.id = a.execution_id
        WHERE a.op_date = ? AND a.employee_id = ? ORDER BY a.minute DESC, a.id DESC`)
      .all(now.date, emp.id)) as { unit_id: string | null; id: number; minute: number; item_name: string; checklist_name: string; action: string; note: string }[];
    res.json(rows.filter((e) => sameUnit(e.unit_id, deviceUnit(res))).map((e) => ({
      id: e.id, time: fmtMinute(e.minute), itemName: e.item_name, checklistName: e.checklist_name, action: e.action, note: e.note,
    })));
  }));

  return r;
}
