import { describe, expect, it } from 'vitest';
import { employeeAgent, setup } from './helpers/setup.js';

type Agent = Awaited<ReturnType<typeof employeeAgent>>;
const execId = async (agent: Agent, cl: string) =>
  ((await agent.get('/api/me/today')).body.cards as { executionId: number; checklistId: string }[]).find((c) => c.checklistId === cl)!.executionId;
const notes = (db: ReturnType<typeof setup>['db']) =>
  db.prepare("SELECT note, item_name FROM audit_events WHERE action = 'note' ORDER BY id").all();
const itemOf = (body: { items: { itemId: string; note: string }[] }, id: string) => body.items.find((i) => i.itemId === id)!;

describe('US05 — observações', () => {
  describe('sucesso', () => {
    it('salva a observação (aparada) e registra evento "note"', async () => {
      const { app, db } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      const res = await agent.put(`/api/me/executions/${id}/items/i5/note`).send({ note: '  Restam 3 sacos de 5 kg.  ' });
      expect(res.status).toBe(200);
      expect(itemOf(res.body, 'i5').note).toBe('Restam 3 sacos de 5 kg.');
      expect(notes(db)).toEqual([{ note: 'Restam 3 sacos de 5 kg.', item_name: 'Conferir disponibilidade de arroz' }]);
    });

    it('pode observar item ainda não marcado, sem marcá-lo', async () => {
      const { app } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      const res = await agent.put(`/api/me/executions/${id}/items/i3/note`).send({ note: 'Faltam 12 garfos' });
      expect(itemOf(res.body, 'i3')).toMatchObject({ note: 'Faltam 12 garfos' });
      expect((itemOf(res.body, 'i3') as unknown as { status: string }).status).not.toBe('done');
    });
  });

  describe('erro', () => {
    it('item que não permite observação → 422', async () => {
      const { app } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      const res = await agent.put(`/api/me/executions/${id}/items/i1/note`).send({ note: 'x' });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Este item não permite observação.');
    });

    it('acima de 500 caracteres → 422', async () => {
      const { app } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      const res = await agent.put(`/api/me/executions/${id}/items/i5/note`).send({ note: 'a'.repeat(501) });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('A observação pode ter até 500 caracteres.');
    });

    it('nota não-texto → 422; execução de outro → 403', async () => {
      const { app } = setup();
      const joao = await employeeAgent(app, 'e1');
      const ana = await employeeAgent(app, 'e2');
      const id = await execId(joao, 'c1');
      expect((await joao.put(`/api/me/executions/${id}/items/i5/note`).send({ note: 5 })).status).toBe(422);
      expect((await ana.put(`/api/me/executions/${id}/items/i5/note`).send({ note: 'x' })).status).toBe(403);
    });
  });

  describe('borda', () => {
    it('exatamente 500 caracteres é aceito', async () => {
      const { app } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      expect((await agent.put(`/api/me/executions/${id}/items/i5/note`).send({ note: 'a'.repeat(500) })).status).toBe(200);
    });

    it('salvar vazio ou só espaços limpa a observação e não gera evento', async () => {
      const { app, db } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      await agent.put(`/api/me/executions/${id}/items/i5/note`).send({ note: 'algo' });
      const res = await agent.put(`/api/me/executions/${id}/items/i5/note`).send({ note: '   ' });
      expect(itemOf(res.body, 'i5').note).toBe('');
      expect(notes(db)).toHaveLength(1);
    });

    it('editar substitui o texto e gera novo evento; repetir o mesmo texto não gera', async () => {
      const { app, db } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      await agent.put(`/api/me/executions/${id}/items/i5/note`).send({ note: 'v1' });
      await agent.put(`/api/me/executions/${id}/items/i5/note`).send({ note: 'v2' });
      const res = await agent.put(`/api/me/executions/${id}/items/i5/note`).send({ note: 'v2' });
      expect(itemOf(res.body, 'i5').note).toBe('v2');
      expect(notes(db).map((n) => (n as { note: string }).note)).toEqual(['v1', 'v2']);
    });

    it('desmarcar e remarcar preserva a observação', async () => {
      const { app } = setup();
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      await agent.put(`/api/me/executions/${id}/items/i5/note`).send({ note: 'ok' });
      await agent.put(`/api/me/executions/${id}/items/i5`).send({ done: true });
      const res = await agent.put(`/api/me/executions/${id}/items/i5`).send({ done: false });
      expect(itemOf(res.body, 'i5').note).toBe('ok');
    });

    it('dia anterior → 409', async () => {
      const { app, clock } = setup({ local: '2026-10-21T10:00' });
      const agent = await employeeAgent(app, 'e1');
      const id = await execId(agent, 'c1');
      clock.set('2026-10-22T10:00');
      expect((await agent.put(`/api/me/executions/${id}/items/i5/note`).send({ note: 'x' })).status).toBe(409);
    });
  });
});
