import type { Db } from './index.js';
import { ITEMS, MANAGER } from './seed-data.js';

/**
 * Único seed de produção: gestor inicial e biblioteca de tarefas ativas.
 * Roda a cada subida da API e nunca sobrescreve o que o gestor já mudou.
 */
export function seedDomain(db: Db): void {
  const insItem = db.prepare(
    'INSERT OR IGNORE INTO items (id, name, description, category, required, allow_note, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
  );
  db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO employees (id, name, role, grp, pin, color, active) VALUES (?, ?, ?, ?, ?, ?, 1)')
      .run(MANAGER.id, MANAGER.name, MANAGER.role, MANAGER.grp, MANAGER.pin, MANAGER.color);
    for (const i of ITEMS.filter((x) => x.active)) insItem.run(i.id, i.name, i.description, i.category, +i.required, +i.allowNote);
  })();
}
