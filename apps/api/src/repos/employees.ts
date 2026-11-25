import { randomUUID } from 'node:crypto';
import { firstName, initials, shortName } from '@rastro/domain';
import type { Db, Queryable, Stmt } from '../db/index.js';

export type EmployeeRow = { id: string; name: string; role: string; grp: string; pin: string | null; color: string; active: number; unit_ids: string };

/** Unidades da pessoa como lista JSON, na mesma consulta. */
export const UNIT_IDS_SQL = '(SELECT json_group_array(eu.unit_id) FROM employee_units eu WHERE eu.employee_id = employees.id) AS unit_ids';
export const unitIdsOf = (e: { unit_ids: string }) => JSON.parse(e.unit_ids) as string[];

/** Troca as unidades da pessoa (para lotes). */
export const setUnitsStmts = (employeeId: string, unitIds: string[]): Stmt[] => [
  { sql: 'DELETE FROM employee_units WHERE employee_id = ?', args: [employeeId] },
  ...unitIds.map((u) => ({ sql: 'INSERT INTO employee_units (employee_id, unit_id) VALUES (?, ?)', args: [employeeId, u] })),
];

export type PublicEmployee = {
  id: string; name: string; shortName: string; firstName: string; initials: string; role: string; group: string; color: string;
};

export const toPublic = (e: EmployeeRow): PublicEmployee => ({
  id: e.id, name: e.name, shortName: shortName(e.name), firstName: firstName(e.name), initials: initials(e.name),
  role: e.role, group: e.grp, color: e.color,
});

export const getEmployee = async (db: Queryable, id: string) =>
  (await db.prepare(`SELECT *, ${UNIT_IDS_SQL} FROM employees WHERE id = ?`).get(id)) as EmployeeRow | undefined;

export const listActiveEmployees = async (db: Queryable) =>
  (await db.prepare(`SELECT *, ${UNIT_IDS_SQL} FROM employees WHERE active = 1 ORDER BY rowid`).all()) as EmployeeRow[];

const TONES = ['#C2502F', '#2F6F8F', '#8A5A12', '#5B4B8A', '#1F4D3B', '#4A5560', '#9C3B54'];

/** Cadastra com a próxima cor da paleta, em rodízio pela quantidade já cadastrada. */
type NewEmployee = { name: string; role: string; group: string; pin: string | null; active: boolean; unitIds: string[] };

export const countEmployees = async (db: Queryable) =>
  ((await db.prepare('SELECT COUNT(*) AS n FROM employees').get()) as { n: number }).n;

/** Comandos de cadastro (para lotes). `count`: quantos já existem, define a cor. */
export function insertEmployeeStmts(e: NewEmployee, count: number): { id: string; stmts: Stmt[] } {
  const id = `e_${randomUUID().slice(0, 8)}`;
  return {
    id,
    stmts: [
      {
        sql: 'INSERT INTO employees (id, name, role, grp, pin, color, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [id, e.name, e.role, e.group, e.pin, TONES[count % TONES.length]!, +e.active],
      },
      ...setUnitsStmts(id, e.unitIds),
    ],
  };
}

export async function insertEmployee(db: Db, e: NewEmployee) {
  const { id, stmts } = insertEmployeeStmts(e, await countEmployees(db));
  await db.batch(stmts);
  return (await getEmployee(db, id))!;
}
