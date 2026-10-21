# Handoff: Rastro — Checklists operacionais para restaurantes

## Overview
Rastro é um sistema web responsivo para gestão e execução de checklists diários de restaurantes (abertura, salão, estoque, limpeza, fechamento). Garante rastreabilidade: toda marcação fica associada a um funcionário identificado, com horário, e alterações (inclusive desmarcações) ficam em histórico auditável.

Dois perfis:
- **Funcionário** — usa no celular ou numa **estação de trabalho compartilhada** (computador fixo). Identifica-se tocando no próprio nome (sem PIN, sem senha). Sessão persiste no aparelho.
- **Gestor** — área restrita (PIN no protótipo) com painel, equipe, itens, checklists e histórico.

Cliente de exemplo nos dados fictícios: restaurante "Casa Brasa".

## About the Design Files
O arquivo deste pacote é uma **referência de design feita em HTML** — um protótipo que mostra aparência e comportamento pretendidos, **não código de produção**. A tarefa é **recriar este design no ambiente do codebase alvo** (React, Vue, etc.) usando seus padrões e bibliotecas. Se ainda não houver codebase, sugere-se React + TypeScript + Tailwind (ou CSS Modules), com backend à escolha (ex.: Postgres + API REST/tRPC).

Para abrir o protótipo: abrir `Checklist Restaurante.dc.html` num navegador (precisa de `support.js` na mesma pasta). Todo o estado é local/fictício; a lógica está na classe `Component` no final do arquivo e serve como especificação executável das regras.

## Fidelity
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos, estados e microinterações são finais para validação com o cliente. Recriar fielmente.

---

## Regras de negócio (obrigatórias)
1. **Responsabilidade individual** — toda conclusão é gravada com `employee_id` + timestamp. Sem funcionário identificado não há marcação.
2. **Checklists gerados automaticamente** por dia conforme periodicidade: `daily`, `weekdays` (dias específicos, multi), `weekly` (um dia), `ondemand` (funcionário inicia manualmente).
3. **Atribuição** por **função/grupo** (Salão, Cozinha, Bar, Limpeza, Gerência) e/ou **pessoas específicas**. A união define quem recebe. Cada funcionário atribuído executa sua própria instância do checklist.
4. **Atraso** — item não concluído após o `horário esperado` do checklist recebe status `late` (vermelho).
5. **Histórico preservado** — registros guardam snapshot dos nomes de checklist e item no momento da execução. Editar configuração não altera dias anteriores (no protótipo: dias −5 a −7 mostram "Abertura do salão", nome antigo).
6. **Desmarcar** é permitido, mas gera evento `undone` no histórico; o evento `done` original nunca é apagado (log append-only).
7. **Itens obrigatórios** bloqueiam "Concluir checklist" enquanto pendentes (mensagem de erro listando quais).
8. **Itens inativos** deixam de aparecer a partir de hoje; funcionários inativos somem da seleção mas mantêm histórico.
9. **Acesso administrativo** apenas para usuários autorizados (função Gerência).

## Modelo de dados sugerido
```
Employee   { id, name, role (cargo livre), group (função), pin?, active, is_admin, color }
Item       { id, name, description, category, required, allow_note, active }
Checklist  { id, name, description, period, days[], due_time (HH:mm|null), roles[], employee_ids[], active }
ChecklistItem { checklist_id, item_id, position }
Execution  { id, date, checklist_id, employee_id, checklist_name_snapshot }      -- instância diária
ExecutionItem { execution_id, item_id, item_name_snapshot, category, due_time, status, done_at, note }
AuditEvent { id, date, time, employee_id, checklist_name, item_name, action: done|undone|note, note }
```
Categorias: Limpeza, Estoque, Organização, Cozinha, Atendimento, Equipamentos.

---

## Screens / Views

### Barra do protótipo (apenas demo, não implementar)
Faixa escura `#1C1F1D` no topo: logo Rastro, alternador Funcionário/Gestor, alternador Celular/Estação, relógio simulado, "Simular reabertura do app", "Reiniciar demo".

### FUNCIONÁRIO — Celular (mobile-first, largura ~400px)

