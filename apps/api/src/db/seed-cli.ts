import { prepareDb } from './prepare.js';
import { seedCasaBrasa } from './seed-casa-brasa.js';
import { seedDemo } from './seed-demo.js';

const path = process.env.DB_PATH ?? 'rastro.db';
const db = prepareDb(path);
console.log(`Dados de domínio aplicados em ${path} (gestor inicial e biblioteca de tarefas).`);
if (process.argv.includes('--demo')) {
  seedCasaBrasa(db);
  seedDemo(db, new Date());
  console.log('Demonstração Casa Brasa aplicada: equipe, listas e 7 dias de histórico. Não use em produção.');
}
