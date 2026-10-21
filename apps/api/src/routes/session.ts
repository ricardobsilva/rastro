import { fmtMinute, operationalNow } from '@rastro/domain';
import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { HttpError, parse, route } from '../http.js';
import { getEmployee, listActiveEmployees, toPublic } from '../repos/employees.js';
import { type DeviceRow, requireDevice } from '../security/device.js';

const loginSchema = z.object({ employeeId: z.string({ message: 'Informe o funcionário.' }).min(1, 'Informe o funcionário.') });

export function sessionRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use(['/session', '/employees'], requireDevice(db));

  const sinceLabel = (iso: string | null) => (iso ? fmtMinute(operationalNow(new Date(iso)).minute) : null);

  r.get('/employees', route((_req, res) => {
    res.json(listActiveEmployees(db).map(toPublic));
  }));

  r.get('/session', route((_req, res) => {
    const device = res.locals.device as DeviceRow;
    const emp = device.employee_id ? getEmployee(db, device.employee_id) : undefined;
    if (!emp || !emp.active) return res.json({ employee: null, since: null });
    res.json({ employee: toPublic(emp), since: sinceLabel(device.session_since) });
  }));

  r.post('/session', route((req, res) => {
    const device = res.locals.device as DeviceRow;
    const { employeeId } = parse(loginSchema, req.body);
    const emp = getEmployee(db, employeeId);
    if (!emp) throw new HttpError(404, 'Funcionário não encontrado.');
    if (!emp.active) throw new HttpError(403, 'Funcionário inativo.');
    const since = clock().toISOString();
    db.prepare('UPDATE devices SET employee_id = ?, session_since = ? WHERE id = ?').run(emp.id, since, device.id);
    res.status(201).json({ employee: toPublic(emp), since: sinceLabel(since) });
  }));

  r.delete('/session', route((_req, res) => {
    const device = res.locals.device as DeviceRow;
    db.prepare('UPDATE devices SET employee_id = NULL, session_since = NULL WHERE id = ?').run(device.id);
    res.status(204).end();
  }));

  return r;
}
