import { randomUUID } from 'node:crypto';
import { GROUPS, MANAGER_GROUP, PERIODS, type Period, assigneesOf, toMinute } from '@rastro/domain';
import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { HttpError, route } from '../../http.js';
import { type ChecklistConfig, loadChecklists, loadEmployeesForAssignment, loadItems } from '../../repos/config.js';
import { insertEmployee } from '../../repos/employees.js';
import { requireAdmin } from '../../security/admin.js';

const fail = (msg: string): never => {
  throw new HttpError(422, msg);
};
const strings = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null);

export function adminChecklistRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/admin/checklists', requireAdmin(db, clock));

  const employeeNames = () =>
    new Map((db.prepare('SELECT id, name FROM employees').all() as { id: string; name: string }[]).map((e) => [e.id, e.name]));

  const view = (c: ChecklistConfig) => {
    const names = employeeNames();
    return { ...c, assignees: assigneesOf(c, loadEmployeesForAssignment(db)).map((e) => names.get(e.id)!) };
  };

  /** Valida na ordem do protótipo (nome → itens → responsáveis → dias → horário) e normaliza. */
  function validate(body: Record<string, unknown>, current?: ChecklistConfig): Omit<ChecklistConfig, 'id'> {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) fail('Dê um nome ao checklist.');
    if (name.length > 120) fail('O nome pode ter até 120 caracteres.');

    const itemIds = strings(body.itemIds) ?? fail('Adicione pelo menos um item.');
    if (itemIds.length === 0) fail('Adicione pelo menos um item.');
    if (new Set(itemIds).size !== itemIds.length) fail('Item repetido no checklist.');
    const items = new Map(loadItems(db).map((i) => [i.id, i]));
    for (const id of itemIds) {
      const it = items.get(id);
      // Itens novos precisam estar ativos; os que já estavam no checklist podem ter sido desativados depois.
      if (!it || (!it.active && !current?.itemIds.includes(id))) fail('Item inválido ou inativo.');
    }

    const roles = strings(body.roles ?? []) ?? fail('Função inválida.');
    const employeeIds = strings(body.employeeIds ?? []) ?? fail('Funcionário inválido.');
    if (roles.length === 0 && employeeIds.length === 0) fail('Associe pelo menos uma função ou pessoa.');
    if (roles.some((g) => !(GROUPS as readonly string[]).includes(g))) fail('Função inválida.');
    const known = employeeNames();
    if (employeeIds.some((id) => !known.has(id))) fail('Funcionário inválido.');

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
      itemIds, roles: [...new Set(roles)], employeeIds: [...new Set(employeeIds)],
    };
  }

  function save(id: string, c: Omit<ChecklistConfig, 'id'>, insert: boolean) {
    db.transaction(() => {
      const args = [c.name, c.description, c.period, JSON.stringify(c.days), c.dueTime, +c.active, id];
      if (insert) db.prepare('INSERT INTO checklists (name, description, period, days, due_time, active, id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(...args);
      else db.prepare('UPDATE checklists SET name = ?, description = ?, period = ?, days = ?, due_time = ?, active = ? WHERE id = ?').run(...args);
      for (const t of ['checklist_items', 'checklist_roles', 'checklist_employees']) db.prepare(`DELETE FROM ${t} WHERE checklist_id = ?`).run(id);
      c.itemIds.forEach((itemId, pos) => db.prepare('INSERT INTO checklist_items VALUES (?, ?, ?)').run(id, itemId, pos));
      c.roles.forEach((g) => db.prepare('INSERT INTO checklist_roles VALUES (?, ?)').run(id, g));
      c.employeeIds.forEach((e) => db.prepare('INSERT INTO checklist_employees VALUES (?, ?)').run(id, e));
    })();
    return view(loadChecklists(db).find((x) => x.id === id)!);
  }

  r.get('/admin/checklists', route((_req, res) => {
    res.json(loadChecklists(db).map(view));
  }));

  r.post('/admin/checklists', route((req, res) => {
    const data = validate(req.body ?? {});
    res.status(201).json(save(`c_${randomUUID().slice(0, 8)}`, data, true));
  }));

  /** Tarefas em texto livre (assistente): reaproveita itens pelo nome e cria os que faltam. */
  function taskItemIds(raw: unknown): string[] {
    const tasks = (strings(raw) ?? fail('Escreva pelo menos uma tarefa.')).map((t) => t.trim()).filter(Boolean);
    if (tasks.length === 0) fail('Escreva pelo menos uma tarefa.');
    if (tasks.some((t) => t.length > 120)) fail('Cada tarefa pode ter até 120 caracteres.');
    const byName = new Map(loadItems(db).map((i) => [i.name.trim().toLowerCase(), i]));
    const ids: string[] = [];
    for (const name of tasks) {
      const key = name.toLowerCase();
      let item = byName.get(key);
      if (!item) {
        item = { id: `i_${randomUUID().slice(0, 8)}`, name, description: '', category: 'Organização', required: false, allowNote: true, active: true };
        db.prepare('INSERT INTO items (id, name, description, category, required, allow_note, active) VALUES (?, ?, ?, ?, 0, 1, 1)')
          .run(item.id, item.name, item.description, item.category);
        byName.set(key, item);
      } else if (!item.active) {
        db.prepare('UPDATE items SET active = 1 WHERE id = ?').run(item.id);
        item.active = true;
      }
      if (!ids.includes(item.id)) ids.push(item.id);
    }
    if (ids.length > 30) fail('Uma lista pode ter até 30 tarefas.');
    return ids;
  }

  /** Pessoas novas do assistente: só nome e função; o cargo fica igual à função. */
  function addNewEmployees(raw: unknown) {
    if (raw === undefined) return;
    if (!Array.isArray(raw)) fail('Lista de pessoas inválida.');
    const list = raw as unknown[];
    if (list.length > 30) fail('Adicione até 30 pessoas por vez.');
    const active = db.prepare('SELECT name FROM employees WHERE active = 1').all() as { name: string }[];
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
      fresh.add(key);
      insertEmployee(db, { name, role: group as string, group: group as string, pin: null, active: true });
    }
  }

  r.post('/admin/checklists/guided', route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim().toLowerCase() : '';
    if (name && loadChecklists(db).some((c) => c.name.trim().toLowerCase() === name))
      throw new HttpError(409, 'Já existe uma lista com esse nome.');
    const created = db.transaction(() => {
      addNewEmployees(body.newEmployees);
      const itemIds = taskItemIds(body.tasks);
      const data = validate({ name: body.name, period: body.period, days: body.days, dueTime: body.dueTime, roles: body.roles, employeeIds: [], itemIds });
      return save(`c_${randomUUID().slice(0, 8)}`, data, true);
    })();
    res.status(201).json(created);
  }));

  r.put('/admin/checklists/:id', route((req, res) => {
    const current = loadChecklists(db).find((c) => c.id === req.params.id);
    if (!current) throw new HttpError(404, 'Checklist não encontrado.');
    res.json(save(current.id, validate(req.body ?? {}, current), false));
  }));

  return r;
}
