import type { Db } from '../src/db/index.js';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prepareDb } from '../src/db/prepare.js';
import { seedDomain } from '../src/db/seed-domain.js';
import { ITEMS } from '../src/db/seed-data.js';
import { testClock } from './helpers/setup.js';

const count = async (db: Db, t: string) => (await db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
const PROD_PIN = '2200';

async function prodAdmin(db: Db) {
  const clock = testClock();
  const app = createApp({ db, clock: () => clock.now });
  const agent = request.agent(app);
  const login = await agent.post('/api/admin/login').send({ pin: PROD_PIN });
  return { app, agent, login };
}

describe('Banco de produção: só dados de domínio', () => {
  describe('sucesso', () => {
    it('não tem listas, execuções nem histórico; o único funcionário é o gestor Rodrigo Cortez', async () => {
      const db = await prepareDb();
      for (const t of ['checklists', 'checklist_items', 'checklist_roles', 'checklist_employees', 'executions', 'execution_items', 'audit_events', 'devices'])
        expect(await count(db, t), t).toBe(0);
      expect(await db.prepare('SELECT name, role, grp, pin, active FROM employees').all()).toEqual([
        { name: 'Rodrigo Cortez', role: 'Gerente', grp: 'Gerência', pin: PROD_PIN, active: 1 },
      ]);
    });

    it('traz a biblioteca de tarefas, só com as ativas', async () => {
      const db = await prepareDb();
      expect(await count(db, 'items')).toBe(ITEMS.filter((i) => i.active).length);
      expect(await count(db, 'items')).toBeGreaterThan(0);
      expect(await db.prepare('SELECT COUNT(*) AS n FROM items WHERE active = 0').get()).toEqual({ n: 0 });
    });

    it('o gestor entra com o PIN 2200 e encontra o restaurante vazio para configurar', async () => {
      const { agent, login } = await prodAdmin(await prepareDb());
      expect(login.status).toBe(201);
      expect(login.body.manager.name).toBe('Rodrigo Cortez');
      expect((await agent.get('/api/admin/checklists')).body).toEqual([]);
      expect((await agent.get('/api/admin/employees')).body.map((e: { name: string }) => e.name)).toEqual(['Rodrigo Cortez']);
    });
  });

  describe('erro', () => {
    it('o PIN da demonstração (1234) não entra em produção', async () => {
      const db = await prepareDb();
      const res = await request(createApp({ db })).post('/api/admin/login').send({ pin: '1234' });
      expect(res.status).toBe(401);
    });

    it('a inicialização da API não usa nenhum seed de demonstração', async () => {
      const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
      const vercel = readFileSync(new URL('../src/vercel.ts', import.meta.url), 'utf8');
      const prepare = readFileSync(new URL('../src/db/prepare.ts', import.meta.url), 'utf8');
      expect(main).toMatch(/prepareDb/);
      expect(vercel).toMatch(/prepareDb/);
      for (const src of [main, vercel, prepare]) {
        expect(src).not.toMatch(/seed-demo|seedDemo|seed-casa-brasa|seedCasaBrasa/);
      }
    });
  });

  describe('borda', () => {
    it('reiniciar a API não duplica nada', async () => {
      const db = await prepareDb();
      const items = await count(db, 'items');
      await seedDomain(db);
      await seedDomain(db);
      expect(await count(db, 'employees')).toBe(1);
      expect(await count(db, 'items')).toBe(items);
    });

    it('reiniciar não desfaz o que o gestor mudou (PIN, nome, tarefa desativada)', async () => {
      const db = await prepareDb();
      const { agent } = await prodAdmin(db);
      const rodrigo = (await agent.get('/api/admin/employees')).body[0];
      await agent.patch(`/api/admin/employees/${rodrigo.id}`).send({ name: 'Rodrigo C. Cortez', pin: '9876' });
      const item = (await agent.get('/api/admin/items')).body[0];
      await agent.patch(`/api/admin/items/${item.id}`).send({ active: false });

      await seedDomain(db);

      expect(await db.prepare('SELECT name, pin FROM employees').all()).toEqual([{ name: 'Rodrigo C. Cortez', pin: '9876' }]);
      expect(await db.prepare('SELECT active FROM items WHERE id = ?').get(item.id)).toEqual({ active: 0 });
    });

    it('o que o gestor cadastra fica: depois de reiniciar, a lista e a equipe continuam lá', async () => {
      const db = await prepareDb();
      const { agent } = await prodAdmin(db);
      const res = await agent.post('/api/admin/checklists/guided').send({
        name: 'Abertura', unitId: 'u_farol', tasks: ['Abrir portas'], roles: ['Salão'], period: 'daily', days: [], dueTime: '10:00', newEmployees: [{ name: 'Pedro Ramos', group: 'Salão' }],
      });
      expect(res.status).toBe(201);
      await seedDomain(db);
      expect(await count(db, 'checklists')).toBe(1);
      expect(await count(db, 'employees')).toBe(2);
    });
  });
});
