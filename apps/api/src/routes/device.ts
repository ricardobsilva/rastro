import { Router } from 'express';
import type { AppContext } from '../context.js';
import { route } from '../http.js';
import { DEVICE_COOKIE, findDevice } from '../security/device.js';
import { checkManagerPin } from '../security/pin.js';
import { hashToken, newToken } from '../security/tokens.js';

const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

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
      .json({ authorized: true });
  }));

  return r;
}
