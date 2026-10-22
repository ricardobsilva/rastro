import { operationalNow } from '@rastro/domain';
import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { route } from '../../http.js';
import { requireAdmin } from '../../security/admin.js';
import { exportData, importData } from '../../services/backup.js';

export function adminBackupRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use(['/admin/export', '/admin/import'], requireAdmin(db, clock));

  r.get('/admin/export', route((_req, res) => {
    const now = clock();
    res
      .attachment(`rastro-dados-${operationalNow(now).date}.json`)
      .json(exportData(db, now));
  }));

  r.post('/admin/import', route((req, res) => {
    res.json(importData(db, req.body));
  }));

  return r;
}
