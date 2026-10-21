import { createApp } from './app.js';
import { openDb } from './db/index.js';
import { seed } from './db/seed.js';

const db = openDb(process.env.DB_PATH ?? 'rastro.db');
seed(db);
const port = Number(process.env.PORT ?? 3333);
createApp({ db }).listen(port, () => console.log(`Rastro API em http://localhost:${port}`));
