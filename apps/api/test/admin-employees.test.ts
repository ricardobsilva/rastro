import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { adminAgent, authorizedAgent, employeeAgent, setup } from './helpers/setup.js';

describe('US13 — cadastro de funcionários', () => {
  describe('sucesso', () => {
    it('lista todos (inclusive inativos) sem expor o PIN', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).get('/api/admin/employees');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(8);
      expect(res.body.find((e: { id: string }) => e.id === 'e6')).toMatchObject({ name: 'Marina Alves', active: true, hasPin: true, isManager: true });
      expect(res.body.find((e: { id: string }) => e.id === 'e8')).toMatchObject({ active: false, hasPin: false });
      expect(JSON.stringify(res.body)).not.toContain('1234');
    });

    it('cadastra funcionário (sem PIN) e ele aparece na identificação', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/employees').send({ name: ' Lucas Pereira ', role: 'Garçom', group: 'Salão' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Lucas Pereira', role: 'Garçom', group: 'Salão', active: true, hasPin: false, isManager: false });
      expect(res.body.color).toMatch(/^#/);
      const list = (await (await authorizedAgent(app)).get('/api/employees')).body;
      expect(list.map((e: { name: string }) => e.name)).toContain('Lucas Pereira');
    });

    it('cadastra gestor com PIN, que consegue entrar no painel', async () => {
      const { app } = setup();
      await (await adminAgent(app)).post('/api/admin/employees').send({ name: 'Rita Gomes', role: 'Subgerente', group: 'Gerência', pin: '4321' });
      expect((await request(app).post('/api/admin/login').send({ pin: '4321' })).status).toBe(201);
    });

    it('desativar tira da identificação e preserva o histórico; reativar devolve', async () => {
      const { app, db } = setup();
      const joao = await employeeAgent(app, 'e1');
      const id = (await joao.get('/api/me/today')).body.cards[0].executionId;
      await joao.put(`/api/me/executions/${id}/items/i1`).send({ done: true });
      const admin = await adminAgent(app);
      expect((await admin.patch('/api/admin/employees/e1').send({ active: false })).body.active).toBe(false);
      expect((await joao.get('/api/session')).body.employee).toBeNull();
      expect(db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE employee_id = 'e1'").get()).toEqual({ n: 1 });
      await admin.patch('/api/admin/employees/e1').send({ active: true });
      expect((await (await employeeAgent(app, 'e1')).get('/api/me/today')).body.cards.length).toBe(3);
    });
  });

  describe('erro', () => {
    it.each([
      [{ name: '', role: 'Garçom', group: 'Salão' }, 'Preencha nome e cargo.'],
      [{ name: 'Ana', role: '  ', group: 'Salão' }, 'Preencha nome e cargo.'],
      [{ name: 'Ana', role: 'X', group: 'Cozinha central' }, 'Função inválida.'],
      [{ name: 'Ana', role: 'X', group: 'Gerência' }, 'Gestores precisam de um PIN de 4 números.'],
      [{ name: 'Ana', role: 'X', group: 'Gerência', pin: '12a4' }, 'O PIN deve ter 4 números.'],
    ])('%j → 422 "%s"', async (body, msg) => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/employees').send(body);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe(msg);
    });

    it('PIN repetido → 409', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/employees').send({ name: 'Rita', role: 'Sub', group: 'Gerência', pin: '1234' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Esse PIN já está em uso.');
    });

    it('inexistente → 404; sem gestor → 401', async () => {
      const { app } = setup();
      expect((await (await adminAgent(app)).patch('/api/admin/employees/xx').send({ active: false })).status).toBe(404);
      expect((await request(app).get('/api/admin/employees')).status).toBe(401);
    });
  });

  describe('borda', () => {
    it('não deixa desativar nem rebaixar o último gestor ativo', async () => {
      const { app } = setup();
      const admin = await adminAgent(app);
      for (const body of [{ active: false }, { group: 'Salão' }]) {
        const res = await admin.patch('/api/admin/employees/e6').send(body);
        expect(res.status).toBe(422);
        expect(res.body.error).toBe('É preciso manter pelo menos um gestor ativo.');
      }
    });

    it('com outro gestor ativo, pode desativar a si mesmo (e perde o acesso)', async () => {
      const { app } = setup();
      const admin = await adminAgent(app);
      await admin.post('/api/admin/employees').send({ name: 'Rita Gomes', role: 'Sub', group: 'Gerência', pin: '4321' });
      expect((await admin.patch('/api/admin/employees/e6').send({ active: false })).status).toBe(200);
      expect((await admin.get('/api/admin/me')).status).toBe(401);
    });

    it('editar sem informar PIN mantém o atual; sair da Gerência apaga o PIN', async () => {
      const { app, db } = setup();
      const admin = await adminAgent(app);
      await admin.post('/api/admin/employees').send({ name: 'Rita Gomes', role: 'Sub', group: 'Gerência', pin: '4321' });
      const rita = (db.prepare("SELECT id FROM employees WHERE name = 'Rita Gomes'").get() as { id: string }).id;
      await admin.patch(`/api/admin/employees/${rita}`).send({ role: 'Subgerente' });
      expect(db.prepare('SELECT pin FROM employees WHERE id = ?').get(rita)).toEqual({ pin: '4321' });
      await admin.patch(`/api/admin/employees/${rita}`).send({ group: 'Bar' });
      expect(db.prepare('SELECT pin FROM employees WHERE id = ?').get(rita)).toEqual({ pin: null });
    });

    it('PIN informado para quem não é gestor é ignorado', async () => {
      const { app, db } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/employees').send({ name: 'Leo', role: 'Garçom', group: 'Salão', pin: '5555' });
      expect(db.prepare('SELECT pin FROM employees WHERE id = ?').get(res.body.id)).toEqual({ pin: null });
    });

    it('trocar de função muda os checklists de hoje', async () => {
      const { app } = setup();
      await (await adminAgent(app)).patch('/api/admin/employees/e1').send({ group: 'Bar' });
      expect((await (await employeeAgent(app, 'e1')).get('/api/me/today')).body.cards).toEqual([]);
    });
  });
});
