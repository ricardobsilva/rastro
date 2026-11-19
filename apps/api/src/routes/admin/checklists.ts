import { randomUUID } from 'node:crypto';
import { GROUPS, MANAGER_GROUP, PERIODS, type Period, assigneesOf, toMinute } from '@rastro/domain';
import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { HttpError, route } from '../../http.js';
import type { Stmt } from '../../db/index.js';
import { type ChecklistConfig, type ItemConfig, loadChecklists, loadEmployeesForAssignment, loadItems } from '../../repos/config.js';
import { countEmployees, insertEmployeeStmt } from '../../repos/employees.js';
import { requireAdmin } from '../../security/admin.js';

const fail = (msg: string): never => {
  throw new HttpError(422, msg);
};
const strings = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null);

export function adminChecklistRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/admin/checklists', requireAdmin(db, clock));

  const employeeNames = async () =>
    new Map(((await db.prepare('SELECT id, name FROM employees').all()) as { id: string; name: string }[]).map((e) => [e.id, e.name]));

  const views = async (cs: ChecklistConfig[]) => {
    const [names, employees] = await Promise.all([employeeNames(), loadEmployeesForAssignment(db)]);
    return cs.map((c) => ({ ...c, assignees: assigneesOf(c, employees).map((e) => names.get(e.id)!) }));
  };

  /**
   * Valida na ordem do protótipo (nome → itens → responsáveis → dias → horário) e normaliza.
   * `items`: biblioteca a considerar (o assistente passa a atual mais as tarefas que vai criar).
   */
  async function validate(
    body: Record<string, unknown>, current?: ChecklistConfig, items?: Map<string, ItemConfig>, newEmployeeIds: string[] = [],
  ): Promise<Omit<ChecklistConfig, 'id'>> {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) fail('Dê um nome ao checklist.');
    if (name.length > 120) fail('O nome pode ter até 120 caracteres.');

    const itemIds = strings(body.itemIds) ?? fail('Adicione pelo menos um item.');
    if (itemIds.length === 0) fail('Adicione pelo menos um item.');
    if (new Set(itemIds).size !== itemIds.length) fail('Item repetido no checklist.');
    const library = items ?? new Map((await loadItems(db)).map((i) => [i.id, i]));
    for (const id of itemIds) {
      const it = library.get(id);
      // Itens novos precisam estar ativos; os que já estavam no checklist podem ter sido desativados depois.
      if (!it || (!it.active && !current?.itemIds.includes(id))) fail('Item inválido ou inativo.');
    }

    const employeeIds = strings(body.employeeIds ?? []) ?? fail('Funcionário inválido.');
    if (employeeIds.length === 0) fail('Escolha pelo menos uma pessoa.');
    const known = await employeeNames();
    if (employeeIds.some((id) => !known.has(id) && !newEmployeeIds.includes(id))) fail('Funcionário inválido.');

    const period = body.period as Period;
    if (!PERIODS.includes(period)) fail('Periodicidade inválida.');
    let days: number[] = [];
    if (period === 'weekdays' || period === 'weekly') {
      const raw = Array.isArray(body.days) ? body.days : [];
      if (raw.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) fail('Dia da semana inválido.');
      days = [...new Set(raw as number[])].sort((a, b) => a - b);
      if (days.length === 0) fail('Escolha os dias da semana.');
      if (period === 'weekly' && days.length > 1) fail('Semanal aceita apenas um dia.');
    }

    let dueTime: string | null = null;
    if (period !== 'ondemand') {
      dueTime = typeof body.dueTime === 'string' ? body.dueTime : '';
      if (toMinute(dueTime) === null) fail('Defina o horário esperado de execução.');
    }

    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (description.length > 300) fail('A descrição pode ter até 300 caracteres.');
    return {
      name, description, period, days, dueTime, active: body.active !== false,
      itemIds, employeeIds: [...new Set(employeeIds)],
    };
  }

  /** Comandos que gravam o checklist e suas associações (vão num lote atômico). */
  function saveStmts(id: string, c: Omit<ChecklistConfig, 'id'>, insert: boolean): Stmt[] {
    const args = [c.name, c.description, c.period, JSON.stringify(c.days), c.dueTime, +c.active, id];
    return [
      insert
        ? { sql: 'INSERT INTO checklists (name, description, period, days, due_time, active, id) VALUES (?, ?, ?, ?, ?, ?, ?)', args }
        : { sql: 'UPDATE checklists SET name = ?, description = ?, period = ?, days = ?, due_time = ?, active = ? WHERE id = ?', args },
      ...['checklist_items', 'checklist_employees'].map((t) => ({ sql: `DELETE FROM ${t} WHERE checklist_id = ?`, args: [id] })),
      ...c.itemIds.map((itemId, pos) => ({ sql: 'INSERT INTO checklist_items VALUES (?, ?, ?)', args: [id, itemId, pos] })),
      ...c.employeeIds.map((e) => ({ sql: 'INSERT INTO checklist_employees VALUES (?, ?)', args: [id, e] })),
    ];
  }

  async function saved(id: string) {
    return (await views([(await loadChecklists(db)).find((x) => x.id === id)!]))[0];
  }

  r.get('/admin/checklists', route(async (_req, res) => {
    res.json(await views(await loadChecklists(db)));
  }));

  r.post('/admin/checklists', route(async (req, res) => {
    const data = await validate(req.body ?? {});
    const id = `c_${randomUUID().slice(0, 8)}`;
    await db.batch(saveStmts(id, data, true));
    res.status(201).json(await saved(id));
  }));

  /** Tarefas em texto livre (assistente): reaproveita itens pelo nome e cria os que faltam. */
  async function taskItems(raw: unknown, stmts: Stmt[]) {
    const tasks = (strings(raw) ?? fail('Escreva pelo menos uma tarefa.')).map((t) => t.trim()).filter(Boolean);
    if (tasks.length === 0) fail('Escreva pelo menos uma tarefa.');
    if (tasks.some((t) => t.length > 120)) fail('Cada tarefa pode ter até 120 caracteres.');
    const library = new Map((await loadItems(db)).map((i) => [i.id, i]));
    const byName = new Map([...library.values()].map((i) => [i.name.trim().toLowerCase(), i]));
    const ids: string[] = [];
    for (const name of tasks) {
      const key = name.toLowerCase();
      let item = byName.get(key);
      if (!item) {
        item = { id: `i_${randomUUID().slice(0, 8)}`, name, description: '', category: 'Organização', required: false, allowNote: true, active: true };
        stmts.push({
          sql: 'INSERT INTO items (id, name, description, category, required, allow_note, active) VALUES (?, ?, ?, ?, 0, 1, 1)',
          args: [item.id, item.name, item.description, item.category],
        });
        byName.set(key, item);
        library.set(item.id, item);
      } else if (!item.active) {
        stmts.push({ sql: 'UPDATE items SET active = 1 WHERE id = ?', args: [item.id] });
        item.active = true;
      }
      if (!ids.includes(item.id)) ids.push(item.id);
    }
    if (ids.length > 30) fail('Uma lista pode ter até 30 tarefas.');
    return { ids, library };
  }

  /** Pessoas novas do assistente: só nome e função; o cargo fica igual à função. */
  async function addNewEmployees(raw: unknown, stmts: Stmt[]): Promise<{ id: string; group: string }[]> {
    const created: { id: string; group: string }[] = [];
    if (raw === undefined) return created;
    if (!Array.isArray(raw)) fail('Lista de pessoas inválida.');
    const list = raw as unknown[];
    if (list.length > 30) fail('Adicione até 30 pessoas por vez.');
    const [active, count] = await Promise.all([
      db.prepare('SELECT name FROM employees WHERE active = 1').all() as Promise<{ name: string }[]>,
      countEmployees(db),
    ]);
    const seen = new Map(active.map((e) => [e.name.trim().toLowerCase(), e.name]));
    const fresh = new Set<string>();
    for (const p of list) {
      const { name: rawName, group } = (p ?? {}) as { name?: unknown; group?: unknown };
      const name = typeof rawName === 'string' ? rawName.trim() : '';
      if (!name) fail('Escreva o nome da pessoa.');
      if (name.length > 80) fail('O nome pode ter até 80 caracteres.');
      if (group === MANAGER_GROUP) fail('Para cadastrar um gestor, use a página Equipe.');
      if (!(GROUPS as readonly unknown[]).includes(group)) fail('Função inválida.');
      const key = name.toLowerCase();
      if (fresh.has(key)) throw new HttpError(409, `${name} aparece duas vezes.`);
      if (seen.has(key)) throw new HttpError(409, `${seen.get(key)} já está na equipe.`);
      const { id, stmt } = insertEmployeeStmt({ name, role: group as string, group: group as string, pin: null, active: true }, count + fresh.size);
      stmts.push(stmt);
      created.push({ id, group: group as string });
      fresh.add(key);
    }
    return created;
  }

  r.post('/admin/checklists/guided', route(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim().toLowerCase() : '';
    if (name && (await loadChecklists(db)).some((c) => c.name.trim().toLowerCase() === name))
      throw new HttpError(409, 'Já existe uma lista com esse nome.');
    // Tudo é validado antes e gravado num único lote: se algo falhar, nada muda.
    const stmts: Stmt[] = [];
    const created = await addNewEmployees(body.newEmployees, stmts);
    const { ids: itemIds, library } = await taskItems(body.tasks, stmts);
    // No assistente se escolhe a função: ela vira as pessoas ativas dela, inclusive as recém-cadastradas.
    const roles = strings(body.roles ?? []) ?? fail('Função inválida.');
    if (roles.some((g) => !(GROUPS as readonly string[]).includes(g))) fail('Função inválida.');
    const team = [...(await loadEmployeesForAssignment(db)).filter((e) => e.active), ...created];
    const employeeIds = team.filter((e) => roles.includes(e.group)).map((e) => e.id);
    const data = await validate(
      { name: body.name, period: body.period, days: body.days, dueTime: body.dueTime, employeeIds, itemIds },
      undefined, library, created.map((e) => e.id),
    );
    const id = `c_${randomUUID().slice(0, 8)}`;
    await db.batch([...stmts, ...saveStmts(id, data, true)]);
    res.status(201).json(await saved(id));
  }));

  r.put('/admin/checklists/:id', route(async (req, res) => {
    const current = (await loadChecklists(db)).find((c) => c.id === req.params.id);
    if (!current) throw new HttpError(404, 'Checklist não encontrado.');
    await db.batch(saveStmts(current.id, await validate(req.body ?? {}, current), false));
    res.json(await saved(current.id));
  }));

  return r;
}
