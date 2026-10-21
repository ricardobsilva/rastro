import cookieParser from 'cookie-parser';
import express from 'express';
import type { AppContext } from './context.js';
import type { Db } from './db/index.js';
import { errorHandler } from './http.js';
import { deviceRoutes } from './routes/device.js';
import { meRoutes } from './routes/me.js';
import { sessionRoutes } from './routes/session.js';
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

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });
  app.use(errorHandler);

  return app;
}
