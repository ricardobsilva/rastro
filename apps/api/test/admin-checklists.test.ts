import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { adminAgent, employeeAgent, setup } from './helpers/setup.js';

const NEW = {
  name: 'Abertura do bar (tarde)', description: '', period: 'daily', days: [], dueTime: '16:00',
  employeeIds: ['e2', 'e5'], itemIds: ['i13', 'i12'], active: true,
};

describe('US14 — cadastro de checklists', () => {
  describe('sucesso', () => {
    it('lista checklists com responsáveis resolvidos', async () => {
      const { app } = await setup();
      const res = await (await adminAgent(app)).get('/api/admin/checklists');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(11);
      expect(res.body[0]).toMatchObject({
        id: 'c1', name: 'Abertura do restaurante', period: 'daily', dueTime: '10:30', employeeIds: ['e1', 'e2'],
        itemIds: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'], active: true, assignees: ['João Silva', 'Ana Costa'],
      });
    });

    it('cria checklist diário; ele aparece hoje para os responsáveis na ordem definida', async () => {
      const { app } = await setup({ local: '2026-10-21T10:00' });
      const res = await (await adminAgent(app)).post('/api/admin/checklists').send(NEW);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ ...NEW, assignees: ['Ana Costa', 'Rafael Lima'] });
      const ana = await employeeAgent(app, 'e2');
      const card = (await ana.get('/api/me/today')).body.cards.find((c: { name: string }) => c.name === NEW.name);
      const exec = (await ana.get(`/api/me/executions/${card.executionId}`)).body;
      expect(exec.items.map((i: { itemId: string }) => i.itemId)).toEqual(['i13', 'i12']);
    });

    it('edita (reordena itens e renomeia) e a mudança vale para hoje', async () => {
      const { app } = await setup();
      const admin = await adminAgent(app);
      const c2 = (await admin.get('/api/admin/checklists')).body.find((c: { id: string }) => c.id === 'c2');
      const res = await admin.put('/api/admin/checklists/c2').send({ ...c2, name: 'Salão pré-almoço', itemIds: ['i15', 'i14', 'i25'] });
      expect(res.status).toBe(200);
      const joao = await employeeAgent(app, 'e1');
      const card = (await joao.get('/api/me/today')).body.cards.find((c: { checklistId: string }) => c.checklistId === 'c2');
      expect(card.name).toBe('Salão pré-almoço');
      expect((await joao.get(`/api/me/executions/${card.executionId}`)).body.items.map((i: { itemId: string }) => i.itemId)).toEqual(['i15', 'i14', 'i25']);
    });

    it('sob demanda zera horário e dias', async () => {
      const { app } = await setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists').send({ ...NEW, period: 'ondemand', dueTime: '10:00', days: [1] });
      expect(res.body).toMatchObject({ period: 'ondemand', dueTime: null, days: [] });
    });
  });

  describe('erro — validações na ordem do protótipo', () => {
    it.each([
      [{ name: '  ' }, 'Dê um nome ao checklist.'],
      [{ itemIds: [] }, 'Adicione pelo menos um item.'],
      [{ employeeIds: [] }, 'Escolha pelo menos uma pessoa.'],
      [{ period: 'weekdays', days: [] }, 'Escolha os dias da semana.'],
      [{ period: 'weekly', days: [] }, 'Escolha os dias da semana.'],
      [{ dueTime: '' }, 'Defina o horário esperado de execução.'],
      [{ dueTime: '25:00' }, 'Defina o horário esperado de execução.'],
      [{ name: '', itemIds: [] }, 'Dê um nome ao checklist.'],
    ])('%j → "%s"', async (patch, msg) => {
      const { app } = await setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists').send({ ...NEW, ...patch });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe(msg);
    });

    it.each([
      [{ itemIds: ['i24'] }, 'Item inválido ou inativo.'],
      [{ itemIds: ['zz'] }, 'Item inválido ou inativo.'],
      [{ employeeIds: ['zz'] }, 'Funcionário inválido.'],
      [{ period: 'mensal' }, 'Periodicidade inválida.'],
      [{ period: 'weekdays', days: [7] }, 'Dia da semana inválido.'],
    ])('%j → "%s"', async (patch, msg) => {
      const { app } = await setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists').send({ ...NEW, ...patch });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe(msg);
    });

    it('inexistente → 404; sem gestor → 401', async () => {
      const { app } = await setup();
      expect((await (await adminAgent(app)).put('/api/admin/checklists/zz').send(NEW)).status).toBe(404);
      expect((await request(app).get('/api/admin/checklists')).status).toBe(401);
    });
  });

  describe('borda', () => {
    it('item repetido → 422', async () => {
      const { app } = await setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists').send({ ...NEW, itemIds: ['i12', 'i12'] });
      expect(res.body.error).toBe('Item repetido no checklist.');
    });

    it('semanal com 2 dias → 422', async () => {
      const { app } = await setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists').send({ ...NEW, period: 'weekly', days: [1, 3] });
      expect(res.body.error).toBe('Semanal aceita apenas um dia.');
    });

    it('item já no checklist e depois desativado não impede salvar', async () => {
      const { app, db } = await setup();
      const admin = await adminAgent(app);
      await db.prepare("UPDATE items SET active = 0 WHERE id = 'i2'").run();
      const c1 = (await admin.get('/api/admin/checklists')).body[0];
      expect((await admin.put('/api/admin/checklists/c1').send({ ...c1, description: 'nova' })).status).toBe(200);
    });

    it('remover responsáveis faz a instância de hoje sumir sem apagar eventos', async () => {
      const { app, db } = await setup();
      const joao = await employeeAgent(app, 'e1');
      const card = (await joao.get('/api/me/today')).body.cards.find((c: { checklistId: string }) => c.checklistId === 'c2');
      await joao.put(`/api/me/executions/${card.executionId}/items/i14`).send({ done: true });
      const admin = await adminAgent(app);
      const c2 = (await admin.get('/api/admin/checklists')).body.find((c: { id: string }) => c.id === 'c2');
      await admin.put('/api/admin/checklists/c2').send({ ...c2, employeeIds: ['e5'] });
      expect((await joao.get('/api/me/today')).body.cards.map((c: { checklistId: string }) => c.checklistId)).not.toContain('c2');
      expect(await db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE checklist_id = 'c2'").get()).toEqual({ n: 1 });
    });

    it('pessoa de uma função recebe sozinha: os colegas da mesma função não veem', async () => {
      const { app } = await setup({ local: '2026-10-21T10:00' });
      const res = await (await adminAgent(app)).post('/api/admin/checklists').send({ ...NEW, employeeIds: ['e1'] });
      expect(res.body.assignees).toEqual(['João Silva']);
      const has = async (id: string) => (await (await employeeAgent(app, id)).get('/api/me/today')).body.cards.some((c: { name: string }) => c.name === NEW.name);
      expect(await has('e1')).toBe(true);
      expect(await has('e2')).toBe(false);
    });

    it('papéis enviados por clientes antigos são ignorados', async () => {
      const { app } = await setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists').send({ ...NEW, roles: ['Salão'], employeeIds: ['e5'] });
      expect(res.body.assignees).toEqual(['Rafael Lima']);
    });

    it('dias são guardados ordenados e sem repetição', async () => {
      const { app } = await setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists').send({ ...NEW, period: 'weekdays', days: [4, 1, 4] });
      expect(res.body.days).toEqual([1, 4]);
    });

    it('desativar checklist o tira do Meu dia de hoje', async () => {
      const { app } = await setup();
      const admin = await adminAgent(app);
      const c2 = (await admin.get('/api/admin/checklists')).body.find((c: { id: string }) => c.id === 'c2');
      await admin.put('/api/admin/checklists/c2').send({ ...c2, active: false });
      const ids = (await (await employeeAgent(app, 'e1')).get('/api/me/today')).body.cards.map((c: { checklistId: string }) => c.checklistId);
      expect(ids).toEqual(['c1', 'c5']);
    });
  });
});
