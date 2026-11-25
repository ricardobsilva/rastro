import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db/index.js';
import { prepareDb } from '../src/db/prepare.js';
import { adminAgent, authorizedAgent, employeeAgent, setup } from './helpers/setup.js';

const PIN = '1234';

/**
 * Casa Brasa com duas unidades. c1 (João e Ana) é do Farol, c3 (Carlos) é da Ponta Verde, o resto segue sem unidade.
 * João trabalha só no Farol, Carlos só na Ponta Verde, Ana nas duas.
 */
async function twoUnits() {
  const s = await setup();
  await s.db.batch([
    "INSERT INTO units (id, name) VALUES ('farol', 'Farol'), ('ponta', 'Ponta Verde')",
    "INSERT INTO employee_units VALUES ('e1', 'farol'), ('e3', 'ponta'), ('e2', 'farol'), ('e2', 'ponta')",
    "UPDATE checklists SET unit_id = 'farol' WHERE id = 'c1'",
    "UPDATE checklists SET unit_id = 'ponta' WHERE id = 'c3'",
  ].map((sql) => ({ sql, args: [] })));
  return s;
}

type App = Awaited<ReturnType<typeof setup>>['app'];
async function stationAt(app: App, unitId: string | null) {
  const agent = await authorizedAgent(app);
  expect((await agent.put('/api/device/unit').send({ pin: PIN, unitId })).status).toBe(200);
  return agent;
}
const names = (list: { name: string }[]) => list.map((x) => x.name);
const body = (o: object = {}) => ({
  name: 'Abertura', description: '', period: 'daily', days: [], dueTime: '10:00', active: true, unitId: 'ponta', itemIds: ['i1'], employeeIds: ['e2'], ...o,
});

