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
| `apps/api` | API Express + SQLite (better-sqlite3) |
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

## Deploy no Fly.io

O repositório já traz `Dockerfile` e `fly.toml`: uma única máquina, com o SQLite num volume em `/data` (o disco da máquina é apagado a cada deploy; o volume, não).

Na tela de deploy do Fly a partir do GitHub:

| Campo | Valor |
|---|---|
| Working directory | `./` |
| Config path | `fly.toml` |
| Região | `gru` (São Paulo), a mesma do `fly.toml` |

Se preferir a linha de comando (`flyctl`):

```bash
fly launch --copy-config --no-deploy   # usa o fly.toml do repositório
fly volumes create rastro_data --region gru --size 1   # se o launch não tiver criado
fly deploy
fly scale count 1   # SQLite: nunca mais de uma máquina
```

Variáveis já definidas no `fly.toml`: `DB_PATH=/data/rastro.db`, `PORT=8080`, `TRUST_PROXY_HOPS=1` (IP real do visitante para o bloqueio de PIN). A checagem de saúde é `GET /api/health`. O Fly tira snapshots diários do volume; mesmo assim, exporte os dados de vez em quando em **Gestor → Exportar e importar**.

Para testar a imagem localmente:

```bash
docker build -t rastro .
docker run --rm -p 8080:8080 -e PORT=8080 -e DB_PATH=/data/rastro.db -v "$PWD/.data:/data" rastro
```

Sem Docker: `npm run build && npm start` (a API serve as telas de `apps/web/dist`).

## Dados em produção

Ao subir, a API (`apps/api/src/main.ts` → `prepareDb`) aplica **apenas dados de domínio** (`apps/api/src/db/seed-domain.ts`):

- o gestor inicial **Rodrigo Cortez**, PIN `2200`;
- a biblioteca de tarefas sugeridas (só as ativas).

Ficam no código, sem passar pelo banco: as funções (Salão, Cozinha, Bar, Limpeza, Gerência), as categorias, as ideias de nome de lista do passo a passo e o nome do restaurante (`apps/web/src/restaurant.ts`).

Nada de equipe, listas, execuções ou histórico: o gestor cadastra tudo aos poucos (o Painel convida para o passo a passo enquanto não houver listas). O seed de domínio pode rodar a cada reinício: ele não duplica nada nem desfaz o que o gestor mudou. Um teste (`apps/api/test/domain-seed.test.ts`) garante isso e que a inicialização nunca usa o seed de demonstração.

> O PIN `2200` está fixo no código, então qualquer pessoa com acesso ao repositório o conhece. Peça ao gestor para trocá-lo em **Equipe → Editar** logo no primeiro acesso; o novo PIN não é sobrescrito ao reiniciar.

## Cópia dos dados

Em **Gestor → Exportar e importar**, o gestor baixa um arquivo `.json` com todos os dados e pode carregá-lo de volta, o que substitui tudo (US19). O arquivo contém os PINs dos gestores: guarde-o com cuidado. Isso não substitui um backup automático do volume onde fica o `rastro.db`.

## PINs de gestor

| Ambiente | Gestor | PIN |
|---|---|---|
| Produção e local | Rodrigo Cortez | `2200` |
| Só na demonstração (`seed:demo`) | Marina Alves | `1234` |

O PIN de gestor também libera cada aparelho novo no primeiro acesso.
