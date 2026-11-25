import type { Db } from './index.js';
import { ITEMS, MANAGER, UNITS } from './seed-data.js';

/**
 * Único seed de produção: gestor inicial, unidades e biblioteca de tarefas ativas.
 * Roda a cada subida da API e nunca sobrescreve o que o gestor já mudou.
 */
export async function seedDomain(db: Db): Promise<void> {
  const insItem = db.prepare(
    'INSERT OR IGNORE INTO items (id, name, description, category, required, allow_note, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
  );
  await db.batch([
    // Só quando ainda não há nenhuma unidade: quem cadastrou as suas (ou importou um backup) não recebe estas.
    {
      sql: `INSERT OR IGNORE INTO units (id, name) SELECT column1, column2 FROM (VALUES ${UNITS.map(() => '(?, ?)').join(', ')})
            WHERE NOT EXISTS (SELECT 1 FROM units)`,
      args: UNITS.flatMap((u) => [u.id, u.name]),
    },
    db.prepare('INSERT OR IGNORE INTO employees (id, name, role, grp, pin, color, active) VALUES (?, ?, ?, ?, ?, ?, 1)')
      .bind(MANAGER.id, MANAGER.name, MANAGER.role, MANAGER.grp, MANAGER.pin, MANAGER.color),
    ...ITEMS.filter((x) => x.active).map((i) => insItem.bind(i.id, i.name, i.description, i.category, +i.required, +i.allowNote)),
  ]);
}