describe('US20 — unidades e gestor', () => {
  it('produção nasce com Farol e Ponta Verde, e reiniciar não recria o que o gestor renomeou (sucesso)', async () => {
    const db = await prepareDb();
    expect(await db.prepare('SELECT name, active FROM units ORDER BY rowid').all()).toEqual([{ name: 'Farol', active: 1 }, { name: 'Ponta Verde', active: 1 }]);
    await db.prepare("DELETE FROM units WHERE id = 'u_ponta_verde'").run();
    const { seedDomain } = await import('../src/db/seed-domain.js');
    await seedDomain(db);
    expect(await db.prepare('SELECT name FROM units').all()).toEqual([{ name: 'Farol' }]);
  });

  it('cadastra, renomeia e desativa unidade (sucesso)', async () => {
    const { app } = await setup();
    const admin = await adminAgent(app);
    const created = await admin.post('/api/admin/units').send({ name: ' Farol ' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Farol', active: true, checklists: 0 });
    const url = `/api/admin/units/${created.body.id}`;
    expect((await admin.patch(url).send({ name: 'Farol Barra' })).body.name).toBe('Farol Barra');
    expect((await admin.patch(url).send({ active: false })).body).toMatchObject({ name: 'Farol Barra', active: false });
  });

  it('unidade sem nome, repetida, inexistente ou sem sessão (erro)', async () => {
    const { app } = await twoUnits();
    const admin = await adminAgent(app);
    expect((await admin.post('/api/admin/units').send({ name: '  ' })).status).toBe(422);
    expect((await admin.post('/api/admin/units').send({ name: 'FAROL' })).status).toBe(409);
    expect((await admin.patch('/api/admin/units/nada').send({ name: 'X' })).status).toBe(404);
    expect((await request(app).get('/api/admin/units')).status).toBe(401);
  });

  it('não desativa unidade com checklist ativo (borda)', async () => {
    const { app, db } = await twoUnits();
    const admin = await adminAgent(app);
    const res = await admin.patch('/api/admin/units/farol').send({ active: false });
    expect(res.status).toBe(409);
    await db.prepare("UPDATE checklists SET active = 0 WHERE id = 'c1'").run();
    expect((await admin.patch('/api/admin/units/farol').send({ active: false })).status).toBe(200);
  });

  it('checklist novo entra na unidade escolhida; sem unidade → 422 (sucesso e erro)', async () => {
    const { app } = await twoUnits();
    const admin = await adminAgent(app);
    expect((await admin.post('/api/admin/checklists').send(body())).body).toMatchObject({ unitId: 'ponta', assignees: ['Ana Costa'] });
    const none = await admin.post('/api/admin/checklists').send(body({ unitId: null }));
    expect([none.status, none.body.error]).toEqual([422, 'Escolha a unidade.']);
    expect((await admin.post('/api/admin/checklists').send(body({ unitId: 'nada' }))).status).toBe(422);
  });

  it('recusa pessoa que não trabalha na unidade (erro)', async () => {
    const { app } = await twoUnits();
    const res = await (await adminAgent(app)).post('/api/admin/checklists').send(body({ employeeIds: ['e1'] }));
    expect([res.status, res.body.error]).toEqual([422, 'Há pessoas que não trabalham nesta unidade.']);
  });

  it('checklist antigo sem unidade pode ser salvo assim, e não perde a unidade depois de ter uma (borda)', async () => {
    const { app } = await twoUnits();
    const admin = await adminAgent(app);
    const c6 = (await admin.get('/api/admin/checklists')).body.find((c: { id: string }) => c.id === 'c6');
    expect((await admin.put('/api/admin/checklists/c6').send({ ...c6, unitId: null })).body.unitId).toBeNull();
    expect((await admin.put('/api/admin/checklists/c6').send({ ...c6, unitId: 'farol' })).body.unitId).toBe('farol');
    expect((await admin.put('/api/admin/checklists/c6').send({ ...c6, unitId: null })).status).toBe(422);
    const { unitId: _u, ...noUnit } = c6;
    expect((await admin.put('/api/admin/checklists/c6').send(noUnit)).body.unitId).toBe('farol');
  });

  it('quem sai da unidade deixa de receber, sem impedir que a lista seja salva (borda)', async () => {
    const { app } = await twoUnits();
    const admin = await adminAgent(app);
    await admin.patch('/api/admin/employees/e2').send({ unitIds: ['ponta'] });
    const c1 = (await admin.get('/api/admin/checklists')).body.find((c: { id: string }) => c.id === 'c1');
    expect(c1.assignees).toEqual(['João Silva']);
    expect((await admin.put('/api/admin/checklists/c1').send(c1)).status).toBe(200);
  });

  it('funcionário: grava as unidades, mantém em edições parciais e recusa unidade inexistente', async () => {
    const { app } = await twoUnits();
    const admin = await adminAgent(app);
    const created = await admin.post('/api/admin/employees').send({ name: 'Lia Reis', role: 'Garçonete', group: 'Salão', unitIds: ['farol'] });
    expect(created.body.unitIds).toEqual(['farol']);
    expect((await admin.patch(`/api/admin/employees/${created.body.id}`).send({ active: false })).body.unitIds).toEqual(['farol']);
    expect((await admin.patch(`/api/admin/employees/${created.body.id}`).send({ unitIds: ['nada'] })).status).toBe(422);
  });

  it('passo a passo: só as pessoas da unidade, pessoa nova entra nela e o nome pode repetir entre unidades', async () => {
    const { app } = await twoUnits();
    const admin = await adminAgent(app);
    const guided = (o: object) => admin.post('/api/admin/checklists/guided').send({
      name: 'Turno da noite', tasks: ['Apagar luzes'], roles: ['Salão'], period: 'daily', days: [], dueTime: '23:00', unitId: 'ponta', ...o,
    });
    const a = await guided({ newEmployees: [{ name: 'Pedro Ramos', group: 'Salão' }] });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ unitId: 'ponta', assignees: ['Ana Costa', 'Pedro Ramos'] });
    const pedro = (await admin.get('/api/admin/employees')).body.find((e: { name: string }) => e.name === 'Pedro Ramos');
    expect(pedro.unitIds).toEqual(['ponta']);
    expect((await guided({})).status).toBe(409);
    expect((await guided({ unitId: 'farol' })).status).toBe(201);
    expect((await guided({ name: 'Outra', unitId: undefined })).status).toBe(422);
  });

  it('/admin/me traz as unidades com os atrasos de cada uma', async () => {
    const { app } = await twoUnits();
    const me = (await (await adminAgent(app)).get('/api/admin/me')).body;
    expect(me.units.map((u: { name: string; lateToday: number }) => [u.name, u.lateToday])).toEqual([['Farol', 12], ['Ponta Verde', 5]]);
    expect(me.lateToday).toBeGreaterThan(17);
  });
});

