import { type Db, type DbConfig, openDb } from './index.js';
import { rolesToEmployees } from './migrate.js';
import { seedDomain } from './seed-domain.js';

/** Abre o banco da API: esquema + dados de domínio. Nada de demonstração passa por aqui. */
export async function prepareDb(config?: DbConfig): Promise<Db> {
  const db = await openDb(config);
  await seedDomain(db);
  await rolesToEmployees(db);
  return db;
}
