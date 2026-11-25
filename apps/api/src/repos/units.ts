import type { Db } from '../db/index.js';
import { HttpError } from '../http.js';

export type Unit = { id: string; name: string; active: boolean };

export async function loadUnits(db: Db): Promise<Unit[]> {
  const rows = (await db.prepare('SELECT id, name, active FROM units ORDER BY rowid').all()) as { id: string; name: string; active: number }[];
  return rows.map((u) => ({ ...u, active: !!u.active }));
}

export const activeUnits = async (db: Db) => (await loadUnits(db)).filter((u) => u.active).map(({ id, name }) => ({ id, name }));

/** Filtro de unidade vindo da URL. Ausente ou "all" = todas. */
export function parseUnitFilter(raw: unknown, units: Unit[]): string | null {
  if (raw === undefined || raw === '' || raw === 'all') return null;
  if (!units.some((u) => u.id === raw)) throw new HttpError(422, 'Unidade inválida.');
  return raw as string;
}
