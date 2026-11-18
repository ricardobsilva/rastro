import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app.js';
import { dbConfigFromEnv } from './db/index.js';
import { prepareDb } from './db/prepare.js';

/**
 * Entrada da função serverless na Vercel. O banco (Turso) é aberto uma vez por instância,
 * na primeira requisição, e reaproveitado enquanto a instância estiver quente.
 * Na Vercel há exatamente um proxy à frente da função.
 */
let app: Promise<ReturnType<typeof createApp>> | undefined;

function init() {
  if (!process.env.TURSO_DATABASE_URL) throw new Error('Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN nas variáveis de ambiente da Vercel.');
  return prepareDb(dbConfigFromEnv()).then((db) => createApp({ db, trustProxy: 1 }));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  app ??= init().catch((err) => {
    app = undefined; // tenta de novo na próxima requisição
    throw err;
  });
  (await app)(req, res);
}
