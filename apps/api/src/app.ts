import express from 'express';
import type { Db } from './db/index.js';

export type AppDeps = { db: Db };

export function createApp(_deps: AppDeps) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });

  return app;
}
