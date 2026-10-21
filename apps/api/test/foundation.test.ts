import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db/index.js';
import { seed } from '../src/db/seed.js';

describe('US00 — fundação', () => {
  describe('GET /api/health', () => {
    it('responde 200 com status ok (sucesso)', async () => {
      const app = createApp({ db: openDb() });
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('rotas inexistentes', () => {
    it('respondem 404 em JSON (erro)', async () => {
      const app = createApp({ db: openDb() });
      const res = await request(app).get('/api/nao-existe');
      expect(res.status).toBe(404);
      expect(res.type).toMatch(/json/);
      expect(res.body).toEqual({ error: 'Rota não encontrada.' });
    });
  });

  describe('seed Casa Brasa', () => {
    it('popula funcionários, itens e checklists (sucesso)', () => {
      const db = openDb();
      seed(db);
      const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
      expect(count('employees')).toBe(8);
      expect(count('items')).toBe(26);
      expect(count('checklists')).toBe(11);
      expect(count('checklist_items')).toBeGreaterThan(0);
    });

    it('é idempotente: rodar duas vezes não duplica (borda)', () => {
      const db = openDb();
      seed(db);
      seed(db);
      const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
      expect(count('employees')).toBe(8);
      expect(count('items')).toBe(26);
      expect(count('checklists')).toBe(11);
      expect(count('checklist_items')).toBe(40);
    });

    it('preserva a ordem dos itens no checklist (borda)', () => {
      const db = openDb();
      seed(db);
      const ids = db
        .prepare('SELECT item_id FROM checklist_items WHERE checklist_id = ? ORDER BY position')
        .all('c4')
        .map((r) => (r as { item_id: string }).item_id);
      expect(ids).toEqual(['i7', 'i8', 'i11', 'i10', 'i6']);
    });
  });
});