**1. Identificação**
- Logo do restaurante (quadrado 48px, radius 14, `#C2502F`, iniciais brancas Bricolage 700 19px) + nome + subtítulo.
- Título "Quem está trabalhando agora?" (Bricolage 700 28/1.1, letter-spacing −0.02em).
- Grade 2 colunas, gap 10: cartões de funcionário (padding 14, radius 16, borda `#E4DCCD`; hover borda `#1F4D3B` fundo `#F6F9F6`; active scale .97). Avatar 40px círculo com cor do funcionário + iniciais; nome "João S." Geist 600 15; cargo 12 `#6B6A63`.
- **Um toque entra direto** (sem PIN). Sessão salva no dispositivo (localStorage `casabrasa.session` no protótipo).
- Assinatura "com Rastro" no rodapé.

**1b. Retorno com sessão ativa** (ao reabrir o app)
- Tela cheia `#1F4D3B`, avatar 92px, "Bem-vindo de volta, João", botão branco "Continuar como João" (padding 18, radius 16, Geist 700 17), link "Não é o João? Trocar usuário".

**2. Meu dia**
- Data em caixa-alta 12px; "Bom dia, João!" (Bom dia <12h, Boa tarde <18h, Boa noite); "Você possui 12 atividades para hoje."
- **Atalho de troca**: avatar 44px no canto superior direito com rótulo "Trocar ⇄" → abre bottom sheet.
- Cartão de progresso `#1F4D3B`, radius 22: anel SVG 84px (r=34, stroke 9, trilha `#2F6450`, progresso `#F4EFE6`, transição stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)), "8 de 12 tarefas concluídas", chips concluídas/pendentes/atrasadas (`#C2502F`).
- Cartões de checklist (padding 16, radius 18): nome Bricolage 600 18, meta "Até 10:30 · 6 itens", chip de status, barra 8px com `done/total` em Geist Mono. Ordenação: atrasados → em andamento/pendentes (por horário) → concluídos.
- Seção "Quando necessário": checklists sob demanda com botão "Iniciar".
- Estado vazio: borda tracejada `#D3C9B7`, "Nada para hoje".
- Tab bar: Hoje · Atividades · Perfil (indicador barra 22×4 `#1F4D3B`).

**3. Execução do checklist**
- Header sticky: "← Meu dia", pílula "João · Trocar" (atalho de troca), título Bricolage 700 23, "Concluir até 10:30", contador, barra de progresso (cor: `#1F4D3B` normal, `#C2502F` se atrasado, `#2F7D4F` completo).
- Item (radius 16, padding 14): checkbox 34px radius 10 (borda `#BDB4A4`; atrasado `#B3261E`; marcado fundo `#1F4D3B` + check branco). Ao marcar: "pop" scale 1.15 por 220ms com easing cubic-bezier(.3,1.6,.5,1); cartão vira `#F5F9F5` borda `#CFE3D5`; nome fica `#6B6A63`.
- Chips do item: "[avatar] João · 10:12" (responsável + hora), "Atrasado", "Obrigatório", "Desmarcado às 10:52 · registrado no histórico" (âmbar `#FBEFD9`/`#8A5A12`).
- "+ Adicionar observação" (só se item permite) → textarea + Salvar/Cancelar. Observação exibida entre aspas em `#F4EFE6`.
- Banner de sucesso quando 100%; banner de erro se faltar obrigatório.
- Botão fixo inferior "Concluir checklist" (largura total, padding 16, radius 16).
- Toasts: fundo `#1C1F1D`, ponto verde `#6FCF97` (sucesso) ou âmbar `#E0A33A` (aviso), sobem 16px + fade em .3s, somem após 3s.

**Atividades** — lista do dia: hora (Mono) · item · checklist · chip Concluído/Desmarcado/Observação.

**Perfil** — avatar, cargo/função, "Sessão ativa desde 09:31", botão "Trocar usuário" (primário) e "Sair deste aparelho" (texto vermelho).

**Bottom sheet "Quem vai usar agora?"** — overlay rgba(28,31,29,.4), folha radius 26 no topo, grade 2 col de funcionários; o atual aparece destacado "Usando agora". Um toque troca a sessão.

