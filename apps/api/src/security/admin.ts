import type { Request, RequestHandler } from 'express';
import type { Db } from '../db/index.js';
import { HttpError } from '../http.js';
import { type EmployeeRow, getEmployee } from '../repos/employees.js';
import { hashToken } from './tokens.js';

export const ADMIN_COOKIE = 'rastro_admin';
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

export function findAdmin(db: Db, req: Request, now: Date): EmployeeRow | undefined {
  const token = req.cookies?.[ADMIN_COOKIE];
  if (typeof token !== 'string' || !token) return undefined;
  const s = db.prepare('SELECT employee_id, expires_at FROM admin_sessions WHERE token_hash = ?').get(hashToken(token)) as
    | { employee_id: string; expires_at: string }
    | undefined;
  if (!s || new Date(s.expires_at).getTime() <= now.getTime()) return undefined;
  const emp = getEmployee(db, s.employee_id);
  return emp && emp.active && emp.grp === 'Gerência' ? emp : undefined;
}

/** Exige sessão de gestor válida: `res.locals.manager`. */
export const requireAdmin =
  (db: Db, clock: () => Date): RequestHandler =>
  (req, res, next) => {
    const manager = findAdmin(db, req, clock());
    if (!manager) return next(new HttpError(401, 'Acesso restrito ao gestor.'));
    res.locals.manager = manager;
    next();
  };
