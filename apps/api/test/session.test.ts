import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { authorizedAgent, setup } from './helpers/setup.js';

describe('US02 — identificação do funcionário', () => {
  describe('GET /api/employees', () => {
    it('lista só os ativos, com iniciais e nome curto (sucesso)', async () => {
      const { app } = setup();
      const agent = await authorizedAgent(app);
      const res = await agent.get('/api/employees');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(7);
      expect(res.body.find((e: { id: string }) => e.id === 'e8')).toBeUndefined();
      expect(res.body[0]).toEqual({
        id: 'e1', name: 'João Silva', shortName: 'João S.', firstName: 'João', initials: 'JS',
        role: 'Garçom', group: 'Salão', color: '#C2502F',
      });
    });

    it('sem aparelho autorizado → 401 (erro)', async () => {
      const { app } = setup();
      expect((await request(app).get('/api/employees')).status).toBe(401);
    });
  });

  describe('POST /api/session', () => {
    it('um toque abre a sessão no aparelho (sucesso)', async () => {
      const { app } = setup({ local: '2026-10-21T09:31' });
      const agent = await authorizedAgent(app);
      const res = await agent.post('/api/session').send({ employeeId: 'e1' });
      expect(res.status).toBe(201);
      expect(res.body.employee).toMatchObject({ id: 'e1', firstName: 'João' });
      expect(res.body.since).toBe('09:31');
      const again = await agent.get('/api/session');
      expect(again.body).toMatchObject({ employee: { id: 'e1' }, since: '09:31' });
    });

    it('funcionário inexistente → 404 (erro)', async () => {
      const { app } = setup();
      const agent = await authorizedAgent(app);
      const res = await agent.post('/api/session').send({ employeeId: 'xx' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Funcionário não encontrado.');
    });

    it('funcionário inativo → 403 (erro)', async () => {
      const { app } = setup();
      const agent = await authorizedAgent(app);
      const res = await agent.post('/api/session').send({ employeeId: 'e8' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Funcionário inativo.');
    });

    it('corpo sem employeeId → 422 (erro)', async () => {
      const { app } = setup();
      const agent = await authorizedAgent(app);
      expect((await agent.post('/api/session').send({})).status).toBe(422);
    });

    it('sem aparelho autorizado → 401 (erro)', async () => {
      const { app } = setup();
      expect((await request(app).post('/api/session').send({ employeeId: 'e1' })).status).toBe(401);
    });
  });

  describe('sessão persistente', () => {
    it('sem sessão retorna employee null (borda)', async () => {
      const { app } = setup();
      const agent = await authorizedAgent(app);
      expect((await agent.get('/api/session')).body).toEqual({ employee: null, since: null });
    });

    it('a sessão é do aparelho: outro aparelho não herda (borda)', async () => {
      const { app } = setup();
      const a = await authorizedAgent(app);
      const b = await authorizedAgent(app);
      await a.post('/api/session').send({ employeeId: 'e1' });
      expect((await b.get('/api/session')).body.employee).toBeNull();
    });

    it('sessão continua no dia seguinte, até trocar ou sair (borda)', async () => {
      const { app, clock } = setup();
      const agent = await authorizedAgent(app);
      await agent.post('/api/session').send({ employeeId: 'e1' });
      clock.advanceMinutes(60 * 24 * 3);
      expect((await agent.get('/api/session')).body.employee.id).toBe('e1');
    });

    it('funcionário desativado depois: sessão salva vira "sem sessão" (borda)', async () => {
      const { app, db } = setup();
      const agent = await authorizedAgent(app);
      await agent.post('/api/session').send({ employeeId: 'e1' });
      db.prepare("UPDATE employees SET active = 0 WHERE id = 'e1'").run();
      expect((await agent.get('/api/session')).body.employee).toBeNull();
    });

    it('DELETE encerra a sessão do aparelho (sucesso)', async () => {
      const { app } = setup();
      const agent = await authorizedAgent(app);
      await agent.post('/api/session').send({ employeeId: 'e1' });
      expect((await agent.delete('/api/session')).status).toBe(204);
      expect((await agent.get('/api/session')).body.employee).toBeNull();
    });

    it('DELETE sem sessão é idempotente (borda)', async () => {
      const { app } = setup();
      const agent = await authorizedAgent(app);
      expect((await agent.delete('/api/session')).status).toBe(204);
    });
  });
});
