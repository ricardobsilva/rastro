import { fmtMinute, longDate } from '@rastro/domain';
import { Router } from 'express';
import type { AppContext } from '../context.js';
import { route } from '../http.js';
import { listActiveEmployees, toPublic } from '../repos/employees.js';
import { requireDevice } from '../security/device.js';
import { currentDay } from '../services/day.js';
import { progressByEmployee } from '../services/progress.js';

export function stationRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/station', requireDevice(db));

  r.get('/station/team', route((_req, res) => {
    const now = currentDay(db, clock);
    const progress = progressByEmployee(db, now.date, now.minute);
    res.json({
      now: fmtMinute(now.minute),
      dateLabel: longDate(now.date),
      members: listActiveEmployees(db).map((e) => ({ ...toPublic(e), ...(progress.get(e.id) ?? { done: 0, total: 0, late: 0 }) })),
    });
  }));

  return r;
}
