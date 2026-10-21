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
