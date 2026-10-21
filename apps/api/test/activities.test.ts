import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { employeeAgent, setup } from './helpers/setup.js';

type Agent = Awaited<ReturnType<typeof employeeAgent>>;
const execId = async (agent: Agent, cl: string) =>
  ((await agent.get('/api/me/today')).body.cards as { executionId: number; checklistId: string }[]).find((c) => c.checklistId === cl)!.executionId;

describe('US08 — minhas atividades', () => {
  it('lista os eventos de hoje do próprio funcionário, mais recentes primeiro (sucesso)', async () => {
    const { app, clock } = setup({ local: '2026-10-21T09:52' });
    const agent = await employeeAgent(app, 'e1');
    const id = await execId(agent, 'c1');
    await agent.put(`/api/me/executions/${id}/items/i1`).send({ done: true });
    clock.set('2026-10-21T10:20');
    await agent.put(`/api/me/executions/${id}/items/i5/note`).send({ note: 'Restam 3 sacos.' });
    clock.set('2026-10-21T10:52');
    await agent.put(`/api/me/executions/${id}/items/i1`).send({ done: false });
    const res = await agent.get('/api/me/activities');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ time: '10:52', itemName: 'Conferir organização das mesas', checklistName: 'Abertura do restaurante', action: 'undone' }),
      expect.objectContaining({ time: '10:20', itemName: 'Conferir disponibilidade de arroz', action: 'note', note: 'Restam 3 sacos.' }),
      expect.objectContaining({ time: '09:52', action: 'done' }),
    ]);
  });

  it('sem sessão → 401 (erro)', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/me/activities')).status).toBe(401);
  });

  it('não mostra eventos de outros funcionários nem de outros dias (borda)', async () => {
    const { app, clock } = setup({ local: '2026-10-20T10:00' });
    const joao = await employeeAgent(app, 'e1');
    await joao.put(`/api/me/executions/${await execId(joao, 'c1')}/items/i1`).send({ done: true });
    clock.set('2026-10-21T10:00');
    const ana = await employeeAgent(app, 'e2');
    await ana.put(`/api/me/executions/${await execId(ana, 'c1')}/items/i1`).send({ done: true });
    expect((await joao.get('/api/me/activities')).body).toEqual([]);
    expect((await ana.get('/api/me/activities')).body).toHaveLength(1);
  });

  it('empate de horário ordena pela ordem de criação, mais recente primeiro (borda)', async () => {
    const { app } = setup({ local: '2026-10-21T10:00' });
    const agent = await employeeAgent(app, 'e1');
    const id = await execId(agent, 'c1');
    await agent.put(`/api/me/executions/${id}/items/i1`).send({ done: true });
    await agent.put(`/api/me/executions/${id}/items/i2`).send({ done: true });
    expect((await agent.get('/api/me/activities')).body.map((a: { itemName: string }) => a.itemName)).toEqual([
      'Verificar guardanapos', 'Conferir organização das mesas',
    ]);
  });
});
