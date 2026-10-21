import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { route } from '../../http.js';
import { type EmployeeRow, getEmployee, toPublic } from '../../repos/employees.js';
import { ADMIN_COOKIE, ADMIN_SESSION_MS, requireAdmin } from '../../security/admin.js';
import { checkManagerPin } from '../../security/pin.js';
import { hashToken, newToken } from '../../security/tokens.js';
import { currentDay } from '../../services/day.js';
import { progressByEmployee } from '../../services/progress.js';

export function adminAuthRoutes({ db, clock, pinGuard }: AppContext) {
  const r = Router();

  r.post('/admin/login', route((req, res) => {
    const manager = checkManagerPin(db, pinGuard, `admin:${req.ip}`, req.body);
    const token = newToken();
    const now = clock();
    db.prepare('INSERT INTO admin_sessions (token_hash, employee_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), manager.id, now.toISOString(), new Date(now.getTime() + ADMIN_SESSION_MS).toISOString());
    res
      .cookie(ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'strict', maxAge: ADMIN_SESSION_MS, path: '/' })
      .status(201)
      .json({ manager: toPublic(getEmployee(db, manager.id)!) });
  }));

  r.delete('/admin/login', route((req, res) => {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (typeof token === 'string') db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hashToken(token));
    res.clearCookie(ADMIN_COOKIE, { path: '/' }).status(204).end();
  }));

  r.get('/admin/me', requireAdmin(db, clock), route((_req, res) => {
    const now = currentDay(db, clock);
    let lateToday = 0;
    for (const p of progressByEmployee(db, now.date, now.minute).values()) lateToday += p.late;
    res.json({ manager: toPublic(res.locals.manager as EmployeeRow), lateToday });
  }));

  return r;
}
