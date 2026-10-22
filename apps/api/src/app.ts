import cookieParser from 'cookie-parser';
import express from 'express';
import type { AppContext } from './context.js';
import type { Db } from './db/index.js';
import { errorHandler } from './http.js';
import { adminAuthRoutes } from './routes/admin/auth.js';
import { adminChecklistRoutes } from './routes/admin/checklists.js';
import { adminDashboardRoutes } from './routes/admin/dashboard.js';
import { adminEmployeeRoutes } from './routes/admin/employees.js';
import { adminItemRoutes } from './routes/admin/items.js';
import { adminTeamRoutes } from './routes/admin/team.js';
import { deviceRoutes } from './routes/device.js';
import { meRoutes } from './routes/me.js';
import { sessionRoutes } from './routes/session.js';
import { stationRoutes } from './routes/station.js';
import { PinGuard } from './security/pin-guard.js';

export type AppDeps = { db: Db; clock?: () => Date };

export function createApp(deps: AppDeps) {
  const clock = deps.clock ?? (() => new Date());
  const ctx: AppContext = { db: deps.db, clock, pinGuard: new PinGuard(clock) };

  const app = express();
  app.set('trust proxy', 'loopback');
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api', deviceRoutes(ctx));
  app.use('/api', sessionRoutes(ctx));
  app.use('/api', meRoutes(ctx));
  app.use('/api', stationRoutes(ctx));
  app.use('/api', adminAuthRoutes(ctx));
  app.use('/api', adminItemRoutes(ctx));
  app.use('/api', adminEmployeeRoutes(ctx));
  app.use('/api', adminChecklistRoutes(ctx));
  app.use('/api', adminDashboardRoutes(ctx));
  app.use('/api', adminTeamRoutes(ctx));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });
  app.use(errorHandler);

  return app;
}
