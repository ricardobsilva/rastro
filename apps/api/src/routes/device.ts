import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { HttpError, parse, route } from '../http.js';
import { activeUnits } from '../repos/units.js';
import { DEVICE_COOKIE, type DeviceRow, findDevice, requireDevice } from '../security/device.js';
import { checkManagerPin } from '../security/pin.js';
import { hashToken, newToken } from '../security/tokens.js';

const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

const unitSchema = z.object({ unitId: z.string({ message: 'Escolha a unidade.' }).nullable() });

export function deviceRoutes({ db, clock, pinGuard }: AppContext) {
  const r = Router();

  r.get('/device', route(async (req, res) => {
    res.json({ authorized: !!(await findDevice(db, req)) });
  }));

  r.post('/device/authorize', route(async (req, res) => {
    const manager = await checkManagerPin(db, pinGuard, `device:${req.ip}`, req.body);
    const token = newToken();
    await db.prepare('INSERT INTO devices (token_hash, authorized_by, created_at) VALUES (?, ?, ?)')
      .run(hashToken(token), manager.id, clock().toISOString());
    res
      .cookie(DEVICE_COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: TEN_YEARS_MS, path: '/' })
      .status(201)
      .json({ authorized: true, units: await activeUnits(db) });
  }));

  /** Define a unidade de um aparelho já autorizado (null = sem unidade fixa). Encerra a sessão aberta nele. */
  r.put('/device/unit', requireDevice(db), route(async (req, res) => {
    await checkManagerPin(db, pinGuard, `device:${req.ip}`, req.body);
    const { unitId } = parse(unitSchema, req.body);
    const unit = unitId === null ? null : (await activeUnits(db)).find((u) => u.id === unitId);
    if (unit === undefined) throw new HttpError(422, 'Unidade inválida.');
    await db.prepare('UPDATE devices SET unit_id = ?, employee_id = NULL, session_since = NULL WHERE id = ?')
      .run(unitId, (res.locals.device as DeviceRow).id);
    res.json({ unit });
  }));

  return r;
}