describe('US21 — aparelhos por unidade', () => {
  it('a estação mostra só a equipe e o progresso da unidade (sucesso)', async () => {
    const { app } = await twoUnits();
    const farol = (await (await stationAt(app, 'farol')).get('/api/station/team')).body;
    expect(farol.unit).toEqual({ id: 'farol', name: 'Farol' });
    expect(names(farol.members)).toContain('João Silva');
    expect(names(farol.members)).not.toContain('Carlos Mendes');
    const ponta = (await (await stationAt(app, 'ponta')).get('/api/station/team')).body;
    expect(names(ponta.members)).toEqual(expect.arrayContaining(['Carlos Mendes', 'Ana Costa']));
    const ana = (t: typeof farol) => t.members.find((m: { id: string }) => m.id === 'e2').total;
    expect(ana(farol) - ana(ponta)).toBe(6); // c1 só conta no Farol
  });

  it('Meu dia: a estação filtra, o celular sem unidade mostra tudo com o nome da unidade (sucesso)', async () => {
    const { app } = await twoUnits();
    const ponta = await stationAt(app, 'ponta');
    await ponta.post('/api/session').send({ employeeId: 'e2' });
    expect((await ponta.get('/api/me/today')).body.cards.map((c: { checklistId: string }) => c.checklistId)).not.toContain('c1');
    const phone = await employeeAgent(app, 'e2');
    const cards = (await phone.get('/api/me/today')).body.cards as { checklistId: string; unit: string | null }[];
    expect(cards.find((c) => c.checklistId === 'c1')?.unit).toBe('Farol');
    expect(cards.find((c) => c.checklistId === 'c2')?.unit).toBeNull();
  });

  it('a API recusa marcar, concluir e iniciar checklist de outra unidade (erro)', async () => {
    const { app, db } = await twoUnits();
    await db.prepare("UPDATE checklists SET unit_id = 'farol' WHERE id = 'c10'").run();
    await db.prepare("INSERT INTO checklist_employees VALUES ('c10', 'e2')").run();
    const phone = await employeeAgent(app, 'e2');
    const { executionId } = (await phone.get('/api/me/today')).body.cards.find((c: { checklistId: string }) => c.checklistId === 'c1');
    const ponta = await stationAt(app, 'ponta');
    await ponta.post('/api/session').send({ employeeId: 'e2' });
    const mark = await ponta.put(`/api/me/executions/${executionId}/items/i1`).send({ done: true });
    expect([mark.status, mark.body.error]).toEqual([403, 'Este checklist é de outra unidade.']);
    expect((await ponta.post(`/api/me/executions/${executionId}/finish`)).status).toBe(403);
    expect((await ponta.post('/api/me/ondemand/c10/start')).status).toBe(403);
    expect((await phone.post('/api/me/ondemand/c10/start')).status).toBe(201);
  });

  it('não dá para se identificar na unidade onde não trabalha, e quem sai dela perde a sessão (erro)', async () => {
    const { app, db } = await twoUnits();
    const ponta = await stationAt(app, 'ponta');
    expect((await ponta.post('/api/session').send({ employeeId: 'e1' })).status).toBe(403);
    expect(names((await ponta.get('/api/employees')).body)).not.toContain('João Silva');
    await ponta.post('/api/session').send({ employeeId: 'e2' });
    await db.prepare("DELETE FROM employee_units WHERE employee_id = 'e2' AND unit_id = 'ponta'").run();
    expect((await ponta.get('/api/me/today')).status).toBe(401);
    expect((await ponta.get('/api/session')).body.employee).toBeNull();
  });

  it('trocar a unidade do aparelho exige PIN e unidade ativa, e encerra a sessão (erro e borda)', async () => {
    const { app } = await twoUnits();
    expect((await request(app).put('/api/device/unit').send({ pin: PIN, unitId: 'farol' })).status).toBe(401);
    const agent = await employeeAgent(app, 'e2');
    expect((await agent.put('/api/device/unit').send({ pin: '9999', unitId: 'farol' })).status).toBe(401);
    expect((await agent.put('/api/device/unit').send({ pin: PIN, unitId: 'nada' })).status).toBe(422);
    expect((await agent.put('/api/device/unit').send({ pin: PIN })).status).toBe(422);
    expect((await agent.get('/api/session')).body.employee).not.toBeNull();
    expect((await agent.put('/api/device/unit').send({ pin: PIN, unitId: 'farol' })).body).toEqual({ unit: { id: 'farol', name: 'Farol' } });
    expect((await agent.get('/api/session')).body.employee).toBeNull();
    expect((await agent.put('/api/device/unit').send({ pin: PIN, unitId: null })).body).toEqual({ unit: null });
  });

  it('últimas marcações da estação são só as da unidade (borda)', async () => {
    const { app } = await twoUnits();
    const phone = await employeeAgent(app, 'e2');
    const { executionId } = (await phone.get('/api/me/today')).body.cards.find((c: { checklistId: string }) => c.checklistId === 'c1');
    await phone.put(`/api/me/executions/${executionId}/items/i1`).send({ done: true });
    const ponta = await stationAt(app, 'ponta');
    await ponta.post('/api/session').send({ employeeId: 'e2' });
    expect((await ponta.get('/api/me/activities')).body).toEqual([]);
    expect((await phone.get('/api/me/activities')).body).toHaveLength(1);
  });
});

