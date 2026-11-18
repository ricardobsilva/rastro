import { randomUUID } from 'node:crypto';
import { firstName, initials, shortName } from '@rastro/domain';
import type { Queryable, Stmt } from '../db/index.js';

export type EmployeeRow = { id: string; name: string; role: string; grp: string; pin: string | null; color: string; active: number };

export type PublicEmployee = {
  id: string; name: string; shortName: string; firstName: string; initials: string; role: string; group: string; color: string;
};

export const toPublic = (e: EmployeeRow): PublicEmployee => ({
  id: e.id, name: e.name, shortName: shortName(e.name), firstName: firstName(e.name), initials: initials(e.name),
  role: e.role, group: e.grp, color: e.color,
});

export const getEmployee = async (db: Queryable, id: string) =>
  (await db.prepare('SELECT * FROM employees WHERE id = ?').get(id)) as EmployeeRow | undefined;

export const listActiveEmployees = async (db: Queryable) =>
  (await db.prepare('SELECT * FROM employees WHERE active = 1 ORDER BY rowid').all()) as EmployeeRow[];

const TONES = ['#C2502F', '#2F6F8F', '#8A5A12', '#5B4B8A', '#1F4D3B', '#4A5560', '#9C3B54'];

/** Cadastra com a próxima cor da paleta, em rodízio pela quantidade já cadastrada. */
type NewEmployee = { name: string; role: string; group: string; pin: string | null; active: boolean };

export const countEmployees = async (db: Queryable) =>
  ((await db.prepare('SELECT COUNT(*) AS n FROM employees').get()) as { n: number }).n;

/** Comando de cadastro (para lotes). `count`: quantos já existem, define a cor. */
export function insertEmployeeStmt(e: NewEmployee, count: number): { id: string; stmt: Stmt } {
  const id = `e_${randomUUID().slice(0, 8)}`;
  return {
    id,
    stmt: {
      sql: 'INSERT INTO employees (id, name, role, grp, pin, color, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, e.name, e.role, e.group, e.pin, TONES[count % TONES.length]!, +e.active],
    },
  };
}

export async function insertEmployee(db: Queryable, e: NewEmployee) {
  const { id, stmt } = insertEmployeeStmt(e, await countEmployees(db));
  await db.prepare(stmt.sql).run(...stmt.args);
  return (await getEmployee(db, id))!;
}