### FUNCIONÁRIO — Estação de trabalho (desktop compartilhado)
Container branco max-width 1440, radius 24.
- **Header**: logo, relógio grande (Bricolage 700 30), data; pílula verde "Marcando como **João Silva**" + botão "Encerrar e trocar". Sempre visível para evitar marcações no nome errado.
- **Sem sessão**: grade `auto-fill minmax(190px,1fr)` de cartões grandes (avatar 72px, nome, cargo, barra de progresso do dia). Um toque entra.
- **Com sessão**: 3 colunas em flex-wrap:
  1. **Equipe** (200px, fundo `#FBF8F2`): "Trocar com um toque" — lista de todos, atual destacado, atrasos em vermelho, progresso `d/t`.
  2. **Meu dia** (280–360px): saudação, cartão de progresso, cartões de checklist (selecionado com borda 2px `#1F4D3B`), últimas 5 marcações.
  3. **Execução** (flex 2, min 340px): mesmo comportamento do celular; itens em grade `auto-fill minmax(300px,1fr)`; botão "Concluir checklist" no header. O primeiro checklist é selecionado automaticamente.

### GESTOR (desktop, responsivo)
- **Acesso restrito**: teclado numérico 3×(72px), PIN de gestor. Erro: "PIN sem permissão de gestor."
- **Layout**: sidebar 232px (Painel [badge com nº de atrasos], Equipe, Itens, Checklists, Histórico; ativo `#E3ECE6`/`#1F4D3B`); usuário no rodapé com "Sair". Abaixo de 900px a sidebar vira barra de pílulas horizontal rolável.

**4. Painel (Dashboard)**
- Filtros: Data (hoje + 7 dias), Funcionário, Categoria, Checklist, Status; "Limpar filtros".
- KPIs (grid auto-fit minmax 150): Tarefas previstas, Concluídas (verde), Pendentes, Atrasadas (fundo `#F9E0DD` quando >0), Conclusão % (fundo `#1F4D3B`). Número Bricolage 700 36.
- "Conclusão por checklist": barra empilhada 10px (concluído `#1F4D3B`, atrasado `#C2502F`, pendente `#E4DCCD`), ordenada do pior ao melhor.
- "Atrasos": lista com avatar, item, funcionário · checklist, "+N min" e "previsto HH:mm"; clique leva à Equipe com o funcionário selecionado.
- "Últimos 8 dias": barras verticais de % (dia selecionado em `#C2502F`).
- "Por categoria": barras horizontais com cor da categoria.
- "Funcionários com pendências": ordenado por atrasos.
- Estado vazio quando filtros não retornam nada.

**5. Equipe**
- Tabela: Funcionário (avatar, nome, cargo, "· Inativo"), Atribuídas, Concluídas, Execução (barra + %), Pendências (+ chip atrasos), Editar.
- Painel de detalhe: "João — Garçom", 3 contadores (atribuídas / concluídas verde / pendentes âmbar), itens agrupados por checklist com hora de conclusão "✓ 10:12" ou "atrasado"/"pendente", observações. Botão Desativar/Reativar.
- Modal Novo/Editar funcionário: nome, cargo, função (chips), PIN 4 dígitos (para gestores). Validações: nome e cargo obrigatórios, PIN numérico único.

**6. Itens**
- Busca + chips de categoria. Tabela: Item (nome + descrição truncada), Categoria (chip com cor), Obrigatório, Observação, Usado em (N checklists, tooltip com nomes), Status (switch 34×20), Editar.
- Modal: Nome* (erro se vazio ou duplicado), Descrição, Categoria (chips), toggles Obrigatório / Permitir observação / Ativo.

**7. Checklists**
- Lista à esquerda (nome, periodicidade · horário · nº itens, responsáveis, Ativo/Inativo).
- Editor: Nome, Descrição, Ativo (switch); Periodicidade (Diariamente / Dias específicos / Semanalmente / Sob demanda) + chips de dia Seg–Dom; "Concluir até" (input time); Responsáveis: chips de Funções + chips de Pessoas, com texto resolvido "Aparecerá no 'Meu dia' de: …".
- **Itens do checklist com arrastar-e-soltar** (HTML5 DnD; linha arrastada opacity .4, alvo borda `#1F4D3B` fundo `#EEF4EF`) + botões ↑ ↓ × como alternativa acessível/touch.
- "Adicionar da biblioteca" com busca (apenas itens ativos e ainda não incluídos).
- Validação ao salvar: nome, ≥1 item, ≥1 responsável, dias quando aplicável, horário (exceto sob demanda). Nota: "As alterações valem a partir de hoje. Registros de dias anteriores não são modificados."

**8. Histórico e auditoria**
- Filtros: busca, data, funcionário, ação (Concluído / Desmarcado / Observação); contador "N registros · M desmarcações".
- Tabela: Data, Hora, Checklist, Item, Responsável (avatar), Status (chip), Observação. Linhas "Desmarcado" com fundo `#FDF6EA`. Paginação "Mostrar mais registros" (40 por vez).

