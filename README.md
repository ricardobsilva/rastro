# Rastro

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
npm run seed      # aplica o seed Casa Brasa em apps/api/rastro.db
```
