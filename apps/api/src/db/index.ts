import { type Client, type InArgs, type InValue, type ResultSet, type Transaction, createClient } from '@libsql/client';
import { SCHEMA } from './schema.js';

/** Comando pronto para ir num lote (`db.batch`). */
export type Stmt = { sql: string; args: InValue[] };
export type RunResult = { changes: number; lastInsertRowid: number };

export type Prepared = {
  get(...args: InValue[]): Promise<unknown>;
  all(...args: InValue[]): Promise<unknown[]>;
  run(...args: InValue[]): Promise<RunResult>;
  /** Monta o comando sem executar, para juntar num lote. */
  bind(...args: InValue[]): Stmt;
};

/** Leitura e escrita comando a comando: o banco ou uma transação aberta. */
export type Queryable = { prepare(sql: string): Prepared };

export type Db = Queryable & {
  /** Escritas atômicas numa única ida ao banco: ou todas entram, ou nenhuma. */
  batch(stmts: Stmt[]): Promise<RunResult[]>;
  /** Várias leituras numa única ida ao banco. */
  readMany(stmts: Stmt[]): Promise<unknown[][]>;
  /** Transação interativa (várias idas ao banco). Dentro dela use só `tx`. */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): void;
};

type Executor = { execute(stmt: { sql: string; args: InArgs }): Promise<ResultSet> };

/** Linhas como objetos simples, iguais aos que o better-sqlite3 devolvia. */
const plainRows = (rs: ResultSet) =>
  rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])));

const toRun = (rs: ResultSet): RunResult => ({ changes: rs.rowsAffected, lastInsertRowid: Number(rs.lastInsertRowid ?? 0) });

function queryable(ex: Executor): Queryable {
  return {
    prepare(sql) {
      const exec = (args: InValue[]) => ex.execute({ sql, args });
      return {
        get: async (...args) => plainRows(await exec(args))[0],
        all: async (...args) => plainRows(await exec(args)),
        run: async (...args) => toRun(await exec(args)),
        bind: (...args) => ({ sql, args }),
      };
    },
  };
}

function wrap(client: Client): Db {
  return {
    ...queryable(client),
    async batch(stmts) {
      if (stmts.length === 0) return [];
      return (await client.batch(stmts, 'write')).map(toRun);
    },
    async readMany(stmts) {
      if (stmts.length === 0) return [];
      return (await client.batch(stmts, 'read')).map(plainRows);
    },
    async transaction(fn) {
      const tx: Transaction = await client.transaction('write');
      try {
        const out = await fn(queryable(tx));
        await tx.commit();
        return out;
      } finally {
        tx.close();
      }
    },
    close: () => client.close(),
  };
}

export type DbConfig = { url: string; authToken?: string };

/**
 * Abre o banco e garante o esquema. `url`: `:memory:` (testes), `file:rastro.db` (local)
 * ou `libsql://…` (Turso, em produção).
 */
export async function openDb(config: DbConfig = { url: ':memory:' }): Promise<Db> {
  const client = createClient({ url: config.url, authToken: config.authToken, intMode: 'number' });
  await client.executeMultiple(SCHEMA);
  return wrap(client);
}

/** Configuração a partir do ambiente: Turso se houver `TURSO_DATABASE_URL`, senão arquivo local. */
export function dbConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DbConfig {
  if (env.TURSO_DATABASE_URL) return { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN };
  return { url: `file:${env.DB_PATH ?? 'rastro.db'}` };
}
