import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { MANAGER_PIN, adminAgent, employeeAgent, setup } from './helpers/setup.js';

describe('US11 — acesso do gestor', () => {
  describe('sucesso', () => {
    it('PIN de gestor ativo abre a sessão administrativa', async () => {
      const { app } = setup();
      const res = await request(app).post('/api/admin/login').send({ pin: MANAGER_PIN });
      expect(res.status).toBe(201);
      expect(res.body.manager).toMatchObject({ id: 'e6', name: 'Marina Alves', role: 'Gerente', initials: 'MA' });
      expect(String(res.headers['set-cookie'])).toMatch(/rastro_admin=.*HttpOnly/i);
    });

    it('/api/admin/me traz o gestor e o nº de atrasos de hoje para o badge', async () => {
      const { app } = setup({ local: '2026-10-21T11:40' });
      const res = await (await adminAgent(app)).get('/api/admin/me');
      expect(res.status).toBe(200);
      expect(res.body.manager.id).toBe('e6');
      expect(res.body.lateToday).toBeGreaterThan(0);
    });

    it('sair encerra a sessão', async () => {
      const { app } = setup();
      const agent = await adminAgent(app);
      expect((await agent.delete('/api/admin/login')).status).toBe(204);
      expect((await agent.get('/api/admin/me')).status).toBe(401);
    });
  });

  describe('erro', () => {
    it('PIN de não-gestor ou inexistente → 401 com a mesma mensagem', async () => {
      const { app, db } = setup();
      db.prepare("UPDATE employees SET pin = '1111' WHERE id = 'e1'").run();
      for (const pin of ['1111', '9999']) {
        const res = await request(app).post('/api/admin/login').send({ pin });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('PIN sem permissão de gestor.');
      }
    });

    it('gestor inativo não entra', async () => {
      const { app, db } = setup();
      db.prepare("UPDATE employees SET active = 0 WHERE id = 'e6'").run();
      expect((await request(app).post('/api/admin/login').send({ pin: MANAGER_PIN })).status).toBe(401);
    });

    it('rotas admin sem sessão → 401; aparelho de funcionário não basta', async () => {
      const { app } = setup();
      expect((await request(app).get('/api/admin/me')).status).toBe(401);
      const emp = await employeeAgent(app, 'e6');
      const res = await emp.get('/api/admin/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Acesso restrito ao gestor.');
    });
  });

  describe('borda', () => {
    it('PIN malformado → 422', async () => {
      const { app } = setup();
      expect((await request(app).post('/api/admin/login').send({ pin: '12' })).status).toBe(422);
    });

    it('5 tentativas erradas → 429', async () => {
      const { app } = setup();
      for (let i = 0; i < 5; i++) await request(app).post('/api/admin/login').send({ pin: '0000' });
      expect((await request(app).post('/api/admin/login').send({ pin: MANAGER_PIN })).status).toBe(429);
    });

    it('sessão expira em 12 horas', async () => {
      const { app, clock } = setup();
      const agent = await adminAgent(app);
      clock.advanceMinutes(12 * 60 - 1);
      expect((await agent.get('/api/admin/me')).status).toBe(200);
      clock.advanceMinutes(1);
      expect((await agent.get('/api/admin/me')).status).toBe(401);
    });

    it('gestor desativado ou rebaixado depois do login perde o acesso', async () => {
      const { app, db } = setup();
      const agent = await adminAgent(app);
      db.prepare("UPDATE employees SET grp = 'Salão' WHERE id = 'e6'").run();
      expect((await agent.get('/api/admin/me')).status).toBe(401);
    });
  });
});
