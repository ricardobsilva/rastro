import { randomUUID } from 'node:crypto';
import { GROUPS, MANAGER_GROUP } from '@rastro/domain';
import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { HttpError, parse, route } from '../../http.js';
import { type EmployeeRow, getEmployee, toPublic } from '../../repos/employees.js';
import { requireAdmin } from '../../security/admin.js';

const TONES = ['#C2502F', '#2F6F8F', '#8A5A12', '#5B4B8A', '#1F4D3B', '#4A5560', '#9C3B54'];
const FILL = 'Preencha nome e cargo.';

const schema = z.object({
  name: z.string({ message: FILL }).trim().min(1, FILL).max(80, 'O nome pode ter até 80 caracteres.'),
  role: z.string({ message: FILL }).trim().min(1, FILL).max(60, 'O cargo pode ter até 60 caracteres.'),
  group: z.enum(GROUPS, { message: 'Função inválida.' }),
  pin: z.string().regex(/^\d{4}$/, 'O PIN deve ter 4 números.').nullable().optional(),
  active: z.boolean().default(true),
});

const view = (e: EmployeeRow) => ({ ...toPublic(e), active: !!e.active, hasPin: !!e.pin, isManager: e.grp === MANAGER_GROUP });

export function adminEmployeeRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/admin/employees', requireAdmin(db, clock));

  /** Aplica regras de PIN/gestor e grava. `current` ausente = criação. */
  function save(input: unknown, current?: EmployeeRow) {
    const base = current ? { name: current.name, role: current.role, group: current.grp, active: !!current.active } : {};
    const data = parse(schema, { ...base, ...(input as object) });
    const isManager = data.group === MANAGER_GROUP;
    const pin = isManager ? (data.pin ?? current?.pin ?? null) : null;
    if (isManager && !pin) throw new HttpError(422, 'Gestores precisam de um PIN de 4 números.');
    if (pin && db.prepare('SELECT 1 FROM employees WHERE pin = ? AND id != ?').get(pin, current?.id ?? ''))
      throw new HttpError(409, 'Esse PIN já está em uso.');

    const losesManager = current && current.grp === MANAGER_GROUP && current.active && (!isManager || !data.active);
    if (losesManager) {
      const others = db.prepare("SELECT COUNT(*) AS n FROM employees WHERE grp = ? AND active = 1 AND id != ?").get(MANAGER_GROUP, current.id) as { n: number };
      if (others.n === 0) throw new HttpError(422, 'É preciso manter pelo menos um gestor ativo.');
    }

    if (current) {
      db.prepare('UPDATE employees SET name = ?, role = ?, grp = ?, pin = ?, active = ? WHERE id = ?')
        .run(data.name, data.role, data.group, pin, +data.active, current.id);
      return getEmployee(db, current.id)!;
    }
    const id = `e_${randomUUID().slice(0, 8)}`;
    const count = (db.prepare('SELECT COUNT(*) AS n FROM employees').get() as { n: number }).n;
    db.prepare('INSERT INTO employees (id, name, role, grp, pin, color, active) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, data.name, data.role, data.group, pin, TONES[count % TONES.length], +data.active);
    return getEmployee(db, id)!;
  }

  r.get('/admin/employees', route((_req, res) => {
    res.json((db.prepare('SELECT * FROM employees ORDER BY active DESC, rowid').all() as EmployeeRow[]).map(view));
  }));

  r.post('/admin/employees', route((req, res) => {
    res.status(201).json(view(save(req.body)));
  }));

  r.patch('/admin/employees/:id', route((req, res) => {
    const current = getEmployee(db, req.params.id!);
    if (!current) throw new HttpError(404, 'Funcionário não encontrado.');
    res.json(view(save(req.body, current)));
  }));

  return r;
}
