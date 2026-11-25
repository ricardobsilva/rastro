import { fmtMinute, operationalNow, worksAt } from '@rastro/domain';
import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { HttpError, parse, route } from '../http.js';
import { getEmployee, listActiveEmployees, toPublic, unitIdsOf } from '../repos/employees.js';
import { type DeviceRow, requireDevice } from '../security/device.js';

const loginSchema = z.object({ employeeId: z.string({ message: 'Informe o funcionário.' }).min(1, 'Informe o funcionário.') });

export function sessionRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use(['/session', '/employees'], requireDevice(db));

  const sinceLabel = (iso: string | null) => (iso ? fmtMinute(operationalNow(new Date(iso)).minute) : null);

  r.get('/employees', route(async (_req, res) => {
    const { unit_id } = res.locals.device as DeviceRow;
    res.json((await listActiveEmployees(db)).filter((e) => worksAt({ unitIds: unitIdsOf(e) }, unit_id)).map(toPublic));
  }));

  r.get('/session', route(async (_req, res) => {
    const device = res.locals.device as DeviceRow;
    const emp = device.employee_id ? await getEmployee(db, device.employee_id) : undefined;
    if (!emp || !emp.active || !worksAt({ unitIds: unitIdsOf(emp) }, device.unit_id)) return res.json({ employee: null, since: null });
    res.json({ employee: toPublic(emp), since: sinceLabel(device.session_since) });
  }));

  r.post('/session', route(async (req, res) => {
    const device = res.locals.device as DeviceRow;
    const { employeeId } = parse(loginSchema, req.body);
    const emp = await getEmployee(db, employeeId);
    if (!emp) throw new HttpError(404, 'Funcionário não encontrado.');
    if (!emp.active) throw new HttpError(403, 'Funcionário inativo.');
    if (!worksAt({ unitIds: unitIdsOf(emp) }, device.unit_id)) throw new HttpError(403, 'Esta pessoa não trabalha nesta unidade.');
    const since = clock().toISOString();
    await db.prepare('UPDATE devices SET employee_id = ?, session_since = ? WHERE id = ?').run(emp.id, since, device.id);
    res.status(201).json({ employee: toPublic(emp), since: sinceLabel(since) });
  }));

  r.delete('/session', route(async (_req, res) => {
    const device = res.locals.device as DeviceRow;
    await db.prepare('UPDATE devices SET employee_id = NULL, session_since = NULL WHERE id = ?').run(device.id);
    res.status(204).end();
  }));

  return r;
}
