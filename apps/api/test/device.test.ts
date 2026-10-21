import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { MANAGER_PIN, authorizedAgent, setup } from './helpers/setup.js';

describe('US01 — autorizar aparelho', () => {
  describe('sucesso', () => {
    it('PIN de gestor ativo autoriza o aparelho e define cookie httpOnly', async () => {
      const { app } = setup();
      const res = await request(app).post('/api/device/authorize').send({ pin: MANAGER_PIN });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ authorized: true });
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toMatch(/rastro_device=/);
      expect(cookie).toMatch(/HttpOnly/i);
    });

    it('aparelho autorizado acessa rotas de funcionário', async () => {
      const { app } = setup();
      const agent = await authorizedAgent(app);
      expect((await agent.get('/api/device')).body).toEqual({ authorized: true });
      expect((await agent.get('/api/session')).status).toBe(200);
    });

    it('guarda só o hash do token e quem autorizou', async () => {
      const { app, db } = setup();
      const res = await request(app).post('/api/device/authorize').send({ pin: MANAGER_PIN });
      const token = /rastro_device=([^;]+)/.exec(String(res.headers['set-cookie']))![1]!;
      const row = db.prepare('SELECT token_hash, authorized_by FROM devices').get() as { token_hash: string; authorized_by: string };
      expect(row.authorized_by).toBe('e6');
      expect(row.token_hash).not.toContain(token);
      expect(row.token_hash).toHaveLength(64);
    });
  });

  describe('erro', () => {
    it('PIN que não é de gestor → 401', async () => {
      const { app } = setup();
      const res = await request(app).post('/api/device/authorize').send({ pin: '9999' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('PIN sem permissão de gestor.');
    });

    it('rota de funcionário sem cookie → 401', async () => {
      const { app } = setup();
      const res = await request(app).get('/api/session');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Aparelho não autorizado.');
    });

    it('token desconhecido → 401', async () => {
      const { app } = setup();
      const res = await request(app).get('/api/session').set('Cookie', 'rastro_device=forjado');
      expect(res.status).toBe(401);
    });

    it('GET /api/device sem cookie informa não autorizado (sem erro)', async () => {
      const { app } = setup();
      const res = await request(app).get('/api/device');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ authorized: false });
    });
  });

  describe('borda', () => {
    it.each([['123'], ['12345'], ['12a4'], [''], [1234]])('PIN malformado %j → 422', async (pin) => {
      const { app } = setup();
      const res = await request(app).post('/api/device/authorize').send({ pin });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('O PIN deve ter 4 números.');
    });

    it('gestor ativo mas desativado depois: aparelho continua autorizado', async () => {
      const { app, db } = setup();
      const agent = await authorizedAgent(app);
      db.prepare("UPDATE employees SET active = 0 WHERE id = 'e6'").run();
      expect((await agent.get('/api/session')).status).toBe(200);
    });

    it('PIN de gestor inativo não autoriza', async () => {
      const { app, db } = setup();
      db.prepare("UPDATE employees SET active = 0 WHERE id = 'e6'").run();
      const res = await request(app).post('/api/device/authorize').send({ pin: MANAGER_PIN });
      expect(res.status).toBe(401);
    });

    it('5 tentativas erradas bloqueiam (429), inclusive o PIN certo, até passar 5 minutos', async () => {
      const { app, clock } = setup();
      for (let i = 0; i < 5; i++) {
        expect((await request(app).post('/api/device/authorize').send({ pin: '0000' })).status).toBe(401);
      }
      const blocked = await request(app).post('/api/device/authorize').send({ pin: MANAGER_PIN });
      expect(blocked.status).toBe(429);
      expect(blocked.body.error).toBe('Muitas tentativas. Tente novamente em alguns minutos.');
      clock.advanceMinutes(5);
      expect((await request(app).post('/api/device/authorize').send({ pin: MANAGER_PIN })).status).toBe(201);
    });

    it('acerto zera o contador de falhas', async () => {
      const { app } = setup();
      for (let i = 0; i < 4; i++) await request(app).post('/api/device/authorize').send({ pin: '0000' });
      await request(app).post('/api/device/authorize').send({ pin: MANAGER_PIN });
      for (let i = 0; i < 4; i++) await request(app).post('/api/device/authorize').send({ pin: '0000' });
      expect((await request(app).post('/api/device/authorize').send({ pin: MANAGER_PIN })).status).toBe(201);
    });
  });
});
