import type { Request, RequestHandler } from 'express';
import type { Db } from '../db/index.js';
import { HttpError } from '../http.js';
import { hashToken } from './tokens.js';

export const DEVICE_COOKIE = 'rastro_device';

export type DeviceRow = { id: number; employee_id: string | null; session_since: string | null; unit_id: string | null };

export async function findDevice(db: Db, req: Request): Promise<DeviceRow | undefined> {
  const token = req.cookies?.[DEVICE_COOKIE];
  if (typeof token !== 'string' || !token) return undefined;
  return (await db
    .prepare('SELECT id, employee_id, session_since, unit_id FROM devices WHERE token_hash = ?')
    .get(hashToken(token))) as DeviceRow | undefined;
}

/** Exige aparelho autorizado; disponibiliza `res.locals.device`. */
export const requireDevice =
  (db: Db): RequestHandler =>
  (req, res, next) => {
    findDevice(db, req).then((device) => {
      if (!device) return next(new HttpError(401, 'Aparelho não autorizado.'));
      res.locals.device = device;
      next();
    }, next);
  };
