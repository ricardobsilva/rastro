import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { adminAgent, employeeAgent, setup } from './helpers/setup.js';

type Agent = Awaited<ReturnType<typeof employeeAgent>>;
async function act(agent: Agent, cl: string, item: string, done: boolean) {
  const id = (await agent.get('/api/me/today')).body.cards.find((c: { checklistId: string }) => c.checklistId === cl).executionId;
  return agent.put(`/api/me/executions/${id}/items/${item}`).send({ done });
}
function insertEvents(db: ReturnType<typeof setup>['db'], n: number) {
  const ins = db.prepare(`INSERT INTO audit_events (op_date, minute, at, employee_id, employee_name, checklist_id, checklist_name, item_id, item_name, action)
    VALUES ('2026-10-21', ?, '', 'e2', 'Ana Costa', 'c1', 'Abertura do restaurante', 'i1', 'Conferir organização das mesas', 'done')`);
  for (let i = 0; i < n; i++) ins.run(600 + i);
}

describe('US17 — histórico e auditoria', () => {
  describe('sucesso', () => {
    it('lista eventos mais recentes primeiro com contadores', async () => {
      const { app, clock } = setup({ local: '2026-10-21T10:00' });
      const joao = await employeeAgent(app, 'e1');
      await act(joao, 'c1', 'i1', true);
      clock.set('2026-10-21T10:30');
      await act(joao, 'c1', 'i1', false);
      const res = await (await adminAgent(app)).get('/api/admin/history');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 2, undone: 1 });
      expect(res.body.rows[0]).toMatchObject({
        date: '2026-10-21', dateLabel: 'Hoje', time: '10:30', checklistName: 'Abertura do restaurante',
        itemName: 'Conferir organização das mesas', employeeName: 'João Silva', initials: 'JS', action: 'undone', note: '',
      });
      expect(res.body.rows[1].action).toBe('done');
    });

    it('paginação de 40 em 40', async () => {
      const { app, db } = setup();
      insertEvents(db, 85);
      const admin = await adminAgent(app);
      const p1 = (await admin.get('/api/admin/history')).body;
      expect(p1).toMatchObject({ total: 85 });
      expect(p1.rows).toHaveLength(40);
      const p3 = (await admin.get('/api/admin/history?offset=80')).body;
      expect(p3.rows).toHaveLength(5);
    });

    it('filtros combinados: data, funcionário, ação e busca', async () => {
      const { app, clock } = setup({ local: '2026-10-20T10:00' });
      const joao = await employeeAgent(app, 'e1');
      await act(joao, 'c1', 'i3', true);
      clock.set('2026-10-21T10:00');
      await act(joao, 'c1', 'i1', true);
      await act(await employeeAgent(app, 'e2'), 'c1', 'i1', true);
      const admin = await adminAgent(app);
      expect((await admin.get('/api/admin/history?date=2026-10-20')).body.rows.map((r: { itemName: string }) => r.itemName)).toEqual(['Conferir talheres']);
      expect((await admin.get('/api/admin/history?date=2026-10-20')).body.rows[0].dateLabel).toBe('20/10');
      expect((await admin.get('/api/admin/history?employeeId=e2')).body.total).toBe(1);
      expect((await admin.get('/api/admin/history?action=undone')).body.total).toBe(0);
      expect((await admin.get('/api/admin/history?q=talher&employeeId=e1')).body.total).toBe(1);
    });
  });

  describe('erro', () => {
    it('ação inválida ou data malformada → 422', async () => {
      const { app } = setup();
      const admin = await adminAgent(app);
      expect((await admin.get('/api/admin/history?action=apagado')).status).toBe(422);
      expect((await admin.get('/api/admin/history?date=21/10')).status).toBe(422);
    });

    it('sem gestor → 401; não há como alterar ou apagar eventos', async () => {
      const { app } = setup();
      expect((await request(app).get('/api/admin/history')).status).toBe(401);
      const admin = await adminAgent(app);
      expect((await admin.delete('/api/admin/history/1')).status).toBe(404);
      expect((await admin.put('/api/admin/history/1').send({})).status).toBe(404);
    });
  });

  describe('borda', () => {
    it('busca ignora maiúsculas e acentos ("CAMARAS" encontra "câmaras")', async () => {
      const { app } = setup();
      const bia = await employeeAgent(app, 'e4');
      await act(bia, 'c4', 'i8', true);
      expect((await (await adminAgent(app)).get('/api/admin/history?q=CAMARAS')).body.total).toBe(1);
    });

    it('limite máximo de 200 e offset negativo tratado como 0', async () => {
      const { app, db } = setup();
      insertEvents(db, 250);
      const admin = await adminAgent(app);
      expect((await admin.get('/api/admin/history?limit=500')).body.rows).toHaveLength(200);
      expect((await admin.get('/api/admin/history?offset=-5&limit=3')).body.rows).toHaveLength(3);
    });

    it('eventos de funcionário inativo continuam listados com o nome do momento', async () => {
      const { app, db } = setup();
      await act(await employeeAgent(app, 'e1'), 'c1', 'i1', true);
      db.prepare("UPDATE employees SET active = 0, name = 'João S. Silva' WHERE id = 'e1'").run();
      const rows = (await (await adminAgent(app)).get('/api/admin/history')).body.rows;
      expect(rows[0]).toMatchObject({ employeeName: 'João Silva' });
    });

    it('sem eventos devolve lista vazia', async () => {
      const { app } = setup();
      expect((await (await adminAgent(app)).get('/api/admin/history')).body).toEqual({ total: 0, undone: 0, rows: [] });
    });
  });
});
