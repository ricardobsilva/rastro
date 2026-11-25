import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { HttpError, parse, route } from '../../http.js';
import { type Unit, loadUnits } from '../../repos/units.js';
import { requireAdmin } from '../../security/admin.js';

const NAME = 'Dê um nome à unidade.';
const schema = z.object({
  name: z.string({ message: NAME }).trim().min(1, NAME).max(60, 'O nome pode ter até 60 caracteres.'),
  active: z.boolean({ message: 'Situação inválida.' }).default(true),
});

export function adminUnitRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/admin/units', requireAdmin(db, clock));

  const views = async (units: Unit[]) => {
    const rows = (await db.prepare('SELECT unit_id, COUNT(*) AS n FROM checklists WHERE active = 1 AND unit_id IS NOT NULL GROUP BY unit_id').all()) as { unit_id: string; n: number }[];
    const count = new Map(rows.map((x) => [x.unit_id, x.n]));
    return units.map((u) => ({ ...u, checklists: count.get(u.id) ?? 0 }));
  };
  const view = async (id: string) => (await views((await loadUnits(db)).filter((u) => u.id === id)))[0];

  async function check(input: unknown, current?: Unit) {
    const data = parse(schema, { ...current, ...(input as object) });
    const units = await loadUnits(db);
    if (units.some((u) => u.id !== current?.id && u.name.toLowerCase() === data.name.toLowerCase()))
      throw new HttpError(409, 'Já existe uma unidade com esse nome.');
    // Fechar uma unidade com listas ativas deixaria tarefas sem lugar para marcar.
    if (current?.active && !data.active && (await view(current.id))!.checklists > 0)
      throw new HttpError(409, 'Desative ou mova os checklists desta unidade antes de desativá-la.');
    return data;
  }

  r.get('/admin/units', route(async (_req, res) => {
    res.json(await views(await loadUnits(db)));
  }));

  r.post('/admin/units', route(async (req, res) => {
    const { name, active } = await check(req.body ?? {});
    const id = `u_${randomUUID().slice(0, 8)}`;
    await db.prepare('INSERT INTO units (id, name, active) VALUES (?, ?, ?)').run(id, name, +active);
    res.status(201).json(await view(id));
  }));

  r.patch('/admin/units/:id', route(async (req, res) => {
    const current = (await loadUnits(db)).find((u) => u.id === req.params.id);
    if (!current) throw new HttpError(404, 'Unidade não encontrada.');
    const { name, active } = await check(req.body ?? {}, current);
    await db.prepare('UPDATE units SET name = ?, active = ? WHERE id = ?').run(name, +active, current.id);
    res.json(await view(current.id));
  }));

  return r;
}
