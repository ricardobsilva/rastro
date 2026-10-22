import { randomUUID } from 'node:crypto';
import { firstName, initials, shortName } from '@rastro/domain';
import type { Db } from '../db/index.js';

export type EmployeeRow = { id: string; name: string; role: string; grp: string; pin: string | null; color: string; active: number };

export type PublicEmployee = {
  id: string; name: string; shortName: string; firstName: string; initials: string; role: string; group: string; color: string;
};

export const toPublic = (e: EmployeeRow): PublicEmployee => ({
  id: e.id, name: e.name, shortName: shortName(e.name), firstName: firstName(e.name), initials: initials(e.name),
  role: e.role, group: e.grp, color: e.color,
});

export const getEmployee = (db: Db, id: string) =>
  db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as EmployeeRow | undefined;

export const listActiveEmployees = (db: Db) =>
  db.prepare('SELECT * FROM employees WHERE active = 1 ORDER BY rowid').all() as EmployeeRow[];

const TONES = ['#C2502F', '#2F6F8F', '#8A5A12', '#5B4B8A', '#1F4D3B', '#4A5560', '#9C3B54'];

/** Cadastra com a próxima cor da paleta, em rodízio pela quantidade já cadastrada. */
export function insertEmployee(db: Db, e: { name: string; role: string; group: string; pin: string | null; active: boolean }) {
  const id = `e_${randomUUID().slice(0, 8)}`;
  const count = (db.prepare('SELECT COUNT(*) AS n FROM employees').get() as { n: number }).n;
  db.prepare('INSERT INTO employees (id, name, role, grp, pin, color, active) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, e.name, e.role, e.group, e.pin, TONES[count % TONES.length], +e.active);
  return getEmployee(db, id)!;
}
