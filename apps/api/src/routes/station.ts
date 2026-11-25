import { fmtMinute, longDate, worksAt } from '@rastro/domain';
import { Router } from 'express';
import type { AppContext } from '../context.js';
import { route } from '../http.js';
import { listActiveEmployees, toPublic, unitIdsOf } from '../repos/employees.js';
import { loadUnits } from '../repos/units.js';
import { type DeviceRow, requireDevice } from '../security/device.js';
import { currentDay } from '../services/day.js';
import { progressByEmployee } from '../services/progress.js';

export function stationRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/station', requireDevice(db));

  r.get('/station/team', route(async (_req, res) => {
    const now = await currentDay(db, clock);
    const { unit_id: unitId } = res.locals.device as DeviceRow;
    const [progress, employees, units] = await Promise.all([
      progressByEmployee(db, now.date, now.minute, unitId), listActiveEmployees(db), loadUnits(db),
    ]);
    const unit = units.find((u) => u.id === unitId);
    res.json({
      now: fmtMinute(now.minute),
      dateLabel: longDate(now.date),
      unit: unit ? { id: unit.id, name: unit.name } : null,
      units: units.filter((u) => u.active).map(({ id, name }) => ({ id, name })),
      members: employees.filter((e) => worksAt({ unitIds: unitIdsOf(e) }, unitId)).map((e) => ({ ...toPublic(e), ...(progress.get(e.id) ?? { done: 0, total: 0, late: 0 }) })),
    });
  }));

  return r;
}
