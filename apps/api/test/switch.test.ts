import { describe, expect, it } from 'vitest';
import { employeeAgent, setup } from './helpers/setup.js';

describe('US09 — troca rápida de usuário', () => {
  it('depois da troca, as marcações vão para o novo funcionário (sucesso)', async () => {
    const { app, db } = setup();
    const agent = await employeeAgent(app, 'e1');
    expect((await agent.post('/api/session').send({ employeeId: 'e2' })).status).toBe(201);
    const card = (await agent.get('/api/me/today')).body.cards.find((c: { checklistId: string }) => c.checklistId === 'c1');
    await agent.put(`/api/me/executions/${card.executionId}/items/i1`).send({ done: true });
    expect(db.prepare('SELECT employee_id FROM audit_events').all()).toEqual([{ employee_id: 'e2' }]);
  });

  it('a execução aberta do anterior fica inacessível ao novo usuário (erro)', async () => {
    const { app } = setup();
    const agent = await employeeAgent(app, 'e1');
    const card = (await agent.get('/api/me/today')).body.cards[0];
    await agent.post('/api/session').send({ employeeId: 'e2' });
    expect((await agent.put(`/api/me/executions/${card.executionId}/items/i1`).send({ done: true })).status).toBe(403);
  });

  it('trocar para funcionário inativo → 403 e mantém a sessão atual (erro)', async () => {
    const { app } = setup();
    const agent = await employeeAgent(app, 'e1');
    expect((await agent.post('/api/session').send({ employeeId: 'e8' })).status).toBe(403);
    expect((await agent.get('/api/session')).body.employee.id).toBe('e1');
  });

  it('trocar para si mesmo renova o horário da sessão (borda)', async () => {
    const { app, clock } = setup({ local: '2026-10-21T09:00' });
    const agent = await employeeAgent(app, 'e1');
    clock.set('2026-10-21T10:00');
    expect((await agent.post('/api/session').send({ employeeId: 'e1' })).body.since).toBe('10:00');
  });
});
