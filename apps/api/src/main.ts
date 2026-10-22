import { createApp } from './app.js';
import { prepareDb } from './db/prepare.js';

const db = prepareDb(process.env.DB_PATH ?? 'rastro.db');
const port = Number(process.env.PORT ?? 3333);
createApp({ db }).listen(port, () => console.log(`Rastro API em http://localhost:${port}`));