---

## Interactions & Behavior (resumo)
- Marcar item: atualiza status, responsável, hora e progresso imediatamente; registra `done`.
- Desmarcar: volta a pendente/atrasado, mostra chip âmbar, registra `undone`, toast de aviso.
- Salvar observação: registra evento `note`.
- Troca de usuário: limpa checklist aberto; próximas marcações vão para o novo usuário. Toast "Olá, Ana! Para trocar, toque na sua foto."
- Atraso recalculado com o relógio (protótipo atualiza a cada 20s).
- Modais fecham ao clicar no overlay; rolam internamente em telas baixas (max-height calc(100vh − 32px)).

## Responsividade
- Funcionário: mobile-first; estação de trabalho para ≥ ~900px com colunas que quebram em telas menores.
- Gestor: sidebar ≥900px; tabelas com rolagem horizontal (min-width 560–860px); grids `auto-fit minmax(...)`.

## Design Tokens
**Cores**
- Fundo app `#F4EFE6` · Superfície `#FFFDF9` · Superfície alt `#F8F4EC` / `#FBF8F2` · Trilhas `#EFE9DE`
- Borda `#E4DCCD` · Borda tracejada `#D3C9B7` · Check neutro `#BDB4A4`
- Texto `#1C1F1D` · Texto secundário `#6B6A63` · Texto terciário `#3B3D3A`
- Primária (verde) `#1F4D3B` · hover/seleção `#E3ECE6`, `#EEF4EF`, `#F6F9F6` · escuro auxiliar `#2F6450`
- Acento (brasa) `#C2502F`
- Sucesso `#2F7D4F` / fundo `#E1F0E5` / texto `#1F5A38`
- Atraso/erro `#B3261E` / fundo `#F9E0DD` / borda `#EDC2BC` / texto `#8E1F18`
- Aviso `#8A5A12` / fundo `#FBEFD9`
- Info (observação) `#2F6F8F` / fundo `#E2EDF2`
- Barra demo `#1C1F1D`, `#2C302D`, `#B9B3A6`
- Categorias: Limpeza `#2F6F8F`, Estoque `#8A5A12`, Organização `#5B4B8A`, Cozinha `#B2462A`, Atendimento `#1F4D3B`, Equipamentos `#4A5560`

**Tipografia** (Google Fonts)
- Títulos/números: **Bricolage Grotesque** 500–700 (44, 32, 30, 28, 26, 23, 22, 20, 18, 17, 16), letter-spacing −0.01 a −0.02em
- UI/texto: **Geist** 400–700 (17, 16, 15, 14, 13, 12, 11)
- Horários e contadores: **Geist Mono** 500
- Rótulos de seção: 11–12px, 600, uppercase, letter-spacing .06–.08em

**Raios**: 999 (chips), 34 (moldura celular), 26 (sheet), 24 (containers), 22, 20, 18 (cards), 16, 14, 12, 10, 9.
**Espaçamento**: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28.
**Sombras**: moldura celular `0 40px 70px -40px rgba(28,31,29,.45)`; toast `0 14px 30px -12px rgba(0,0,0,.4)`.
**Hit targets**: ≥ 34px (checkbox), botões principais ≥ 44px.

## Assets
Nenhuma imagem. Avatares são círculos com iniciais e cor por funcionário. Ícones são caracteres/SVG inline simples (check, ⋮⋮, ↑ ↓ ×, ⇄). Logo "Rastro" provisório (quadrado com "R"); logo do restaurante provisório (iniciais "CB").

## Fora do escopo do MVP (validar com cliente)
- Diferença entre **"declarado"** (funcionário marcou) e **"verificado"** (gerente validou) — sugerido como evolução: foto obrigatória em itens críticos ou validação do gerente.
- Notificações de atraso, multi-unidade, exportação de relatórios.

## Files
- `Checklist Restaurante.dc.html` — protótipo completo (template + lógica em `class Component`). Dados fictícios em `EMP`, `ITEMS`, `CLS`, `SEED`; regras em `applies()`, `assignees()`, `rowsToday()`, `toggleItem()`, `finishRun()`, `saveCl()`.
- `support.js` — runtime necessário apenas para abrir o protótipo no navegador.
