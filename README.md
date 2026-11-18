# Rastro

> **Este projeto é um playground para testar o uso de IA no desenvolvimento de software.**
>
> O Rastro foi construído com um assistente de IA (Claude Code), a partir de um protótipo feito no Claude Design. O objetivo é experimentar, na prática, como a IA se sai em um ciclo completo de produto: refinar histórias de usuário com critérios de aceite, implementar uma US de cada vez com TDD (casos de sucesso, erro e borda), revisar a interface no navegador e ajustar o produto a partir do feedback.
>
> O histórico do git registra essa evolução: um commit por história (US00 a US19) e os ajustes pedidos ao longo do caminho.

## Contribuições

Contribuições são bem-vindas! Pode abrir uma issue com ideias, dúvidas ou problemas encontrados, ou mandar um pull request. Para manter o espírito do projeto:

- descreva a mudança como uma história de usuário, com critérios de aceite, em [`docs/backlog.md`](docs/backlog.md);
- escreva os testes antes do código, cobrindo casos de sucesso, erro e borda;
- antes de enviar, rode `npm test` e `npm run typecheck`, que devem passar sem erros;
- se usou IA na contribuição, conte como foi no pull request: o que funcionou bem e o que precisou de correção.

Checklists operacionais para restaurantes, com rastreabilidade de cada marcação.

- Backlog e critérios de aceite: [`docs/backlog.md`](docs/backlog.md)
- Referência de design: `PrototipoChecklistRestaurante/design_handoff_rastro/`

## Estrutura

| Pacote | Conteúdo |
|---|---|
| `packages/domain` | Regras de negócio puras (sem I/O) |
| `apps/api` | API Express + SQLite (libSQL: arquivo local ou Turso) |
| `apps/web` | React + Vite |

## Comandos

```bash
npm install
npm test          # testes de todos os pacotes
npm run typecheck
npm run dev       # API em :3333 e web em :5173 (proxy /api)
npm run build     # gera as telas em apps/web/dist
npm start         # produção: telas e API servidas juntas, numa porta só
npm run seed      # só dados de domínio em apps/api/rastro.db (o mesmo que a API faz ao subir)
npm run seed:demo # domínio + restaurante fictício Casa Brasa + 7 dias de histórico (só local, nunca em produção)
```

## Endereços

| Caminho | Uso |
|---|---|
| `/` | Funcionário: layout mobile no celular, layout de estação no computador |
| `/estacao` | Força a estação de trabalho em qualquer aparelho |
| `/gestor` | Painel do gestor |

## Deploy na Vercel

Produção roda na Vercel, com o banco no [Turso](https://turso.tech) (SQLite hospedado). A Vercel não tem disco persistente, por isso o banco fica fora dela; o SQL é o mesmo do SQLite local.

`npm run build:vercel` gera `.vercel/output` ([Build Output API](https://vercel.com/docs/build-output-api/v3)): as telas do Vite como arquivos estáticos e a API inteira como uma única função Node (`apps/api/src/vercel.ts`, empacotada com esbuild, usando o cliente HTTP do Turso, sem binário nativo). As rotas: `/api/*` vai para a função; caminhos sem extensão abrem o app.

### 1. Banco no Turso

```bash
turso db create rastro --location <região>   # perto da região das funções na Vercel
turso db show rastro --url                   # → TURSO_DATABASE_URL (libsql://…)
turso db tokens create rastro                # → TURSO_AUTH_TOKEN
```

Também dá para criar pela integração do Turso no Marketplace da Vercel, que já preenche as variáveis. O esquema e o gestor inicial são criados sozinhos na primeira requisição.

### 2. Projeto na Vercel

Importe o repositório. O `vercel.json` já define a instalação (`npm ci`) e o build (`npm run build:vercel`); deixe *Framework Preset* em **Other** e *Root Directory* em `./`.

| Variável de ambiente | Valor |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://rastro-<conta>.turso.io` |
| `TURSO_AUTH_TOKEN` | token do passo 1 |

As funções rodam em São Paulo (`gru1`, em `vercel.json` e `scripts/build-vercel.mjs`), a mesma região do banco no Turso (`aws-sa-east-1`). Se mudar o banco de lugar, mude também a região das funções: cada requisição faz algumas consultas, e a distância entre função e banco pesa mais do que a distância até o usuário.

### Limites a conhecer

- **Importação de dados:** a Vercel aceita no máximo 4,5 MB por requisição. Arquivos de exportação maiores que isso não sobem pela tela.
- **Bloqueio de PIN:** as 5 tentativas erradas são contadas por instância da função, e não no banco. Com várias instâncias ativas, o limite fica mais frouxo.
- **Polling:** as telas recarregam a cada 30 s. A sincronização do dia só escreve no banco quando algo muda; um teste garante que consultas repetidas não escrevem nada.

### Local

Sem `TURSO_DATABASE_URL`, a API usa um arquivo SQLite local (`DB_PATH`, padrão `rastro.db`). `npm run build && npm start` serve telas e API juntas, como antes. Para apontar o ambiente local para o Turso, defina as duas variáveis. `npm run seed:demo` se recusa a rodar num banco `libsql://`.

## Dados em produção

Ao subir (localmente, `apps/api/src/main.ts`; na Vercel, na primeira requisição de cada instância, `apps/api/src/vercel.ts`), a API (`prepareDb`) aplica **apenas dados de domínio** (`apps/api/src/db/seed-domain.ts`):

- o gestor inicial **Rodrigo Cortez**, PIN `2200`;
- a biblioteca de tarefas sugeridas (só as ativas).

Ficam no código, sem passar pelo banco: as funções (Salão, Cozinha, Bar, Limpeza, Gerência), as categorias, as ideias de nome de lista do passo a passo e o nome do restaurante (`apps/web/src/restaurant.ts`).

Nada de equipe, listas, execuções ou histórico: o gestor cadastra tudo aos poucos (o Painel convida para o passo a passo enquanto não houver listas). O seed de domínio pode rodar a cada reinício: ele não duplica nada nem desfaz o que o gestor mudou. Um teste (`apps/api/test/domain-seed.test.ts`) garante isso e que a inicialização nunca usa o seed de demonstração.

> O PIN `2200` está fixo no código, então qualquer pessoa com acesso ao repositório o conhece. Peça ao gestor para trocá-lo em **Equipe → Editar** logo no primeiro acesso; o novo PIN não é sobrescrito ao reiniciar.

## Cópia dos dados

Em **Gestor → Exportar e importar**, o gestor baixa um arquivo `.json` com todos os dados e pode carregá-lo de volta, o que substitui tudo (US19). O arquivo contém os PINs dos gestores: guarde-o com cuidado. Isso não substitui o backup do banco: o Turso guarda o histórico e permite restaurar a um ponto no tempo, conforme o plano.

## PINs de gestor

| Ambiente | Gestor | PIN |
|---|---|---|
| Produção e local | Rodrigo Cortez | `2200` |
| Só na demonstração (`seed:demo`) | Marina Alves | `1234` |

O PIN de gestor também libera cada aparelho novo no primeiro acesso.
