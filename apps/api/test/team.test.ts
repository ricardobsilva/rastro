import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { adminAgent, employeeAgent, setup } from './helpers/setup.js';

describe('US16 — equipe (acompanhamento)', () => {
  it('contadores e itens agrupados por checklist com horário e observação (sucesso)', async () => {
    const { app, clock } = setup({ local: '2026-10-21T10:12' });
    const joao = await employeeAgent(app, 'e1');
    const id = (await joao.get('/api/me/today')).body.cards[0].executionId;
    await joao.put(`/api/me/executions/${id}/items/i1`).send({ done: true });
    await joao.put(`/api/me/executions/${id}/items/i5/note`).send({ note: 'Restam 3 sacos.' });
    clock.set('2026-10-21T11:40');
    const res = await (await adminAgent(app)).get('/api/admin/team');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ date: '2026-10-21', isToday: true, dateLabel: 'quarta-feira, 21 de outubro' });
    const row = res.body.rows.find((r: { employeeId: string }) => r.employeeId === 'e1');
    expect(row).toMatchObject({ total: 12, done: 1, late: 8 });
    expect(row.groups[0]).toMatchObject({ checklistName: 'Abertura do restaurante', dueTime: '10:30' });
    expect(row.groups[0].items[0]).toEqual({ itemName: 'Conferir organização das mesas', status: 'done', doneAt: '10:12', note: '' });
    expect(row.groups[0].items[4]).toMatchObject({ status: 'late', note: 'Restam 3 sacos.' });
  });

  it('GET de um funcionário: inexistente → 404; sem gestor → 401 (erro)', async () => {
    const { app } = setup();
    const admin = await adminAgent(app);
    expect((await admin.get('/api/admin/team/e1')).body).toMatchObject({ employeeId: 'e1', total: 12 });
    expect((await admin.get('/api/admin/team/zz')).status).toBe(404);
    expect((await request(app).get('/api/admin/team')).status).toBe(401);
  });

  it('funcionário sem tarefas tem linha zerada; data inválida → 422 (borda)', async () => {
    const { app, db } = setup();
    db.prepare("INSERT INTO employees (id, name, role, grp, color) VALUES ('e9', 'Lia', 'Hostess', 'Bar', '#000')").run();
    const admin = await adminAgent(app);
    const rows = (await admin.get('/api/admin/team')).body.rows;
    expect(rows.find((r: { employeeId: string }) => r.employeeId === 'e9')).toEqual({ employeeId: 'e9', total: 0, done: 0, late: 0, groups: [] });
    expect((await admin.get('/api/admin/team?date=xx')).status).toBe(422);
  });

  it('inativos continuam com o histórico do dia (borda)', async () => {
    const { app, db, clock } = setup({ local: '2026-10-20T10:00' });
    const joao = await employeeAgent(app, 'e1');
    const id = (await joao.get('/api/me/today')).body.cards[0].executionId;
    await joao.put(`/api/me/executions/${id}/items/i1`).send({ done: true });
    clock.set('2026-10-21T10:00');
    db.prepare("UPDATE employees SET active = 0 WHERE id = 'e1'").run();
    const row = (await (await adminAgent(app)).get('/api/admin/team?date=2026-10-20')).body.rows.find((r: { employeeId: string }) => r.employeeId === 'e1');
    expect(row).toMatchObject({ done: 1, total: 12 });
  });
});
