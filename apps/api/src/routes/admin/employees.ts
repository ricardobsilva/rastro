import { GROUPS, MANAGER_GROUP } from '@rastro/domain';
import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { HttpError, parse, route } from '../../http.js';
import { type EmployeeRow, UNIT_IDS_SQL, getEmployee, insertEmployee, setUnitsStmts, toPublic, unitIdsOf } from '../../repos/employees.js';
import { loadUnits } from '../../repos/units.js';
import { requireAdmin } from '../../security/admin.js';

const FILL = 'Preencha nome e cargo.';

const schema = z.object({
  name: z.string({ message: FILL }).trim().min(1, FILL).max(80, 'O nome pode ter até 80 caracteres.'),
  role: z.string({ message: FILL }).trim().min(1, FILL).max(60, 'O cargo pode ter até 60 caracteres.'),
  group: z.enum(GROUPS, { message: 'Função inválida.' }),
  pin: z.string().regex(/^\d{4}$/, 'O PIN deve ter 4 números.').nullable().optional(),
  active: z.boolean().default(true),
  unitIds: z.array(z.string(), { message: 'Unidade inválida.' }).default([]),
});

const view = (e: EmployeeRow) => ({ ...toPublic(e), active: !!e.active, hasPin: !!e.pin, isManager: e.grp === MANAGER_GROUP, unitIds: unitIdsOf(e) });

export function adminEmployeeRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/admin/employees', requireAdmin(db, clock));

  /** Aplica regras de PIN/gestor e grava. `current` ausente = criação. */
  async function save(input: unknown, current?: EmployeeRow) {
    const base = current ? { name: current.name, role: current.role, group: current.grp, active: !!current.active, unitIds: unitIdsOf(current) } : {};
    const data = parse(schema, { ...base, ...(input as object) });
    const unitIds = [...new Set(data.unitIds)];
    if (unitIds.length) {
      const known = new Set((await loadUnits(db)).map((u) => u.id));
      if (unitIds.some((id) => !known.has(id))) throw new HttpError(422, 'Unidade inválida.');
    }
    const isManager = data.group === MANAGER_GROUP;
    const pin = isManager ? (data.pin ?? current?.pin ?? null) : null;
    if (isManager && !pin) throw new HttpError(422, 'Gestores precisam de um PIN de 4 números.');
    if (pin && (await db.prepare('SELECT 1 FROM employees WHERE pin = ? AND id != ?').get(pin, current?.id ?? '')))
      throw new HttpError(409, 'Esse PIN já está em uso.');

    const losesManager = current && current.grp === MANAGER_GROUP && current.active && (!isManager || !data.active);
    if (losesManager) {
      const others = (await db.prepare("SELECT COUNT(*) AS n FROM employees WHERE grp = ? AND active = 1 AND id != ?").get(MANAGER_GROUP, current.id)) as { n: number };
      if (others.n === 0) throw new HttpError(422, 'É preciso manter pelo menos um gestor ativo.');
    }

    if (current) {
      await db.batch([
        db.prepare('UPDATE employees SET name = ?, role = ?, grp = ?, pin = ?, active = ? WHERE id = ?')
          .bind(data.name, data.role, data.group, pin, +data.active, current.id),
        ...setUnitsStmts(current.id, unitIds),
      ]);
      return (await getEmployee(db, current.id))!;
    }
    return insertEmployee(db, { name: data.name, role: data.role, group: data.group, pin, active: data.active, unitIds });
  }

  r.get('/admin/employees', route(async (_req, res) => {
    res.json(((await db.prepare(`SELECT *, ${UNIT_IDS_SQL} FROM employees ORDER BY active DESC, rowid`).all()) as EmployeeRow[]).map(view));
  }));

  r.post('/admin/employees', route(async (req, res) => {
    res.status(201).json(view(await save(req.body)));
  }));

  r.patch('/admin/employees/:id', route(async (req, res) => {
    const current = await getEmployee(db, req.params.id!);
    if (!current) throw new HttpError(404, 'Funcionário não encontrado.');
    res.json(view(await save(req.body, current)));
  }));

  return r;
}
