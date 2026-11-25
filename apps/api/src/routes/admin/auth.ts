import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { route } from '../../http.js';
import { type EmployeeRow, getEmployee, toPublic } from '../../repos/employees.js';
import { loadUnits } from '../../repos/units.js';
import { ADMIN_COOKIE, ADMIN_SESSION_MS, requireAdmin } from '../../security/admin.js';
import { checkManagerPin } from '../../security/pin.js';
import { hashToken, newToken } from '../../security/tokens.js';
import { currentDay } from '../../services/day.js';
import { reportRows } from '../../services/report.js';

export function adminAuthRoutes({ db, clock, pinGuard }: AppContext) {
  const r = Router();

  r.post('/admin/login', route(async (req, res) => {
    const manager = await checkManagerPin(db, pinGuard, `admin:${req.ip}`, req.body);
    const token = newToken();
    const now = clock();
    await db.prepare('INSERT INTO admin_sessions (token_hash, employee_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), manager.id, now.toISOString(), new Date(now.getTime() + ADMIN_SESSION_MS).toISOString());
    res
      .cookie(ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'strict', maxAge: ADMIN_SESSION_MS, path: '/' })
      .status(201)
      .json({ manager: toPublic((await getEmployee(db, manager.id))!) });
  }));

  r.delete('/admin/login', route(async (req, res) => {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (typeof token === 'string') await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hashToken(token));
    res.clearCookie(ADMIN_COOKIE, { path: '/' }).status(204).end();
  }));

  r.get('/admin/me', requireAdmin(db, clock), route(async (_req, res) => {
    const now = await currentDay(db, clock);
    const [rows, units] = await Promise.all([reportRows(db, now.date, now), loadUnits(db)]);
    const late = rows.filter((x) => x.status === 'late');
    res.json({
      manager: toPublic(res.locals.manager as EmployeeRow), lateToday: late.length,
      units: units.map((u) => ({ ...u, lateToday: late.filter((x) => x.unitId === u.id).length })),
    });
  }));

  return r;
}
