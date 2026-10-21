import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { authorizedAgent, employeeAgent, setup } from './helpers/setup.js';

type Agent = Awaited<ReturnType<typeof employeeAgent>>;

async function execId(agent: Agent, checklistId: string) {
  const res = await agent.get('/api/me/today');
  return (res.body.cards as { executionId: number; checklistId: string }[]).find((c) => c.checklistId === checklistId)!.executionId;
}
const events = (db: ReturnType<typeof setup>['db']) =>
  db.prepare('SELECT action, employee_id, employee_name, checklist_name, item_name, op_date, minute FROM audit_events ORDER BY id').all();

describe('US04 — marcar e desmarcar itens', () => {
  describe('sucesso', () => {
    it('GET da execução traz cabeçalho e itens na ordem do checklist', async () => {
      const { app } = setup({ local: '2026-10-21T10:00' });
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      const res = await agent.get(`/api/me/executions/${id}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id, name: 'Abertura do restaurante', dueTime: '10:30', done: 0, total: 6, status: 'pending' });
      expect(res.body.items[0]).toEqual({
        itemId: 'i1', name: 'Conferir organização das mesas', description: 'Mesas alinhadas, cadeiras posicionadas e toalhas sem manchas.',
        required: true, allowNote: false, status: 'pending', doneAt: null, undoneAt: null, note: '',
      });
    });

    it('marcar grava status, horário do servidor e evento "done" com snapshot', async () => {
      const { app, db } = setup({ local: '2026-10-21T10:12' });
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      const res = await agent.put(`/api/me/executions/${id}/items/i4`).send({ done: true });
      expect(res.status).toBe(200);
      expect(res.body.items.find((i: { itemId: string }) => i.itemId === 'i4')).toMatchObject({ status: 'done', doneAt: '10:12' });
      expect(res.body).toMatchObject({ done: 1, status: 'progress' });
      expect(events(db)).toEqual([{
        action: 'done', employee_id: 'e1', employee_name: 'João Silva', checklist_name: 'Abertura do restaurante',
        item_name: 'Verificar limpeza do salão', op_date: '2026-10-21', minute: 612,
      }]);
    });

    it('desmarcar volta a pendente, guarda o horário e não apaga o "done" original', async () => {
      const { app, db, clock } = setup({ local: '2026-10-21T10:12' });
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      await agent.put(`/api/me/executions/${id}/items/i4`).send({ done: true });
      clock.set('2026-10-21T10:20');
      const res = await agent.put(`/api/me/executions/${id}/items/i4`).send({ done: false });
      expect(res.body.items.find((i: { itemId: string }) => i.itemId === 'i4')).toMatchObject({ status: 'pending', doneAt: null, undoneAt: '10:20' });
      expect(events(db).map((e) => (e as { action: string }).action)).toEqual(['done', 'undone']);
    });

    it('todos os itens marcados → status done', async () => {
      const { app } = setup({ local: '2026-10-21T11:00' });
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c2');
      for (const i of ['i14', 'i25']) await agent.put(`/api/me/executions/${id}/items/${i}`).send({ done: true });
      const res = await agent.put(`/api/me/executions/${id}/items/i15`).send({ done: true });
      expect(res.body).toMatchObject({ done: 3, total: 3, status: 'done' });
    });
  });

  describe('erro', () => {
    it('execução de outro funcionário → 403', async () => {
      const { app } = setup();
      const joao = await employeeAgent(app, 'e1');
      const ana = await employeeAgent(app, 'e2');
      const id = await execId(joao, 'c1');
      expect((await ana.get(`/api/me/executions/${id}`)).status).toBe(403);
      const res = await ana.put(`/api/me/executions/${id}/items/i1`).send({ done: true });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Este checklist pertence a outro funcionário.');
    });

    it('item que não pertence ao checklist → 404', async () => {
      const { app } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      const res = await agent.put(`/api/me/executions/${id}/items/i23`).send({ done: true });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Item não encontrado neste checklist.');
    });

    it('execução inexistente → 404', async () => {
      const { app } = setup();
      const agent = await employeeAgent(app, 'e1');
      expect((await agent.get('/api/me/executions/99999')).status).toBe(404);
      expect((await agent.get('/api/me/executions/abc')).status).toBe(404);
    });

    it('sem funcionário identificado → 401; corpo inválido → 422', async () => {
      const { app } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      expect((await (await authorizedAgent(app)).put(`/api/me/executions/${id}/items/i1`).send({ done: true })).status).toBe(401);
      expect((await request(app).put(`/api/me/executions/${id}/items/i1`).send({ done: true })).status).toBe(401);
      expect((await agent.put(`/api/me/executions/${id}/items/i1`).send({ done: 'sim' })).status).toBe(422);
    });
  });

  describe('borda', () => {
    it('marcar → desmarcar → marcar gera 3 eventos', async () => {
      const { app, db } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      for (const done of [true, false, true]) await agent.put(`/api/me/executions/${id}/items/i1`).send({ done });
      expect(events(db).map((e) => (e as { action: string }).action)).toEqual(['done', 'undone', 'done']);
    });

    it('duplo clique (marcar duas vezes) não duplica o evento', async () => {
      const { app, db } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      await agent.put(`/api/me/executions/${id}/items/i1`).send({ done: true });
      await agent.put(`/api/me/executions/${id}/items/i1`).send({ done: true });
      await agent.put(`/api/me/executions/${id}/items/i2`).send({ done: false });
      expect(events(db)).toHaveLength(1);
    });

    it('desmarcar depois do prazo volta como atrasado', async () => {
      const { app, clock } = setup({ local: '2026-10-21T10:00' });
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      await agent.put(`/api/me/executions/${id}/items/i1`).send({ done: true });
      clock.set('2026-10-21T10:45');
      const res = await agent.put(`/api/me/executions/${id}/items/i1`).send({ done: false });
      expect(res.body.items[0].status).toBe('late');
    });

    it('checklist de um dia anterior não aceita marcação → 409', async () => {
      const { app, clock } = setup({ local: '2026-10-21T10:00' });
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      clock.set('2026-10-22T10:00');
      const res = await agent.put(`/api/me/executions/${id}/items/i1`).send({ done: true });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Este checklist é de um dia anterior.');
    });

    it('marcação de madrugada conta para o dia operacional anterior', async () => {
      const { app, db } = setup({ local: '2026-10-22T00:20' });
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c5');
      const res = await agent.put(`/api/me/executions/${id}/items/i26`).send({ done: true });
      expect(res.body.items[0].doneAt).toBe('00:20');
      expect(events(db)[0]).toMatchObject({ op_date: '2026-10-21', minute: 1460 });
    });

    it('item desativado depois de marcado some da execução, mas o evento continua', async () => {
      const { app, db } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      await agent.put(`/api/me/executions/${id}/items/i2`).send({ done: true });
      db.prepare("UPDATE items SET active = 0 WHERE id = 'i2'").run();
      const res = await agent.get(`/api/me/executions/${id}`);
      expect(res.body.items.map((i: { itemId: string }) => i.itemId)).not.toContain('i2');
      expect((await agent.put(`/api/me/executions/${id}/items/i2`).send({ done: false })).status).toBe(404);
      expect(events(db)).toHaveLength(1);
    });

    it('renomear o item depois não altera o nome gravado no evento', async () => {
      const { app, db } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      await agent.put(`/api/me/executions/${id}/items/i3`).send({ done: true });
      db.prepare("UPDATE items SET name = 'Talheres (novo nome)' WHERE id = 'i3'").run();
      expect((events(db)[0] as { item_name: string }).item_name).toBe('Conferir talheres');
    });
  });
});
