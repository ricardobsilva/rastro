import { openDb } from './index.js';
import { seed } from './seed.js';
import { seedDemo } from './seed-demo.js';

const path = process.env.DB_PATH ?? 'rastro.db';
const db = openDb(path);
seed(db);
console.log(`Seed Casa Brasa aplicado em ${path}`);
if (process.argv.includes('--demo')) {
  seedDemo(db, new Date());
  console.log('Histórico de demonstração gerado (7 dias + hoje).');
}
