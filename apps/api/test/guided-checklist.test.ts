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

  describe('pessoas novas na equipe', () => {
    const PEDRO = { name: 'Pedro Ramos', group: 'Bar' };

    it('cria as pessoas novas junto com a lista e já as atribui pela função (sucesso)', async () => {
      const { app } = setup({ local: '2026-10-21T10:00' });
      const admin = await adminAgent(app);
      const res = await admin.post('/api/admin/checklists/guided').send({ ...GUIDED, roles: ['Bar'], newEmployees: [PEDRO, { name: 'Lia Mota', group: 'Limpeza' }] });
      expect(res.status).toBe(201);
      expect(res.body.assignees).toEqual(['Rafael Lima', 'Pedro Ramos']);

      const emps = (await admin.get('/api/admin/employees')).body as { id: string; name: string; role: string; group: string; active: boolean; color: string }[];
      const pedro = emps.find((e) => e.name === 'Pedro Ramos')!;
      expect(pedro).toMatchObject({ role: 'Bar', group: 'Bar', active: true });
      expect(pedro.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(emps.find((e) => e.name === 'Lia Mota')).toMatchObject({ group: 'Limpeza', active: true });

      const card = (await (await employeeAgent(app, pedro.id)).get('/api/me/today')).body.cards.find((c: { name: string }) => c.name === GUIDED.name);
      expect(card).toBeDefined();
    });

    it('pessoa nova numa função que estava vazia permite escolher essa função (borda)', async () => {
      const { app } = setup();
      const admin = await adminAgent(app);
      await admin.patch('/api/admin/employees/e7').send({ active: false });
      const res = await admin.post('/api/admin/checklists/guided').send({ ...GUIDED, roles: ['Limpeza'], newEmployees: [{ name: 'Lia Mota', group: 'Limpeza' }] });
      expect(res.status).toBe(201);
      expect(res.body.assignees).toEqual(['Lia Mota']);
    });

    it('sem a lista de pessoas novas continua funcionando (borda)', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, newEmployees: [] });
      expect(res.status).toBe(201);
    });

    it('gestor não é cadastrado pelo assistente → 422 (erro)', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, newEmployees: [{ name: 'Rita Luz', group: 'Gerência' }] });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Para cadastrar um gestor, use a página Equipe.');
    });

    it('pessoa sem nome ou com função inválida → 422 (erro)', async () => {
      const { app } = setup();
      const admin = await adminAgent(app);
      const semNome = await admin.post('/api/admin/checklists/guided').send({ ...GUIDED, newEmployees: [{ name: '  ', group: 'Bar' }] });
      expect(semNome.status).toBe(422);
      expect(semNome.body.error).toBe('Escreva o nome da pessoa.');
      const funcao = await admin.post('/api/admin/checklists/guided').send({ ...GUIDED, newEmployees: [{ name: 'Pedro', group: 'Marte' }] });
      expect(funcao.status).toBe(422);
      expect(funcao.body.error).toBe('Função inválida.');
      const formato = await admin.post('/api/admin/checklists/guided').send({ ...GUIDED, newEmployees: 'Pedro' });
      expect(formato.status).toBe(422);
    });

    it('nome igual ao de alguém ativo → 409 (erro)', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, newEmployees: [{ name: ' joão SILVA ', group: 'Salão' }] });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('João Silva já está na equipe.');
    });

    it('a mesma pessoa duas vezes na lista → 409 (borda)', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, newEmployees: [PEDRO, { name: 'pedro ramos', group: 'Salão' }] });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('pedro ramos aparece duas vezes.');
    });

    it('mais de 30 pessoas novas → 422 (borda)', async () => {
      const { app } = setup();
      const newEmployees = Array.from({ length: 31 }, (_, i) => ({ name: `Pessoa ${i + 1}`, group: 'Salão' }));
      const res = await (await adminAgent(app)).post('/api/admin/checklists/guided').send({ ...GUIDED, newEmployees });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Adicione até 30 pessoas por vez.');
    });

    it('se a lista falhar, nenhuma pessoa nova fica salva (erro)', async () => {
      const { app } = setup();
      const admin = await adminAgent(app);
      const before = (await admin.get('/api/admin/employees')).body.length;
      const res = await admin.post('/api/admin/checklists/guided').send({ ...GUIDED, tasks: [], newEmployees: [PEDRO] });
      expect(res.status).toBe(422);
      expect((await admin.get('/api/admin/employees')).body).toHaveLength(before);
    });
  });
});
