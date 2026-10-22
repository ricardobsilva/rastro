import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { AppContext } from './context.js';
import type { Db } from './db/index.js';
import { errorHandler } from './http.js';
import { adminAuthRoutes } from './routes/admin/auth.js';
import { adminBackupRoutes } from './routes/admin/backup.js';
import { adminChecklistRoutes } from './routes/admin/checklists.js';
import { adminDashboardRoutes } from './routes/admin/dashboard.js';
import { adminEmployeeRoutes } from './routes/admin/employees.js';
import { adminHistoryRoutes } from './routes/admin/history.js';
import { adminItemRoutes } from './routes/admin/items.js';
import { adminTeamRoutes } from './routes/admin/team.js';
import { deviceRoutes } from './routes/device.js';
import { meRoutes } from './routes/me.js';
import { sessionRoutes } from './routes/session.js';
import { stationRoutes } from './routes/station.js';
import { requireAdmin } from './security/admin.js';
import { PinGuard } from './security/pin-guard.js';

export type AppDeps = {
  db: Db;
  clock?: () => Date;
  /** Pasta do `vite build`. Em produção a API serve as telas; no desenvolvimento quem serve é o Vite. */
  staticDir?: string;
  /** Proxies confiáveis à frente da API (no Fly.io, 1). Padrão: só loopback. */
  trustProxy?: number | string;
};

export function createApp(deps: AppDeps) {
  const clock = deps.clock ?? (() => new Date());
  const ctx: AppContext = { db: deps.db, clock, pinGuard: new PinGuard(clock) };

  const app = express();
  app.set('trust proxy', deps.trustProxy ?? 'loopback');
  app.use(cookieParser());
  // A importação recebe o arquivo inteiro: limite maior, mas só depois de conferir a sessão do gestor.
  app.use('/api/admin/import', requireAdmin(deps.db, clock), express.json({ limit: '50mb' }));
  app.use(express.json());

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
  app.use('/api', adminHistoryRoutes(ctx));
  app.use('/api', adminBackupRoutes(ctx));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });

  if (deps.staticDir) {
    const dir = deps.staticDir;
    app.use(express.static(dir, { index: 'index.html' }));
    // Caminhos sem extensão (/, /estacao, /gestor…) abrem o app; o React escolhe a tela.
    app.get(/^\/(?!api\/)[^.]*$/, (_req, res) => res.sendFile(join(dir, 'index.html')));
  }
  app.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });
  app.use(errorHandler);

  return app;
}
