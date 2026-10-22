import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { prepareDb } from './db/prepare.js';

const db = prepareDb(process.env.DB_PATH ?? 'rastro.db');
const port = Number(process.env.PORT ?? 3333);
// Telas geradas pelo `npm run build`; se não existirem (desenvolvimento), o Vite serve.
const webBuild = process.env.STATIC_DIR ?? fileURLToPath(new URL('../../web/dist', import.meta.url));
const staticDir = existsSync(webBuild) ? webBuild : undefined;
const trustProxy = process.env.TRUST_PROXY_HOPS ? Number(process.env.TRUST_PROXY_HOPS) : undefined;

createApp({ db, staticDir, trustProxy }).listen(port, () =>
  console.log(`Rastro em http://localhost:${port}${staticDir ? ' (servindo as telas)' : ''}`),
);