describe('US22 — relatórios por unidade', () => {
  it('painel, equipe e histórico filtram pela unidade (sucesso)', async () => {
    const { app } = await twoUnits();
    const phone = await employeeAgent(app, 'e2');
    const { executionId } = (await phone.get('/api/me/today')).body.cards.find((c: { checklistId: string }) => c.checklistId === 'c1');
    await phone.put(`/api/me/executions/${executionId}/items/i1`).send({ done: true });
    const admin = await adminAgent(app);

    const farol = (await admin.get('/api/admin/dashboard?unitId=farol')).body;
    expect(farol.byChecklist).toEqual([{ id: 'c1', unit: 'Farol', name: 'Abertura do restaurante', done: 1, late: 11, total: 12 }]);
    expect(farol.byUnit).toEqual([]);
    expect((await admin.get('/api/admin/dashboard?unitId=ponta')).body.kpis.total).toBe(5);

    const team = (await admin.get('/api/admin/team?unitId=farol')).body.rows;
    expect(team.find((r: { employeeId: string }) => r.employeeId === 'e2')).toMatchObject({ total: 6, done: 1 });
    expect(team.find((r: { employeeId: string }) => r.employeeId === 'e3').total).toBe(0);

    expect((await admin.get('/api/admin/history?unitId=farol')).body).toMatchObject({ total: 1, rows: [{ unit: 'Farol' }] });
    expect((await admin.get('/api/admin/history?unitId=ponta')).body.total).toBe(0);
  });

  it('"Todas" traz o comparativo, com o que ainda não tem unidade à parte (sucesso)', async () => {
    const { app } = await twoUnits();
    const b = (await (await adminAgent(app)).get('/api/admin/dashboard')).body;
    expect(names(b.byUnit)).toEqual(['Farol', 'Ponta Verde', 'Sem unidade']);
    expect(b.byUnit[0]).toMatchObject({ unitId: 'farol', total: 12, done: 0, pct: 0 });
    expect(b.byUnit.reduce((n: number, u: { total: number }) => n + u.total, 0)).toBe(b.kpis.total);
  });

  it('unidade desconhecida → 422 (erro)', async () => {
    const { app } = await twoUnits();
    const admin = await adminAgent(app);
    for (const page of ['dashboard', 'team', 'history']) expect((await admin.get(`/api/admin/${page}?unitId=nada`)).status, page).toBe(422);
  });

  it('classificar leva o passado sem unidade; trocar de unidade depois não mexe nele (borda)', async () => {
    const { app, clock } = await twoUnits();
    await (await adminAgent(app)).get('/api/admin/dashboard'); // materializa 21/10
    clock.set('2026-10-22T11:40');
    const admin = await adminAgent(app); // a sessão de ontem já expirou
    const c6 = (await admin.get('/api/admin/checklists')).body.find((c: { id: string }) => c.id === 'c6');
    const past = async (unit: string) =>
      (await admin.get(`/api/admin/dashboard?date=2026-10-21&unitId=${unit}&checklistId=c6`)).body.kpis.total;
    expect(await past('farol')).toBe(0);
    await admin.put('/api/admin/checklists/c6').send({ ...c6, unitId: 'farol' });
    expect(await past('farol')).toBe(3);
    await admin.put('/api/admin/checklists/c6').send({ ...c6, unitId: 'ponta' });
    expect(await past('farol')).toBe(3);
    expect((await admin.get('/api/admin/dashboard?unitId=ponta&checklistId=c6')).body.kpis.total).toBe(3);
  });
});

