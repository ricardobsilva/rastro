import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';

export type Db = Database.Database;

export function openDb(path = ':memory:'): Db {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
