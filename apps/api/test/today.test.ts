import { describe, expect, it } from 'vitest';
import { authorizedAgent, employeeAgent, setup } from './helpers/setup.js';

type Card = { executionId: number; checklistId: string; name: string; dueTime: string | null; done: number; total: number; status: string };

const today = async (agent: Awaited<ReturnType<typeof employeeAgent>>) => {
  const res = await agent.get('/api/me/today');
  expect(res.status).toBe(200);
  return res.body as { date: string; dateLabel: string; greeting: string; now: string; summary: Record<string, number>; cards: Card[] };
};
const ids = (cards: Card[]) => cards.map((c) => c.checklistId);

describe('US03 — Meu dia', () => {
  describe('sucesso', () => {
    it('João (Salão) recebe os checklists da função, com resumo e cabeçalho', async () => {
      const { app } = setup({ local: '2026-10-21T09:00' });
      const body = await today(await employeeAgent(app, 'e1'));
      expect(body).toMatchObject({ date: '2026-10-21', dateLabel: 'quarta-feira, 21 de outubro', greeting: 'Bom dia', now: '09:00' });
      expect(ids(body.cards)).toEqual(['c1', 'c2', 'c5']);
      expect(body.summary).toEqual({ total: 12, done: 0, pending: 12, late: 0 });
      expect(body.cards[0]).toMatchObject({ name: 'Abertura do restaurante', dueTime: '10:30', done: 0, total: 6, status: 'pending' });
    });

    it('Beatriz recebe por atribuição pessoal', async () => {
      const { app } = setup();
      expect(ids((await today(await employeeAgent(app, 'e4'))).cards)).toEqual(['c4']);
    });

    it('atrasados vêm primeiro; contagem de atrasados no resumo', async () => {
      const { app } = setup({ local: '2026-10-21T11:40' });
      const body = await today(await employeeAgent(app, 'e1'));
      expect(body.cards.map((c) => [c.checklistId, c.status])).toEqual([['c1', 'late'], ['c2', 'late'], ['c5', 'pending']]);
      expect(body.summary).toEqual({ total: 12, done: 0, pending: 12, late: 9 });
    });
  });

  describe('erro', () => {
    it('aparelho sem funcionário identificado → 401', async () => {
      const { app } = setup();
      const res = await (await authorizedAgent(app)).get('/api/me/today');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Identifique-se para continuar.');
    });
  });

  describe('borda', () => {
    it('semanal (quarta) aparece na quarta e não na quinta', async () => {
      const { app, clock } = setup({ local: '2026-10-21T09:00' });
      const agent = await employeeAgent(app, 'e7');
      expect(ids((await today(agent)).cards)).toEqual(['c9', 'c8']);
      clock.set('2026-10-22T09:00');
      expect(ids((await today(agent)).cards)).toEqual(['c9']);
    });

    it('dias específicos (seg/qui) aparece na quinta', async () => {
      const { app, clock } = setup({ local: '2026-10-21T09:00' });
      const agent = await employeeAgent(app, 'e5');
      expect(ids((await today(agent)).cards)).toEqual(['c6']);
      clock.set('2026-10-22T09:00');
      expect(ids((await today(agent)).cards)).toEqual(['c6', 'c11']);
    });

    it('função + pessoa da mesma função geram uma única instância', async () => {
      const { app, db } = setup();
      db.prepare("INSERT INTO checklist_employees VALUES ('c1', 'e1')").run();
      expect(ids((await today(await employeeAgent(app, 'e1'))).cards).filter((c) => c === 'c1')).toHaveLength(1);
    });

    it('checklist inativo some, inclusive depois de já ter sido gerado hoje', async () => {
      const { app, db } = setup();
      const agent = await employeeAgent(app, 'e1');
      await today(agent);
      db.prepare("UPDATE checklists SET active = 0 WHERE id = 'c2'").run();
      expect(ids((await today(agent)).cards)).toEqual(['c1', 'c5']);
    });

    it('item inativo some do checklist a partir de hoje', async () => {
      const { app, db } = setup();
      const agent = await employeeAgent(app, 'e1');
      await today(agent);
      db.prepare("UPDATE items SET active = 0 WHERE id = 'i2'").run();
      const c1 = (await today(agent)).cards.find((c) => c.checklistId === 'c1')!;
      expect(c1.total).toBe(5);
    });

    it('checklist com todos os itens inativos não aparece', async () => {
      const { app, db } = setup();
      db.prepare("UPDATE items SET active = 0 WHERE id IN ('i14','i25','i15')").run();
      expect(ids((await today(await employeeAgent(app, 'e1'))).cards)).toEqual(['c1', 'c5']);
    });

    it('no minuto do prazo ainda não está atrasado; um minuto depois sim', async () => {
      const { app, clock } = setup({ local: '2026-10-21T10:30' });
      const agent = await employeeAgent(app, 'e1');
      expect((await today(agent)).cards[0]).toMatchObject({ checklistId: 'c1', status: 'pending' });
      clock.set('2026-10-21T10:31');
      expect((await today(agent)).cards[0]).toMatchObject({ checklistId: 'c1', status: 'late' });
    });

    it('00:20 ainda é o dia anterior: fechamento das 23:30 aparece atrasado', async () => {
      const { app } = setup({ local: '2026-10-22T00:20' });
      const body = await today(await employeeAgent(app, 'e1'));
      expect(body.date).toBe('2026-10-21');
      expect(body.greeting).toBe('Boa noite');
      expect(body.cards.find((c) => c.checklistId === 'c5')!.status).toBe('late');
    });

    it('funcionário sem nada atribuído recebe lista vazia', async () => {
      const { app, db } = setup();
      db.prepare("INSERT INTO employees (id, name, role, grp, color) VALUES ('e9', 'Lia', 'Hostess', 'Bar', '#000')").run();
      db.prepare("DELETE FROM checklist_employees WHERE employee_id = 'e5'").run();
      const body = await today(await employeeAgent(app, 'e9'));
      expect(body.cards).toEqual([]);
      expect(body.summary).toEqual({ total: 0, done: 0, pending: 0, late: 0 });
    });

    it('dias anteriores ficam congelados: mudança de nome não altera o registro de ontem', async () => {
      const { app, db, clock } = setup({ local: '2026-10-20T09:00' });
      const agent = await employeeAgent(app, 'e1');
      await today(agent);
      clock.set('2026-10-21T09:00');
      db.prepare("UPDATE checklists SET name = 'Abertura nova' WHERE id = 'c1'").run();
      await today(agent);
      const rows = db.prepare("SELECT op_date, checklist_name FROM executions WHERE checklist_id = 'c1' AND employee_id = 'e1' ORDER BY op_date").all();
      expect(rows).toEqual([
        { op_date: '2026-10-20', checklist_name: 'Abertura do restaurante' },
        { op_date: '2026-10-21', checklist_name: 'Abertura nova' },
      ]);
    });
  });
});