describe('migração e backup', () => {
  it('banco antigo ganha as colunas, preserva os dados e abrir de novo não falha', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'rastro-db-')), 'old.db')}`;
    const old = createClient({ url });
    await old.executeMultiple(`
      CREATE TABLE employees (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, grp TEXT NOT NULL, pin TEXT UNIQUE, color TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE checklists (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', period TEXT NOT NULL, days TEXT NOT NULL DEFAULT '[]', due_time TEXT, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE devices (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL UNIQUE, authorized_by TEXT NOT NULL, created_at TEXT NOT NULL, employee_id TEXT, session_since TEXT);
      CREATE TABLE executions (id INTEGER PRIMARY KEY AUTOINCREMENT, op_date TEXT NOT NULL, checklist_id TEXT NOT NULL, employee_id TEXT NOT NULL, checklist_name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', due_time TEXT, started_manually INTEGER NOT NULL DEFAULT 0, visible INTEGER NOT NULL DEFAULT 1, UNIQUE (op_date, checklist_id, employee_id));
      INSERT INTO checklists (id, name, period) VALUES ('c1', 'Abertura', 'daily');
    `);
    old.close();
    for (let i = 0; i < 2; i++) {
      const db = await openDb({ url });
      expect(await db.prepare('SELECT id, name, unit_id FROM checklists').all()).toEqual([{ id: 'c1', name: 'Abertura', unit_id: null }]);
      expect(await db.prepare('SELECT unit_id FROM devices').all()).toEqual([]);
      expect(await db.prepare('SELECT unit_id FROM executions').all()).toEqual([]);
      db.close();
    }
  });

  it('ida e volta preserva unidades e vínculos', async () => {
    const { app } = await twoUnits();
    const admin = await adminAgent(app);
    await admin.get('/api/admin/dashboard');
    const file = (await admin.get('/api/admin/export')).body;
    const target = await setup();
    const other = await adminAgent(target.app);
    expect((await other.post('/api/admin/import').send(file)).status).toBe(200);
    expect((await (await adminAgent(target.app)).get('/api/admin/export')).body.tables).toEqual(file.tables);
  });

  it('arquivo da versão 1 entra sem unidade e mantém as unidades cadastradas', async () => {
    const { app } = await setup();
    const file = (await (await adminAgent(app)).get('/api/admin/export')).body;
    const { units: _u, employee_units: _eu, ...tables } = file.tables;
    for (const t of ['checklists', 'executions']) tables[t] = tables[t].map(({ unit_id: _x, ...row }: Record<string, unknown>) => row);
    const target = await twoUnits();
    const res = await (await adminAgent(target.app)).post('/api/admin/import').send({ ...file, version: 1, tables });
    expect(res.status).toBe(200);
    const admin = await adminAgent(target.app);
    expect(names((await admin.get('/api/admin/units')).body)).toEqual(['Farol', 'Ponta Verde']);
    expect((await admin.get('/api/admin/checklists')).body.every((c: { unitId: unknown }) => c.unitId === null)).toBe(true);
  });
});
