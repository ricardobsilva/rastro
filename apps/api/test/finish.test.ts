import { describe, expect, it } from 'vitest';
import { employeeAgent, setup } from './helpers/setup.js';

type Agent = Awaited<ReturnType<typeof employeeAgent>>;
const execId = async (agent: Agent, cl: string) =>
  ((await agent.get('/api/me/today')).body.cards as { executionId: number; checklistId: string }[]).find((c) => c.checklistId === cl)!.executionId;
async function mark(agent: Agent, id: number, items: string[]) {
  for (const i of items) await agent.put(`/api/me/executions/${id}/items/${i}`).send({ done: true });
}

describe('US06 — concluir checklist', () => {
  it('tudo feito → concluído (sucesso)', async () => {
    const { app } = setup();
    const agent = await employeeAgent(app, 'e1');
    const id = await execId(agent, 'c2');
    await mark(agent, id, ['i14', 'i25', 'i15']);
    const res = await agent.post(`/api/me/executions/${id}/finish`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pending: 0, kind: 'ok', message: 'Checklist concluído! Tudo registrado em seu nome.' });
  });

  it('obrigatório pendente bloqueia com a lista de nomes → 422 (erro)', async () => {
    const { app } = setup();
    const agent = await employeeAgent(app, 'e1');
    const id = await execId(agent, 'c1');
    await mark(agent, id, ['i1', 'i4', 'i6']);
    const res = await agent.post(`/api/me/executions/${id}/finish`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Falta 1 item obrigatório: Conferir talheres.');
    expect(res.body.details).toEqual({ missing: ['i3'] });
  });

  it('só opcionais pendentes → salva com aviso (borda)', async () => {
    const { app } = setup();
    const agent = await employeeAgent(app, 'e1');
    const id = await execId(agent, 'c1');
    await mark(agent, id, ['i1', 'i3', 'i4', 'i6']);
    const res = await agent.post(`/api/me/executions/${id}/finish`);
    expect(res.body).toEqual({ pending: 2, kind: 'warn', message: 'Checklist salvo. 2 itens continuam pendentes.' });
  });

  it('checklist sem obrigatórios conclui mesmo sem nada feito (borda)', async () => {
    const { app, db } = setup();
    db.prepare("UPDATE items SET required = 0 WHERE id = 'i15'").run();
    const agent = await employeeAgent(app, 'e1');
    const id = await execId(agent, 'c2');
    const res = await agent.post(`/api/me/executions/${id}/finish`);
    expect(res.body).toEqual({ pending: 3, kind: 'warn', message: 'Checklist salvo. 3 itens continuam pendentes.' });
  });

  it('obrigatório desmarcado depois volta a bloquear (borda)', async () => {
    const { app } = setup();
    const agent = await employeeAgent(app, 'e1');
    const id = await execId(agent, 'c2');
    await mark(agent, id, ['i14', 'i25', 'i15']);
    expect((await agent.post(`/api/me/executions/${id}/finish`)).status).toBe(200);
    await agent.put(`/api/me/executions/${id}/items/i15`).send({ done: false });
    expect((await agent.post(`/api/me/executions/${id}/finish`)).body.error).toBe('Falta 1 item obrigatório: Testar máquinas de cartão.');
  });

  it('de outro funcionário → 403; inexistente → 404 (erro)', async () => {
    const { app } = setup();
    const joao = await employeeAgent(app, 'e1');
    const ana = await employeeAgent(app, 'e2');
    const id = await execId(joao, 'c1');
    expect((await ana.post(`/api/me/executions/${id}/finish`)).status).toBe(403);
    expect((await joao.post('/api/me/executions/999/finish')).status).toBe(404);
  });
});
