import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { adminAgent, employeeAgent, setup } from './helpers/setup.js';

const NEW = { name: 'Conferir estoque de carvão', description: 'Mínimo de 3 sacos.', category: 'Estoque', required: true, allowNote: false, active: true };

describe('US12 — cadastro de itens', () => {
  describe('sucesso', () => {
    it('lista itens com os checklists em que são usados', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).get('/api/admin/items');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(26);
      expect(res.body.find((i: { id: string }) => i.id === 'i12')).toEqual({
        id: 'i12', name: 'Conferir estoque de bebidas', description: 'Refrigerantes, águas, cervejas e sucos.', category: 'Estoque',
        required: false, allowNote: true, active: true, usedIn: ['Conferência de estoque', 'Abertura do bar', 'Conferência da adega'],
      });
      expect(res.body.find((i: { id: string }) => i.id === 'i24').usedIn).toEqual([]);
    });

    it('cria item (nome aparado)', async () => {
      const { app } = setup();
      const agent = await adminAgent(app);
      const res = await agent.post('/api/admin/items').send({ ...NEW, name: '  Conferir estoque de carvão ' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ ...NEW, usedIn: [] });
      expect(res.body.id).toMatch(/^i_/);
      expect((await agent.get('/api/admin/items')).body).toHaveLength(27);
    });

    it('edita e desativa/reativa', async () => {
      const { app } = setup();
      const agent = await adminAgent(app);
      expect((await agent.patch('/api/admin/items/i2').send({ name: 'Repor guardanapos', required: true })).body).toMatchObject({ name: 'Repor guardanapos', required: true });
      expect((await agent.patch('/api/admin/items/i2').send({ active: false })).body.active).toBe(false);
      expect((await agent.patch('/api/admin/items/i2').send({ active: true })).body.active).toBe(true);
    });
  });

  describe('erro', () => {
    it('nome vazio → 422', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/items').send({ ...NEW, name: '   ' });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Informe o nome do item.');
    });

    it('nome duplicado (maiúsculas/espaços) → 409', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/items').send({ ...NEW, name: 'conferir TALHERES ' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Já existe um item com esse nome.');
    });

    it('categoria inválida → 422', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/items').send({ ...NEW, category: 'Bebidas' });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Categoria inválida.');
    });

    it('item inexistente → 404; sem sessão de gestor → 401', async () => {
      const { app } = setup();
      expect((await (await adminAgent(app)).patch('/api/admin/items/xx').send({ active: false })).status).toBe(404);
      expect((await request(app).get('/api/admin/items')).status).toBe(401);
    });
  });

  describe('borda', () => {
    it('editar mantendo o próprio nome não acusa duplicidade', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).patch('/api/admin/items/i3').send({ name: 'Conferir Talheres' });
      expect(res.status).toBe(200);
    });

    it('renomear para nome de outro item → 409', async () => {
      const { app } = setup();
      expect((await (await adminAgent(app)).patch('/api/admin/items/i3').send({ name: 'Verificar guardanapos' })).status).toBe(409);
    });

    it('desativar item já concluído hoje: some do checklist e o registro fica no histórico', async () => {
      const { app, db } = setup();
      const joao = await employeeAgent(app, 'e1');
      const id = (await joao.get('/api/me/today')).body.cards.find((c: { checklistId: string }) => c.checklistId === 'c1').executionId;
      await joao.put(`/api/me/executions/${id}/items/i2`).send({ done: true });
      await (await adminAgent(app)).patch('/api/admin/items/i2').send({ active: false });
      expect((await joao.get(`/api/me/executions/${id}`)).body.total).toBe(5);
      expect(db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE item_id = 'i2'").get()).toEqual({ n: 1 });
    });

    it('descrição acima de 300 caracteres → 422; campos omitidos assumem padrão', async () => {
      const { app } = setup();
      const agent = await adminAgent(app);
      expect((await agent.post('/api/admin/items').send({ ...NEW, description: 'a'.repeat(301) })).status).toBe(422);
      const res = await agent.post('/api/admin/items').send({ name: 'Item mínimo', category: 'Limpeza' });
      expect(res.body).toMatchObject({ description: '', required: false, allowNote: false, active: true });
    });
  });
});
