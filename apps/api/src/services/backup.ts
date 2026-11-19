import { MANAGER_GROUP } from '@rastro/domain';
import type { InValue } from '@libsql/client';
import type { Db, Stmt } from '../db/index.js';
import { rolesToEmployees } from '../db/migrate.js';
import { HttpError } from '../http.js';

export const EXPORT_FORMAT = 'rastro-export';
export const EXPORT_VERSION = 1;

/** Tabelas de dados, na ordem das chaves estrangeiras (pais antes dos filhos). */
export const EXPORT_TABLES = [
  'employees', 'items', 'checklists', 'checklist_items', 'checklist_roles', 'checklist_employees',
  'executions', 'execution_items', 'audit_events',
] as const;
/** Credenciais temporárias: não vão no arquivo e são apagadas ao importar. */
const SESSION_TABLES = ['admin_sessions', 'devices'];

type Row = Record<string, unknown>;
export type ExportFile = { format: string; version: number; exportedAt: string; tables: Record<string, Row[]> };

const CORRUPTED = 'O arquivo está incompleto ou corrompido.';

export async function exportData(db: Db, at: Date): Promise<ExportFile> {
  const results = await db.readMany(EXPORT_TABLES.map((t) => ({ sql: `SELECT * FROM ${t} ORDER BY rowid`, args: [] })));
  const tables: Record<string, Row[]> = Object.fromEntries(EXPORT_TABLES.map((t, i) => [t, results[i] as Row[]]));
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: at.toISOString(), tables };
}

function validate(data: unknown): Record<string, Row[]> {
  const file = (data ?? {}) as Partial<ExportFile>;
  if (file.format !== EXPORT_FORMAT) throw new HttpError(422, 'Este arquivo não é uma exportação do Rastro.');
  if (typeof file.version === 'number' && file.version > EXPORT_VERSION) throw new HttpError(422, 'Este arquivo é de uma versão mais nova do Rastro.');
  if (file.version !== EXPORT_VERSION || typeof file.tables !== 'object' || file.tables === null) throw new HttpError(422, CORRUPTED);
  const tables = file.tables as Record<string, unknown>;
  for (const t of EXPORT_TABLES) {
    const rows = tables[t];
    if (!Array.isArray(rows) || rows.some((r) => typeof r !== 'object' || r === null || Array.isArray(r))) throw new HttpError(422, CORRUPTED);
  }
  const managers = (tables.employees as Row[]).filter((e) => e.grp === MANAGER_GROUP && !!e.active && typeof e.pin === 'string' && e.pin);
  if (managers.length === 0) throw new HttpError(422, 'O arquivo não tem nenhum gestor ativo com PIN.');
  return tables as Record<string, Row[]>;
}

/**
 * Substitui todos os dados pelos do arquivo, numa transação: ou entra tudo, ou nada muda.
 * Sessões e aparelhos são encerrados, então todos entram de novo com o PIN.
 */
export async function importData(db: Db, data: unknown): Promise<Record<string, number>> {
  const tables = validate(data);
  const columns = await db.readMany(EXPORT_TABLES.map((t) => ({ sql: `PRAGMA table_info(${t})`, args: [] })));
  const stmts: Stmt[] = [...SESSION_TABLES, ...[...EXPORT_TABLES].reverse()].map((t) => ({ sql: `DELETE FROM ${t}`, args: [] }));
  EXPORT_TABLES.forEach((t, i) => {
    const cols = (columns[i] as { name: string }[]).map((c) => c.name);
    const insert = db.prepare(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
    for (const row of tables[t]!) stmts.push(insert.bind(...cols.map((c) => (row[c] ?? null) as InValue)));
  });
  try {
    // Um único lote atômico: ou entra tudo, ou nada muda.
    await db.batch(stmts);
  } catch {
    throw new HttpError(422, CORRUPTED);
  }
  // Backups antigos podem trazer atribuições por função.
  await rolesToEmployees(db);
  return Object.fromEntries(EXPORT_TABLES.map((t) => [t, tables[t]!.length]));
}
