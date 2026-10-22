import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prepareDb } from '../src/db/prepare.js';
import { adminAgent, employeeAgent, setup, testClock } from './helpers/setup.js';

type Export = { format: string; version: number; exportedAt: string; tables: Record<string, Record<string, unknown>[]> };
const TABLES = ['employees', 'items', 'checklists', 'checklist_items', 'checklist_roles', 'checklist_employees', 'executions', 'execution_items', 'audit_events'];
const count = (db: ReturnType<typeof prepareDb>, t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;

/** Restaurante de demonstração com marcações de hoje (inclui observação e desmarcação). */
async function busyRestaurant() {
  const s = setup();
  const joao = await employeeAgent(s.app, 'e1');
  const card = (await joao.get('/api/me/today')).body.cards[0];
  const exec = (await joao.get(`/api/me/executions/${card.executionId}`)).body;
  const [a, b] = exec.items;
  await joao.put(`/api/me/executions/${card.executionId}/items/${a.itemId}`).send({ done: true });
  await joao.put(`/api/me/executions/${card.executionId}/items/${b.itemId}`).send({ done: true });
  await joao.put(`/api/me/executions/${card.executionId}/items/${b.itemId}`).send({ done: false });
  return s;
}

/** Banco de produção recém-criado, com o gestor de produção logado. */
async function freshProd() {
  const db = prepareDb(':memory:');
  const clock = testClock();
  const app = createApp({ db, clock: () => clock.now });
  const admin = request.agent(app);
  await admin.post('/api/admin/login').send({ pin: '2200' });
  return { db, app, admin };
}

async function exportOf(app: Parameters<typeof request.agent>[0]) {
  const res = await (await adminAgent(app)).get('/api/admin/export');
  return res.body as Export;
}

describe('Exportar e importar dados', () => {
  describe('exportar — sucesso', () => {
    it('baixa um arquivo JSON com todas as tabelas de dados', async () => {
      const { app, db } = await busyRestaurant();
      const res = await (await adminAgent(app)).get('/api/admin/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe('attachment; filename="rastro-dados-2026-10-21.json"');
      expect(res.body).toMatchObject({ format: 'rastro-export', version: 1, exportedAt: '2026-10-21T14:40:00.000Z' });
      expect(Object.keys(res.body.tables)).toEqual(TABLES);
      for (const t of TABLES) expect(res.body.tables[t], t).toHaveLength(count(db, t));
      expect(res.body.tables.audit_events.length).toBeGreaterThan(0);
      expect(res.body.tables.employees.find((e: { id: string }) => e.id === 'e6')).toMatchObject({ name: 'Marina Alves', pin: '1234' });
    });

    it('não exporta aparelhos nem sessões (são credenciais temporárias)', async () => {
      const { app } = await busyRestaurant();
      const { tables } = await exportOf(app);
      expect(tables).not.toHaveProperty('devices');
      expect(tables).not.toHaveProperty('admin_sessions');
    });

    it('banco de produção vazio também exporta (só o gestor e a biblioteca)', async () => {
      const { admin } = await freshProd();
      const { tables } = (await admin.get('/api/admin/export')).body as Export;
      expect(tables.employees.map((e) => e.name)).toEqual(['Rodrigo Cortez']);
      expect(tables.checklists).toEqual([]);
    });
  });

  describe('importar — sucesso', () => {
    it('ida e volta: importar num banco novo reproduz exatamente os dados exportados', async () => {
      const { app } = await busyRestaurant();
      const original = await exportOf(app);

      const target = await freshProd();
      const res = await target.admin.post('/api/admin/import').send(original);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ employees: 8, checklists: 11 });

      const again = await exportOf(target.app);
      expect(again.tables).toEqual(original.tables);
    });

    it('depois de importar, todos precisam entrar de novo: sessões e aparelhos são encerrados', async () => {
      const { app } = await busyRestaurant();
      const original = await exportOf(app);
      const target = await freshProd();
      const tablet = request.agent(target.app);
      await tablet.post('/api/device/authorize').send({ pin: '2200' });
      expect((await tablet.get('/api/device')).body.authorized).toBe(true);

      await target.admin.post('/api/admin/import').send(original);

      expect((await target.admin.get('/api/admin/me')).status).toBe(401);
      expect((await tablet.get('/api/device')).body.authorized).toBe(false);
      expect(count(target.db, 'devices')).toBe(0);
    });

    it('arquivo grande (acima do limite padrão de 100 kB) é aceito', async () => {
      const { app, db } = setup();
      const insert = db.prepare(`INSERT INTO audit_events (op_date, minute, at, employee_id, employee_name, checklist_id, checklist_name, item_id, item_name, action, note)
        VALUES ('2026-10-20', 600, '2026-10-20T13:00:00.000Z', 'e1', 'João Silva', 'c1', 'Abertura do restaurante', 'i1', 'Conferir organização das mesas', 'note', ?)`);
      for (let i = 0; i < 1500; i++) insert.run(`Observação longa número ${i} `.repeat(4));
      const original = await exportOf(app);
      expect(JSON.stringify(original).length).toBeGreaterThan(200_000);

      const target = await freshProd();
      const res = await target.admin.post('/api/admin/import').send(original);
      expect(res.status).toBe(200);
      expect(count(target.db, 'audit_events')).toBe(1500);
    });
  });

  describe('erro', () => {
    it('exportar e importar exigem sessão de gestor → 401', async () => {
      const { app } = setup();
      expect((await request(app).get('/api/admin/export')).status).toBe(401);
      expect((await request(app).post('/api/admin/import').send({})).status).toBe(401);
    });

    it('arquivo que não é do Rastro → 422 e nada muda', async () => {
      const { app, db } = setup();
      const res = await (await adminAgent(app)).post('/api/admin/import').send({ hello: 'world' });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Este arquivo não é uma exportação do Rastro.');
      expect(count(db, 'employees')).toBe(8);
    });

    it('arquivo de versão mais nova → 422', async () => {
      const { app } = setup();
      const data = await exportOf(app);
      const res = await (await adminAgent(app)).post('/api/admin/import').send({ ...data, version: 2 });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Este arquivo é de uma versão mais nova do Rastro.');
    });

    it('arquivo corrompido → 422 e os dados atuais continuam intactos', async () => {
      const { app, db } = await busyRestaurant();
      const data = await exportOf(app);
      const events = count(db, 'audit_events');
      const broken = { ...data, tables: { ...data.tables, checklists: [{ ...data.tables.checklists[0], name: null }, ...data.tables.checklists.slice(1)] } };
      const res = await (await adminAgent(app)).post('/api/admin/import').send(broken);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('O arquivo está incompleto ou corrompido.');
      expect(count(db, 'checklists')).toBe(11);
      expect(count(db, 'audit_events')).toBe(events);
    });

    it('arquivo sem nenhum gestor ativo com PIN → 422 (ninguém conseguiria entrar)', async () => {
      const { app } = setup();
      const data = await exportOf(app);
      const employees = data.tables.employees.map((e) => (e.grp === 'Gerência' ? { ...e, active: 0 } : e));
      const res = await (await adminAgent(app)).post('/api/admin/import').send({ ...data, tables: { ...data.tables, employees } });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('O arquivo não tem nenhum gestor ativo com PIN.');
    });
  });

  describe('borda', () => {
    it('tabela faltando no arquivo → 422', async () => {
      const { app } = setup();
      const data = await exportOf(app);
      const { audit_events: _, ...tables } = data.tables;
      const res = await (await adminAgent(app)).post('/api/admin/import').send({ ...data, tables });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('O arquivo está incompleto ou corrompido.');
    });

    it('colunas desconhecidas no arquivo são ignoradas', async () => {
      const { app } = setup();
      const data = await exportOf(app);
      const items = data.tables.items.map((i) => ({ ...i, cor_favorita: 'azul' }));
      const target = await freshProd();
      const res = await target.admin.post('/api/admin/import').send({ ...data, tables: { ...data.tables, items } });
      expect(res.status).toBe(200);
      expect((await exportOf(target.app)).tables.items).toEqual(data.tables.items);
    });

    it('importar o mesmo arquivo duas vezes dá o mesmo resultado', async () => {
      const { app } = await busyRestaurant();
      const data = await exportOf(app);
      const target = await freshProd();
      await target.admin.post('/api/admin/import').send(data);
      const admin = await adminAgent(target.app);
      expect((await admin.post('/api/admin/import').send(data)).status).toBe(200);
      expect((await exportOf(target.app)).tables).toEqual(data.tables);
    });
  });
});
