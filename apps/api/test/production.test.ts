import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prepareDb } from '../src/db/prepare.js';

/** Imita a saída do `vite build`: index.html + assets. */
function fakeWebBuild() {
  const dir = mkdtempSync(join(tmpdir(), 'rastro-web-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Rastro</title><div id="root"></div>');
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'app-123.js'), 'console.log("rastro")');
  return dir;
}

describe('Produção: a API serve as telas', () => {
  describe('sucesso', () => {
    it('serve o index.html em /, /estacao e /gestor (o React decide a tela pelo caminho)', async () => {
      const app = createApp({ db: prepareDb(':memory:'), staticDir: fakeWebBuild() });
      for (const path of ['/', '/estacao', '/gestor', '/gestor/qualquer']) {
        const res = await request(app).get(path);
        expect(res.status, path).toBe(200);
        expect(res.type, path).toMatch(/html/);
        expect(res.text, path).toContain('<div id="root">');
      }
    });

    it('serve os arquivos gerados pelo build', async () => {
      const app = createApp({ db: prepareDb(':memory:'), staticDir: fakeWebBuild() });
      const res = await request(app).get('/assets/app-123.js');
      expect(res.status).toBe(200);
      expect(res.type).toMatch(/javascript/);
      expect(res.text).toContain('rastro');
    });

    it('a API continua respondendo JSON, inclusive a checagem de saúde', async () => {
      const app = createApp({ db: prepareDb(':memory:'), staticDir: fakeWebBuild() });
      expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok' });
      const missing = await request(app).get('/api/nao-existe');
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual({ error: 'Rota não encontrada.' });
    });
  });

  describe('erro', () => {
    it('arquivo inexistente com extensão dá 404, não a página do app', async () => {
      const app = createApp({ db: prepareDb(':memory:'), staticDir: fakeWebBuild() });
      const res = await request(app).get('/assets/nao-existe.js');
      expect(res.status).toBe(404);
      expect(res.text).not.toContain('<div id="root">');
    });

    it('POST fora da API não cai na página do app', async () => {
      const app = createApp({ db: prepareDb(':memory:'), staticDir: fakeWebBuild() });
      expect((await request(app).post('/gestor')).status).toBe(404);
    });
  });

  describe('borda', () => {
    it('sem pasta de telas (desenvolvimento, o Vite serve), / não devolve HTML', async () => {
      const app = createApp({ db: prepareDb(':memory:') });
      const res = await request(app).get('/');
      expect(res.status).toBe(404);
    });

    it('atrás do proxy, o bloqueio de PIN vale por visitante, não para todos', async () => {
      const app = createApp({ db: prepareDb(':memory:'), trustProxy: 1 });
      const attempt = (ip: string) => request(app).post('/api/admin/login').set('X-Forwarded-For', ip).send({ pin: '0000' });
      for (let i = 0; i < 5; i++) await attempt('203.0.113.7');
      expect((await attempt('203.0.113.7')).status).toBe(429);
      expect((await attempt('198.51.100.20')).status).toBe(401);
    });

    it('o visitante não escapa do bloqueio inventando um X-Forwarded-For (vale o IP que o proxy acrescentou)', async () => {
      const app = createApp({ db: prepareDb(':memory:'), trustProxy: 1 });
      const attempt = (fake: string) =>
        request(app).post('/api/admin/login').set('X-Forwarded-For', `${fake}, 203.0.113.7`).send({ pin: '0000' });
      for (let i = 0; i < 5; i++) await attempt(`10.0.0.${i}`);
      expect((await attempt('10.0.0.99')).status).toBe(429);
    });
  });
});
