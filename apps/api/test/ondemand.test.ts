import { describe, expect, it } from 'vitest';
import { employeeAgent, setup } from './helpers/setup.js';

describe('US07 — checklists sob demanda', () => {
  describe('sucesso', () => {
    it('aparece em "Quando necessário" para quem é responsável, fora dos cartões', async () => {
      const { app } = setup();
      const res = await (await employeeAgent(app, 'e3')).get('/api/me/today');
      expect(res.body.onDemand).toEqual([
        { checklistId: 'c10', name: 'Recebimento de compras', description: 'Usar sempre que chegar mercadoria.', itemCount: 3 },
      ]);
      expect(res.body.cards.map((c: { checklistId: string }) => c.checklistId)).not.toContain('c10');
    });

    it('iniciar cria a instância do dia, que passa para os cartões e sai da seção', async () => {
      const { app } = setup({ local: '2026-10-21T23:00' });
      const agent = await employeeAgent(app, 'e3');
      const start = await agent.post('/api/me/ondemand/c10/start');
      expect(start.status).toBe(201);
      const exec = await agent.get(`/api/me/executions/${start.body.executionId}`);
      expect(exec.body).toMatchObject({ name: 'Recebimento de compras', dueTime: null, total: 3, status: 'pending' });
      const today = await agent.get('/api/me/today');
      expect(today.body.onDemand).toEqual([]);
      expect(today.body.cards.find((c: { checklistId: string }) => c.checklistId === 'c10')).toMatchObject({ status: 'pending', dueTime: null });
    });
  });

  describe('erro', () => {
    it('checklist que não é sob demanda → 422', async () => {
      const { app } = setup();
      const res = await (await employeeAgent(app, 'e3')).post('/api/me/ondemand/c3/start');
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Este checklist não é sob demanda.');
    });

    it('sem ser responsável → 403', async () => {
      const { app } = setup();
      const res = await (await employeeAgent(app, 'e1')).post('/api/me/ondemand/c10/start');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Este checklist não está atribuído a você.');
    });

    it('inexistente ou inativo → 404', async () => {
      const { app, db } = setup();
      const agent = await employeeAgent(app, 'e3');
      expect((await agent.post('/api/me/ondemand/xx/start')).status).toBe(404);
      db.prepare("UPDATE checklists SET active = 0 WHERE id = 'c10'").run();
      expect((await agent.post('/api/me/ondemand/c10/start')).status).toBe(404);
      expect((await agent.get('/api/me/today')).body.onDemand).toEqual([]);
    });
  });

  describe('borda', () => {
    it('iniciar duas vezes no mesmo dia devolve a mesma instância', async () => {
      const { app } = setup();
      const agent = await employeeAgent(app, 'e3');
      const a = await agent.post('/api/me/ondemand/c10/start');
      const b = await agent.post('/api/me/ondemand/c10/start');
      expect(b.status).toBe(200);
      expect(b.body.executionId).toBe(a.body.executionId);
    });

    it('cada responsável tem a sua instância', async () => {
      const { app } = setup();
      const carlos = await (await employeeAgent(app, 'e3')).post('/api/me/ondemand/c10/start');
      const bia = await (await employeeAgent(app, 'e4')).post('/api/me/ondemand/c10/start');
      expect(bia.body.executionId).not.toBe(carlos.body.executionId);
    });

    it('no dia seguinte volta para "Quando necessário"', async () => {
      const { app, clock } = setup({ local: '2026-10-21T10:00' });
      const agent = await employeeAgent(app, 'e3');
      await agent.post('/api/me/ondemand/c10/start');
      clock.set('2026-10-22T10:00');
      expect((await agent.get('/api/me/today')).body.onDemand.map((o: { checklistId: string }) => o.checklistId)).toEqual(['c10']);
    });

    it('sob demanda nunca fica atrasado, nem de madrugada', async () => {
      const { app, clock } = setup({ local: '2026-10-21T10:00' });
      const agent = await employeeAgent(app, 'e3');
      const { body } = await agent.post('/api/me/ondemand/c10/start');
      clock.set('2026-10-22T03:00');
      expect((await agent.get(`/api/me/executions/${body.executionId}`)).body.status).toBe('pending');
    });
  });
});
