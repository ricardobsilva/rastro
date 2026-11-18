import { randomUUID } from 'node:crypto';
import { CATEGORIES } from '@rastro/domain';
import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { HttpError, parse, route } from '../../http.js';
import { type ItemConfig, loadChecklists, loadItems } from '../../repos/config.js';
import { requireAdmin } from '../../security/admin.js';

const itemSchema = z.object({
  name: z.string({ message: 'Informe o nome do item.' }).trim().min(1, 'Informe o nome do item.').max(120, 'O nome pode ter até 120 caracteres.'),
  description: z.string().trim().max(300, 'A descrição pode ter até 300 caracteres.').default(''),
  category: z.enum(CATEGORIES, { message: 'Categoria inválida.' }),
  required: z.boolean().default(false),
  allowNote: z.boolean().default(false),
  active: z.boolean().default(true),
});

export function adminItemRoutes({ db, clock }: AppContext) {
  const r = Router();
  r.use('/admin/items', requireAdmin(db, clock));

  const withUsage = async (items: ItemConfig[]) => {
    const cls = await loadChecklists(db);
    return items.map((i) => ({ ...i, usedIn: cls.filter((c) => c.itemIds.includes(i.id)).map((c) => c.name) }));
  };
  const assertUniqueName = async (name: string, exceptId?: string) => {
    const clash = (await loadItems(db)).find((i) => i.id !== exceptId && i.name.trim().toLowerCase() === name.toLowerCase());
    if (clash) throw new HttpError(409, 'Já existe um item com esse nome.');
  };
  const save = async (i: ItemConfig, insert: boolean) => {
    const sql = insert
      ? 'INSERT INTO items (name, description, category, required, allow_note, active, id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      : 'UPDATE items SET name = ?, description = ?, category = ?, required = ?, allow_note = ?, active = ? WHERE id = ?';
    await db.prepare(sql).run(i.name, i.description, i.category, +i.required, +i.allowNote, +i.active, i.id);
    return (await withUsage([i]))[0];
  };

  r.get('/admin/items', route(async (_req, res) => {
    res.json(await withUsage(await loadItems(db)));
  }));

  r.post('/admin/items', route(async (req, res) => {
    const data = parse(itemSchema, req.body);
    await assertUniqueName(data.name);
    res.status(201).json(await save({ id: `i_${randomUUID().slice(0, 8)}`, ...data }, true));
  }));

  r.patch('/admin/items/:id', route(async (req, res) => {
    const current = (await loadItems(db)).find((i) => i.id === req.params.id);
    if (!current) throw new HttpError(404, 'Item não encontrado.');
    const data = parse(itemSchema, { ...current, ...req.body });
    await assertUniqueName(data.name, current.id);
    res.json(await save({ ...current, ...data }, false));
  }));

  return r;
}
