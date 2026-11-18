// Gera .vercel/output (Build Output API v3): telas do Vite como estático + a API como uma função Node.
// A função é um único arquivo empacotado; o cliente do Turso usa a versão HTTP (sem binário nativo).
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const out = '.vercel/output';
const fn = `${out}/functions/api.func`;
rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

cpSync('apps/web/dist', `${out}/static`, { recursive: true });

await build({
  entryPoints: ['apps/api/src/vercel.ts'],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  alias: { '@libsql/client': '@libsql/client/web' },
  // Express é CommonJS: dentro de um bundle ESM ele precisa de um `require` de verdade.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'warning',
});

writeFileSync(`${fn}/.vc-config.json`, JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  // Mesma região do banco no Turso (aws-sa-east-1): cada requisição faz algumas consultas.
  regions: ['gru1'],
}, null, 2));

writeFileSync(`${out}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    { handle: 'filesystem' },
    { src: '^/api(?:/.*)?$', dest: '/api' },
    // Caminhos sem extensão (/, /estacao, /gestor…) abrem o app; o React escolhe a tela.
    { src: '^/[^.]*$', dest: '/index.html' },
  ],
}, null, 2));

console.log(`Saída da Vercel gerada em ${out}`);
