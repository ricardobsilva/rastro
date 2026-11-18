import { dbConfigFromEnv } from './index.js';
import { prepareDb } from './prepare.js';
import { seedCasaBrasa } from './seed-casa-brasa.js';
import { seedDemo } from './seed-demo.js';

const config = dbConfigFromEnv();
const db = await prepareDb(config);
console.log(`Dados de domínio aplicados em ${config.url} (gestor inicial e biblioteca de tarefas).`);
if (process.argv.includes('--demo')) {
  if (config.url.startsWith('libsql:')) throw new Error('A demonstração nunca roda no banco de produção.');
  await seedCasaBrasa(db);
  await seedDemo(db, new Date());
  console.log('Demonstração Casa Brasa aplicada: equipe, listas e 7 dias de histórico. Não use em produção.');
}
db.close();
