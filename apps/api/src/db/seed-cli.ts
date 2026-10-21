import { openDb } from './index.js';
import { seed } from './seed.js';

const path = process.env.DB_PATH ?? 'rastro.db';
seed(openDb(path));
console.log(`Seed Casa Brasa aplicado em ${path}`);
