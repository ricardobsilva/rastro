import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { adminAgent, employeeAgent, setup } from './helpers/setup.js';

type Agent = Awaited<ReturnType<typeof employeeAgent>>;
async function mark(agent: Agent, cl: string, items: string[]) {
  const id = (await agent.get('/api/me/today')).body.cards.find((c: { checklistId: string }) => c.checklistId === cl).executionId;
  for (const i of items) await agent.put(`/api/me/executions/${id}/items/${i}`).send({ done: true });
}

describe('US15 — painel do gestor', () => {
  describe('datas', () => {
    it('hoje + 7 dias anteriores com rótulos (sucesso)', async () => {
      const { app } = setup({ local: '2026-10-21T10:00' });
      const res = await (await adminAgent(app)).get('/api/admin/dates');
      expect(res.body).toHaveLength(8);
      expect(res.body.slice(0, 3)).toEqual([
        { value: '2026-10-21', label: 'Hoje · 21/10' }, { value: '2026-10-20', label: 'Ontem · 20/10' }, { value: '2026-10-19', label: 'Seg · 19/10' },
      ]);
    });
  });

  describe('sucesso', () => {
    it('KPIs, conclusão por checklist, atrasos e pendências do dia', async () => {
      const { app, clock } = setup({ local: '2026-10-21T10:00' });
      const joao = await employeeAgent(app, 'e1');
      await mark(joao, 'c1', ['i1', 'i2', 'i3', 'i4', 'i5', 'i6']);
      clock.set('2026-10-21T11:40');
      const res = await (await adminAgent(app)).get('/api/admin/dashboard');
      expect(res.status).toBe(200);
      const b = res.body;
      expect(b).toMatchObject({ date: '2026-10-21', isToday: true, now: '11:40', dateLabel: 'quarta-feira, 21 de outubro' });
      expect(b.kpis.done).toBe(6);
      expect(b.kpis.total).toBe(b.kpis.done + b.kpis.pending + b.kpis.late);
      expect(b.kpis.pct).toBe(Math.round((6 / b.kpis.total) * 100));
      const c1 = b.byChecklist.find((x: { name: string }) => x.name === 'Abertura do restaurante');
      expect(c1).toEqual({ name: 'Abertura do restaurante', done: 6, late: 6, total: 12 });
      expect(b.byChecklist.at(-1).done / b.byChecklist.at(-1).total).toBeGreaterThanOrEqual(b.byChecklist[0].done / b.byChecklist[0].total);
      expect(b.lateList.length).toBeLessThanOrEqual(6);
      expect(b.lateList[0]).toMatchObject({ due: '09:30', delayMin: 130 });
      expect(b.pendingByEmployee[0].late).toBeGreaterThanOrEqual(b.pendingByEmployee.at(-1).late);
      expect(b.trend).toHaveLength(8);
      expect(b.trend.at(-1)).toMatchObject({ date: '2026-10-21', label: 'Hoje' });
      expect(b.byCategory.map((c: { category: string }) => c.category)).toEqual(['Limpeza', 'Estoque', 'Organização', 'Cozinha', 'Atendimento', 'Equipamentos']);
    });

    it('filtros por funcionário, categoria, checklist e status', async () => {
      const { app } = setup({ local: '2026-10-21T10:00' });
      const joao = await employeeAgent(app, 'e1');
      await mark(joao, 'c1', ['i1']);
      const admin = await adminAgent(app);
      const byEmp = (await admin.get('/api/admin/dashboard?employeeId=e1')).body;
      expect(byEmp.kpis.total).toBe(12);
      const done = (await admin.get('/api/admin/dashboard?employeeId=e1&status=done')).body;
      expect(done.kpis).toMatchObject({ total: 1, done: 1 });
      const cat = (await admin.get('/api/admin/dashboard?category=Organização&checklistId=c1')).body;
      expect(cat.byChecklist).toEqual([{ name: 'Abertura do restaurante', done: 1, late: 0, total: 2 }]);
    });

    it('dia anterior: itens não feitos contam como atrasados ("não feito")', async () => {
      const { app, clock } = setup({ local: '2026-10-20T10:00' });
      const joao = await employeeAgent(app, 'e1');
      await mark(joao, 'c1', ['i1']);
      clock.set('2026-10-21T08:00');
      const res = await (await adminAgent(app)).get('/api/admin/dashboard?date=2026-10-20&employeeId=e1');
      expect(res.body).toMatchObject({ isToday: false, date: '2026-10-20' });
      expect(res.body.kpis).toMatchObject({ total: 12, done: 1, pending: 0, late: 11 });
      expect(res.body.lateList[0].delayMin).toBeNull();
    });
  });

  describe('erro', () => {
    it('data inválida ou fora da janela → 422; status inválido → 422', async () => {
      const { app } = setup({ local: '2026-10-21T10:00' });
      const admin = await adminAgent(app);
      for (const q of ['date=ontem', 'date=2026-10-13', 'date=2026-10-22', 'status=feito']) {
        const res = await admin.get(`/api/admin/dashboard?${q}`);
        expect(res.status).toBe(422);
      }
      expect((await admin.get('/api/admin/dashboard?date=2026-10-13')).body.error).toBe('Data fora do período disponível.');
    });

    it('sem gestor → 401', async () => {
      const { app } = setup();
      expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
    });
  });

  describe('borda', () => {
    it('filtro com id inexistente devolve vazio, com 0% e sem divisão por zero', async () => {
      const { app } = setup();
      const res = await (await adminAgent(app)).get('/api/admin/dashboard?employeeId=zz');
      expect(res.status).toBe(200);
      expect(res.body.kpis).toEqual({ total: 0, done: 0, pending: 0, late: 0, pct: 0, checklists: 0 });
      expect(res.body.byChecklist).toEqual([]);
      expect(res.body.byCategory).toEqual([]);
    });

    it('filtro de status não afeta a tendência de 8 dias', async () => {
      const { app } = setup({ local: '2026-10-21T10:00' });
      const joao = await employeeAgent(app, 'e1');
      await mark(joao, 'c1', ['i1']);
      const admin = await adminAgent(app);
      const all = (await admin.get('/api/admin/dashboard?employeeId=e1')).body.trend.at(-1);
      const late = (await admin.get('/api/admin/dashboard?employeeId=e1&status=late')).body.trend.at(-1);
      expect(late).toEqual(all);
      expect(all.pct).toBe(8);
    });

    it('nome antigo de checklist aparece nos dias anteriores', async () => {
      const { app, db, clock } = setup({ local: '2026-10-20T10:00' });
      await (await employeeAgent(app, 'e1')).get('/api/me/today');
      clock.set('2026-10-21T10:00');
      db.prepare("UPDATE checklists SET name = 'Abertura nova' WHERE id = 'c1'").run();
      const admin = await adminAgent(app);
      const names = (await admin.get('/api/admin/dashboard?date=2026-10-20')).body.byChecklist.map((c: { name: string }) => c.name);
      expect(names).toContain('Abertura do restaurante');
      expect(names).not.toContain('Abertura nova');
    });
  });
});
