import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { adminAgent, employeeAgent, setup } from './helpers/setup.js';

const GUIDED = {
  name: 'Abertura da varanda',
  tasks: ['Varrer a varanda', 'Ligar os ventiladores', 'Conferir organização das mesas'],
  roles: ['Salão'],
  period: 'daily',
  days: [],
  dueTime: '11:00',
};

type Item = { id: string; name: string; active: boolean; category: string; required: boolean; allowNote: boolean };

describe('US18 — assistente do primeiro checklist (API)', () => {
  describe('sucesso', () => {
    it('cria a lista com tarefas novas e ela aparece hoje para o Salão na ordem escrita', async () => {
      const { app } = setup({ local: '2026-10-21T10:00' });
      const admin = await adminAgent(app);
      const res = await admin.post('/api/admin/checklists/guided').send(GUIDED);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Abertura da varanda', period: 'daily', dueTime: '11:00', roles: ['Salão'], assignees: ['João Silva', 'Ana Costa'] });
      expect(res.body.itemIds).toHaveLength(3);

      const items = (await admin.get('/api/admin/items')).body as Item[];
      const varrer = items.find((i) => i.name === 'Varrer a varanda')!;
      expect(varrer).toMatchObject({ category: 'Organização', required: false, allowNote: true, active: true });

      const joao = await employeeAgent(app, 'e1');
      const card = (await joao.get('/api/me/today')).body.cards.find((c: { name: string }) => c.name === GUIDED.name);
      const exec = (await joao.get(`/api/me/executions/${card.executionId}`)).body;
      expect(exec.items.map((i: { name: string }) => i.name)).toEqual(GUIDED.tasks);
    });

    it('reaproveita item existente pelo nome, sem diferenciar maiúsculas nem espaços', async () => {
      const { app } = setup();
      const admin = await adminAgent(app);
      const before = (await admin.get('/api/admin/items')).body.length;
      const res = await admin.post('/api/admin/checklists/guided').send({ ...GUIDED, tasks: ['  conferir ORGANIZAÇÃO das mesas '] });
      expect(res.status).toBe(201);
      expect(res.body.itemIds).toEqual(['i1']);
      expect((await admin.get('/api/admin/items')).body).toHaveLength(before);
    });

    it('"só em alguns dias" vira dias específicos', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, period: 'weekdays', days: [5, 1, 1] });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ period: 'weekdays', days: [1, 5] });
    });

    it('"só quando alguém pedir" cria sob demanda sem horário', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, period: 'ondemand', dueTime: null });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ period: 'ondemand', dueTime: null, days: [] });
    });
  });

  describe('erro', () => {
    it('sem tarefas → 422 com mensagem simples', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, tasks: [] });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Escreva pelo menos uma tarefa.');
    });

    it('função inválida → 422 e nenhuma tarefa nova fica salva', async () => {
      const { app } = setup();
      const admin = await adminAgent(app);
      const before = (await admin.get('/api/admin/items')).body.length;
      const res = await admin.post('/api/admin/checklists/guided').send({ ...GUIDED, roles: ['Marte'] });
      expect(res.status).toBe(422);
      expect((await admin.get('/api/admin/items')).body).toHaveLength(before);
      expect((await admin.get('/api/admin/checklists')).body.some((c: { name: string }) => c.name === GUIDED.name)).toBe(false);
    });

    it('sem horário numa lista diária → 422', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, dueTime: null });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Defina o horário esperado de execução.');
    });

    it('nome de lista já existente → 409', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, name: ' abertura do RESTAURANTE ' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Já existe uma lista com esse nome.');
    });

    it('sem sessão de gestor → 401', async () => {
      const { app } = setup();
      const res = await request(app).post('/api/admin/checklists/guided').send(GUIDED);
      expect(res.status).toBe(401);
    });
  });

  describe('borda', () => {
    it('tarefas repetidas contam uma vez e tarefas em branco são ignoradas', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app))
        .post('/api/admin/checklists/guided')
        .send({ ...GUIDED, tasks: ['Varrer a varanda', '   ', 'varrer a varanda', 'Regar plantas'] });
      expect(res.status).toBe(201);
      expect(res.body.itemIds).toHaveLength(2);
    });

    it('só tarefas em branco → 422', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, tasks: ['  ', ''] });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Escreva pelo menos uma tarefa.');
    });

    it('tarefa com mais de 120 caracteres → 422', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, tasks: ['x'.repeat(121)] });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Cada tarefa pode ter até 120 caracteres.');
    });

    it('mais de 30 tarefas → 422', async () => {
      const { app } = setup();
      const tasks = Array.from({ length: 31 }, (_, i) => `Tarefa ${i + 1}`);
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, tasks });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Uma lista pode ter até 30 tarefas.');
    });

    it('tarefas que não são texto → 422', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, tasks: 'Varrer' });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Escreva pelo menos uma tarefa.');
    });

    it('item inativo com o mesmo nome volta a ficar ativo', async () => {
      const { app } = setup();
      const admin = await adminAgent(app);
      await admin.patch('/api/admin/items/i2').send({ active: false });
      const res = await admin.post('/api/admin/checklists/guided').send({ ...GUIDED, tasks: ['Verificar guardanapos'] });
      expect(res.status).toBe(201);
      expect(res.body.itemIds).toEqual(['i2']);
      const i2 = ((await admin.get('/api/admin/items')).body as Item[]).find((i) => i.id === 'i2')!;
      expect(i2.active).toBe(true);
    });
  });
});
