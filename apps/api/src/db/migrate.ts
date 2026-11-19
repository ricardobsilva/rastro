import type { Db } from './index.js';

/**
 * Checklists deixaram de ser atribuídos por função: só valem as pessoas escolhidas.
 * Atribuições antigas por função viram as pessoas ativas daquela função, e a função é apagada.
 * Idempotente: roda ao subir a API e depois de importar um backup antigo.
 */
export async function rolesToEmployees(db: Db): Promise<void> {
  await db.batch([
    {
      sql: `INSERT OR IGNORE INTO checklist_employees (checklist_id, employee_id)
            SELECT r.checklist_id, e.id FROM checklist_roles r
            JOIN employees e ON e.grp = r.grp AND e.active = 1
            ORDER BY r.rowid, e.rowid`,
      args: [],
    },
    { sql: 'DELETE FROM checklist_roles', args: [] },
  ]);
}
