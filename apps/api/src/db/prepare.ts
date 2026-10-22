import { type Db, openDb } from './index.js';
import { seedDomain } from './seed-domain.js';

/** Abre o banco da API: esquema + dados de domínio. Nada de demonstração passa por aqui. */
export function prepareDb(path: string): Db {
  const db = openDb(path);
  seedDomain(db);
  return db;
}
