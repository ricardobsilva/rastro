import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { authorizedAgent, employeeAgent, setup } from './helpers/setup.js';

type Member = { id: string; shortName: string; done: number; total: number; late: number };

describe('US10 — estação de trabalho: progresso da equipe', () => {
  it('lista ativos com progresso do dia, relógio e data (sucesso)', async () => {
    const { app } = setup({ local: '2026-10-21T10:00' });
    const joao = await employeeAgent(app, 'e1');
    const id = (await joao.get('/api/me/today')).body.cards[0].executionId;
    await joao.put(`/api/me/executions/${id}/items/i1`).send({ done: true });

    const res = await (await authorizedAgent(app)).get('/api/station/team');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ now: '10:00', dateLabel: 'quarta-feira, 21 de outubro' });
    const members = res.body.members as Member[];
    expect(members).toHaveLength(7);
    expect(members[0]).toEqual({
      id: 'e1', name: 'João Silva', shortName: 'João S.', firstName: 'João', initials: 'JS', role: 'Garçom', group: 'Salão', color: '#C2502F',
      done: 1, total: 12, late: 0,
    });
  });

  it('sem aparelho autorizado → 401 (erro)', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/station/team')).status).toBe(401);
  });

  it('atrasos contados e funcionário sem tarefas com total 0 (borda)', async () => {
    const { app, db } = setup({ local: '2026-10-21T11:40' });
    db.prepare("INSERT INTO employees (id, name, role, grp, color) VALUES ('e9', 'Lia Prado', 'Hostess', 'Bar', '#000')").run();
    db.prepare("DELETE FROM checklist_employees WHERE employee_id = 'e5'").run();
    const members = (await (await authorizedAgent(app)).get('/api/station/team')).body.members as Member[];
    expect(members.find((m) => m.id === 'e1')).toMatchObject({ total: 12, late: 9 });
    expect(members.find((m) => m.id === 'e9')).toMatchObject({ done: 0, total: 0, late: 0 });
    expect(members.find((m) => m.id === 'e8')).toBeUndefined();
  });
});
