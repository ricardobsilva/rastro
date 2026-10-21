import { Router } from 'express';
import type { AppContext } from '../context.js';
import { route } from '../http.js';
import { requireDevice } from '../security/device.js';

export function sessionRoutes({ db }: AppContext) {
  const r = Router();
  r.use('/session', requireDevice(db));

  r.get('/session', route((_req, res) => {
    res.json({ employee: null });
  }));

  return r;
}
