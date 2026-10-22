# Rastro

> **Este projeto é um playground para testar o uso de IA no desenvolvimento de software.**
>
> O Rastro foi construído com um assistente de IA (Claude Code), a partir de um protótipo feito no Claude Design. O objetivo é experimentar, na prática, como a IA se sai em um ciclo completo de produto: refinar histórias de usuário com critérios de aceite, implementar uma US de cada vez com TDD (casos de sucesso, erro e borda), revisar a interface no navegador e ajustar o produto a partir do feedback.
>
> O histórico do git registra essa evolução: um commit por história (US00 a US19) e os ajustes pedidos ao longo do caminho.

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
npm run seed      # só dados de domínio em apps/api/rastro.db (o mesmo que a API faz ao subir)
npm run seed:demo # domínio + restaurante fictício Casa Brasa + 7 dias de histórico (só local, nunca em produção)
```

## Endereços

| Caminho | Uso |
|---|---|
| `/` | Funcionário: layout mobile no celular, layout de estação no computador |
| `/estacao` | Força a estação de trabalho em qualquer aparelho |
| `/gestor` | Painel do gestor |

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
