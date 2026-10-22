# Rastro — Backlog refinado (MVP)

Fonte: `PrototipoChecklistRestaurante/design_handoff_rastro` (README + lógica `class Component` do protótipo).
Restaurante: **Zé Frôxin**. Produção sobe só com dados de domínio (gestor inicial Rodrigo Cortez e biblioteca de tarefas); equipe e listas são cadastradas pelo gestor. Dados fictícios de teste e demonstração local: **Casa Brasa**. Idioma da UI: pt-BR. Fuso: `America/Sao_Paulo`.

## Convenções

- **Definition of Ready**: história com critérios de aceite, regras e cenários de teste aprovados aqui.
- **Definition of Done**
  1. Testes escritos antes (TDD) cobrindo **sucesso, erro e borda** — domínio, API e UI.
  2. `npm test` verde e `npm run typecheck` sem erros.
  3. Fidelidade visual com o protótipo (tokens, tipografia, estados).
  4. Demonstrado e **aceito pelo PO (Ricardo)** — só então a próxima US começa.
- Cada US é uma fatia vertical (domínio → API → tela), exceto o habilitador US00.
- "Hoje" e "atrasado" são sempre calculados **no servidor**, com o fuso do restaurante e o dia operacional (virada às 04:00).

## Decisões do PO (21/10/2026)

| Tema | Decisão |
|---|---|
| Segurança do aparelho | Gestor autoriza cada aparelho com o PIN uma vez (US01); funcionário entra só com um toque |
| Dia operacional | Vira às **04:00**: marcação às 00:20 conta para o dia anterior |
| Sessão do funcionário | Fica ativa até "Trocar" ou "Sair deste aparelho" (como no protótipo) |
| PIN | Só para gestores (função Gerência) |
| Versionamento | git local, um commit por US aceita |

## Glossário

| Termo | Significado |
|---|---|
| Função (grupo) | Salão, Cozinha, Bar, Limpeza, Gerência |
| Cargo | Texto livre (Garçom, Cozinheiro…) |
| Instância | Execução de um checklist por **um** funcionário em **um** dia |
| Evento | Registro append-only de auditoria: `done`, `undone`, `note` |
| Atrasado | Item não concluído com `agora > horário esperado` do checklist |

---

## US00 — Fundação (habilitador técnico)

Monorepo TS (npm workspaces): `packages/domain` (regras puras), `apps/api` (Express + SQLite/Drizzle), `apps/web` (React + Vite).
Tokens de design, fontes (Bricolage Grotesque, Geist, Geist Mono), seed Casa Brasa, relógio injetável (para testes de horário).

**Aceite**: `npm test` roda testes dos 3 pacotes; `npm run dev` sobe API + web; `GET /api/health` → 200.
**Testes**: health 200 (sucesso); rota inexistente → 404 JSON (erro); seed idempotente — rodar 2× não duplica (borda).

---

## US01 — Autorizar aparelho

**Como** gestor, **quero** liberar cada celular ou estação com meu PIN uma única vez, **para** que só aparelhos do restaurante consigam registrar marcações.

**Aceite**
- Aparelho não autorizado abre a tela "Liberar este aparelho" com teclado numérico de PIN do gestor.
- PIN válido → o aparelho recebe um token de dispositivo (cookie httpOnly, sem expiração) e segue para "Quem está trabalhando agora?".
- Erro: "PIN sem permissão de gestor."

**Regras**
- Todas as rotas de funcionário exigem dispositivo autorizado.
- Token aleatório (≥ 32 bytes), guardado no banco só como hash.
- O registro do aparelho guarda quem autorizou e quando.
- Revogação de aparelhos fica fora do MVP. Se for preciso, entra como US própria.

**Testes**
- Sucesso: PIN de gestor ativo → 201 + cookie; rota de funcionário com cookie → 200.
- Erro: PIN de não-gestor → 401; rotas de funcionário sem cookie ou com token desconhecido → 401.
- Borda: PIN malformado → 422; o gestor que autorizou é desativado depois → o aparelho continua autorizado; 5 tentativas erradas → 429.

---

## US02 — Identificação do funcionário

**Como** funcionário, **quero** tocar no meu nome para entrar, **para** que minhas marcações fiquem no meu nome sem precisar de senha.

**Aceite**
- Tela "Quem está trabalhando agora?" lista só funcionários **ativos**, grade 2 col, avatar (iniciais + cor), "João S.", cargo.
- Um toque cria a sessão e leva ao "Meu dia" com toast "Olá, João! Para trocar, toque na sua foto."
- A sessão persiste no aparelho; ao reabrir o app mostra "Bem-vindo de volta, João" com "Continuar como João" e "Não é o João? Trocar usuário".
- Perfil → "Sair deste aparelho" encerra a sessão e volta para a identificação.

**Regras**: funcionário inativo nunca pode abrir sessão (inclusive sessão antiga salva → volta para a identificação).

**Testes**
- Sucesso: lista ativos; login retorna sessão; resume com sessão válida.
- Erro: login com id inexistente → 404; com funcionário inativo → 403; chamada sem sessão às rotas de funcionário → 401.
- Borda: sessão salva de um funcionário desativado depois → tratada como sem sessão; nome com 1 palavra ("Rafa") → iniciais "R", rótulo "Rafa"; nomes com espaços extras.

---

## US03 — Meu dia (geração automática)

**Como** funcionário, **quero** ver os checklists que são meus hoje, **para** saber o que fazer e o que está atrasado.

**Aceite**
- Cabeçalho: data por extenso em caixa-alta, saudação (Bom dia < 12h, Boa tarde < 18h, Boa noite), "Você possui N atividades para hoje."
- Cartão de progresso com anel (concluídas / total), chips concluídas, pendentes, atrasadas.
- Cartões por checklist: nome, "Até 10:30 · 6 itens", chip de status (Pendente, Em andamento, Atrasado, Concluído), barra `done/total`.
- Ordenação: atrasados → pendentes/em andamento (por horário) → concluídos.
- Estado vazio "Nada para hoje".

**Regras**
- O checklist aparece hoje se ativo e: `daily`; `weekdays` com o dia da semana incluído; `weekly` com o dia definido. `ondemand` não aparece aqui (US07).
- Destinatários = funcionários ativos da **união** de funções + pessoas. Cada um tem a sua instância.
- Só itens ativos entram.
- Status do item: `done` | `late` (agora > prazo e não concluído) | `pending`. Status do cartão: tudo concluído → Concluído; algum atrasado → Atrasado; algum concluído → Em andamento; senão Pendente.

**Testes**
- Sucesso: João (Salão) recebe "Abertura do restaurante" e "Organização do salão"; Beatriz recebe "Abertura da cozinha" por atribuição pessoal.
- Erro: sem sessão → 401.
- Borda: checklist com função **e** pessoa da mesma função → uma instância só; `weekly` no dia certo × errado; checklist inativo; item inativo some; checklist cujos itens estão todos inativos não aparece; virada de 11:59→12:00 e 17:59→18:00 na saudação; item exatamente no horário limite **não** está atrasado (só depois).

---

## US04 — Marcar e desmarcar itens (execução)

**Como** funcionário, **quero** marcar itens do checklist, **para** registrar que fiz cada tarefa com meu nome e horário.

**Aceite**
- Tela de execução: header sticky ("← Meu dia", pílula "João · Trocar", título, "Concluir até 10:30", contador, barra com cor normal, atrasado ou completo).
- Marcar: checkbox com animação "pop", cartão verde-claro, chip "[avatar] João · 10:12".
- Desmarcar: volta a pendente/atrasado, chip âmbar "Desmarcado às 10:52 · registrado no histórico", toast de aviso.
- Itens atrasados com borda e chip "Atrasado"; obrigatórios com chip "Obrigatório".

**Regras**
- Toda marcação grava `employee_id` + horário do **servidor** (rejeita marcação sem sessão).
- Cada ação gera evento append-only (`done` / `undone`). Nada é apagado.
- Snapshot dos nomes do checklist e do item no momento do registro.
- Só o dono da instância pode marcar os itens dela.

**Testes**
- Sucesso: marcar → `done` + evento; desmarcar → `pending` + evento `undone`, e o `done` original continua no log.
- Erro: marcar instância de outro funcionário → 403; item que não pertence ao checklist → 404; sem sessão → 401.
- Borda: marcar → desmarcar → marcar gera 3 eventos; desmarcar depois do prazo volta como `late`; requisição duplicada de "marcar" (duplo clique) não cria dois `done` seguidos (idempotente).

---

## US05 — Observações nos itens

**Como** funcionário, **quero** anotar uma observação em itens que permitem, **para** registrar detalhes (ex.: temperatura).

**Aceite**: "+ Adicionar observação" só em itens com `allow_note`; textarea + Salvar/Cancelar; observação exibida entre aspas; botão vira "Editar observação"; toast "Observação salva."

**Regras**: salvar gera evento `note`; pode haver observação em item ainda não marcado; texto aparado (trim).

**Testes**
- Sucesso: salvar cria evento `note` e mostra no item.
- Erro: item sem `allow_note` → 422; texto acima de 500 caracteres → 422.
- Borda: salvar vazio ou só espaços → não gera evento e limpa a observação; editar substitui o texto e gera novo evento; cancelar não altera nada.

---

## US06 — Concluir checklist

**Como** funcionário, **quero** concluir o checklist, **para** fechar minha parte; obrigatórios não podem ficar para trás.

**Aceite**
- Botão fixo "Concluir checklist".
- Com obrigatório pendente: banner de erro "Faltam 2 itens obrigatórios: X, Y." e não sai da tela.
- Sem obrigatório pendente e com opcionais pendentes: volta ao Meu dia com toast de aviso "Checklist salvo. 1 item continua pendente."
- 100%: banner de sucesso; botão vira "Voltar para Meu dia"; toast "Checklist concluído! Tudo registrado em seu nome."

**Testes**
- Sucesso: tudo feito → concluído.
- Erro: obrigatório pendente → 422 com a lista de nomes.
- Borda: singular × plural das mensagens; checklist sem nenhum obrigatório; obrigatório desmarcado depois de concluído volta a bloquear.

---

## US07 — Checklists sob demanda

**Como** funcionário, **quero** iniciar um checklist "quando necessário" (ex.: recebimento de compras), **para** registrar tarefas que não têm dia fixo.

**Aceite**: seção "Quando necessário" com nome, "N itens · descrição" e botão "Iniciar"; ao iniciar abre a execução e o cartão passa a aparecer no Meu dia e some da seção.

**Regras**: uma instância por funcionário por dia; sem prazo, portanto nunca fica atrasado.

**Testes**
- Sucesso: iniciar cria a instância do dia.
- Erro: iniciar checklist que não é sob demanda → 422; de que não sou responsável → 403.
- Borda: iniciar 2× no mesmo dia → retorna a mesma instância; no dia seguinte volta a aparecer em "Quando necessário".

---

## US08 — Atividades e Perfil

**Como** funcionário, **quero** ver o que fiz hoje e meus dados de sessão.

**Aceite**
- Tab bar Hoje · Atividades · Perfil.
- Atividades: lista do dia (hora mono · item · checklist · chip Concluído/Desmarcado/Observação), mais recente primeiro; vazio com mensagem.
- Perfil: avatar, cargo/função, "Sessão ativa desde 09:31", "Trocar usuário", "Sair deste aparelho".

**Testes**
- Sucesso: só os eventos do próprio funcionário e de hoje.
- Erro: sem sessão → 401.
- Borda: eventos de outros dias não aparecem; empate de horário ordena pela ordem de criação.

---

## US09 — Troca rápida de usuário

**Como** equipe que divide um aparelho, **queremos** trocar de pessoa com um toque, **para** que cada um marque no próprio nome.

**Aceite**: avatar com "Trocar ⇄" no Meu dia e pílula "João · Trocar" na execução abrem o bottom sheet "Quem vai usar agora?"; o atual aparece destacado "Usando agora"; um toque troca; tocar no atual só fecha.

**Regras**: a troca fecha o checklist aberto; marcações seguintes vão para o novo usuário.

**Testes**
- Sucesso: depois da troca, a marcação é gravada com o novo `employee_id`.
- Erro: trocar para funcionário inativo → 403.
- Borda: overlay fecha o sheet; trocar para si mesmo não gera novo login nem toast.

---

## US10 — Modo estação de trabalho

**Como** restaurante com um computador fixo, **queremos** uma tela larga para a equipe marcar sem confusão de nome.

**Aceite**
- Header com relógio grande, data, pílula verde "Marcando como **João Silva**" + "Encerrar e trocar".
- Sem sessão: grade de cartões grandes com progresso do dia por pessoa.
- Com sessão, 3 colunas: Equipe (atual destacado, atrasos em vermelho, `d/t`), Meu dia (cartão selecionado com borda) com as últimas 5 marcações, e Execução (itens em grade, "Concluir checklist" no header). O primeiro checklist já vem selecionado.

**Regras**: o endereço `/` escolhe o layout pelo aparelho: celular (user agent móvel ou tela de toque até 820px) abre o layout mobile; computador abre sempre o layout de estação, mesmo com a janela estreita. `/estacao` força a estação em qualquer aparelho.

**Testes**
- Sucesso: escolher pessoa na coluna Equipe troca a sessão e reseleciona o checklist.
- Erro: endpoint de progresso da equipe sem dispositivo autorizado → 401.
- Borda: pessoa sem tarefas mostra "—"; colunas quebram abaixo de 900px.

---

## US11 — Acesso do gestor

**Como** gestor, **quero** entrar na área administrativa com meu PIN, **para** que só a gerência altere configurações.

**Aceite**: teclado numérico 3×4, 4 bolinhas, erro "PIN sem permissão de gestor.", toast "Acesso liberado · Marina Alves"; layout com sidebar (Painel com badge de atrasos, Equipe, Itens, Checklists, Histórico), "Sair" (encerra a sessão de gestor e volta para a tela inicial `/`, mesmo se o servidor falhar); abaixo de 900px a sidebar vira pílulas. A tela inicial (celular e estação, sem ninguém marcando) tem o botão "Entrar como gestor", que pede o PIN num modal e abre `/gestor`; cancelar fecha sem chamar a API.

**Regras**: apenas funcionários **ativos** da função Gerência; todas as rotas `/api/admin/*` exigem sessão de gestor.

**Testes**
- Sucesso: PIN de gestor ativo → sessão admin.
- Erro: PIN de não-gestor ou inexistente → 401 com a mesma mensagem; gestor inativo → 401; rotas admin sem sessão → 401.
- Borda: PIN com menos de 4 dígitos ou não numérico → 422; 5 tentativas erradas → bloqueio temporário (429).

---

## US12 — Cadastro de itens

**Como** gestor, **quero** manter a biblioteca de itens, **para** montar checklists.

**Aceite**: busca + chips de categoria; tabela (Item + descrição truncada, Categoria colorida, Obrigatório, Observação, "Usado em N checklists" com tooltip dos nomes, switch de status, Editar); modal com Nome*, Descrição, Categoria, toggles Obrigatório / Permitir observação / Ativo.

**Regras**: nome obrigatório e único (sem diferenciar maiúsculas e minúsculas, com trim); desativar faz o item sumir das instâncias de hoje **ainda não concluídas** em diante; o histórico fica intacto.

**Testes**
- Sucesso: criar, editar, desativar, reativar.
- Erro: nome vazio → "Informe o nome do item."; duplicado ("conferir TALHERES ") → "Já existe um item com esse nome."; categoria inválida → 422.
- Borda: editar mantendo o próprio nome não acusa duplicidade; busca sem resultado mostra estado vazio; desativar item já concluído hoje mantém o registro.

---

## US13 — Cadastro de funcionários

**Como** gestor, **quero** cadastrar, editar e desativar funcionários.

**Aceite**: botão "Novo funcionário"; modal com nome, cargo, função (chips) e PIN (só para Gerência); "Desativar/Reativar" no detalhe; toast "… foi desativado. O histórico dele continua disponível."

**Regras**: nome e cargo obrigatórios; PIN de 4 dígitos, numérico e único; `is_admin` = função Gerência; cor do avatar atribuída automaticamente; não é possível desativar o **último gestor ativo**.

**Testes**
- Sucesso: criar, editar e desativar (some da identificação, histórico preservado).
- Erro: sem nome ou cargo → "Preencha nome e cargo."; PIN "12a4" → "O PIN deve ter 4 números."; PIN repetido → "Esse PIN já está em uso."
- Borda: rebaixar o último gestor → 422; gestor desativando a si mesmo; funcionário reativado volta a receber checklists de hoje.

---

## US14 — Cadastro de checklists

**Como** gestor, **quero** criar e editar checklists com periodicidade, prazo, responsáveis e itens ordenados.

**Aceite**
- Lista à esquerda (nome, "Todos os dias · até 10:30 · 6 itens", responsáveis, Ativo/Inativo).
- Editor: Nome, Descrição, switch Ativo; Periodicidade + chips Seg–Dom; "Concluir até"; Responsáveis (chips de Funções e de Pessoas) com o texto "Aparecerá no 'Meu dia' de: …".
- Itens com arrastar-e-soltar + ↑ ↓ ×; "Adicionar da biblioteca" com busca (só itens ativos e ainda não incluídos).
- Nota: "As alterações valem a partir de hoje. Registros de dias anteriores não são modificados."

**Regras**
- Validação, nesta ordem: nome; ≥ 1 item; ≥ 1 responsável; dias (weekdays/weekly); horário (exceto sob demanda).
- `weekly` aceita exatamente 1 dia; ao trocar para weekly, mantém só o primeiro dia escolhido.
- Edição afeta hoje e o futuro; itens já concluídos hoje são mantidos; dias anteriores ficam intactos (snapshot).

**Testes**
- Sucesso: criar daily e weekdays; reordenar itens; editar o nome e conferir que o histórico mantém o nome antigo.
- Erro: cada validação com a mensagem exata do protótipo; item inexistente ou inativo → 422.
- Borda: item repetido na lista → 422; weekly com 2 dias → 422; mover o primeiro para cima ou o último para baixo é ignorado; remover responsáveis faz a instância de hoje sumir sem apagar eventos.

---

## US15 — Painel do gestor

**Como** gestor, **quero** ver o andamento do dia e dos últimos dias, **para** agir sobre atrasos.

**Aceite**
- Filtros: Data (hoje + 7 dias), Funcionário, Categoria, Checklist, Status; "Limpar filtros" (mantém a data).
- KPIs: Previstas, Concluídas, Pendentes, Atrasadas (destaque se > 0), Conclusão %.
- Gráficos:
  - Conclusão por checklist: barra empilhada, do pior ao melhor.
  - Atrasos: até 6, com "+N min" hoje ou "não feito" em dias anteriores, e clique leva à Equipe.
  - Últimos 8 dias: dia selecionado em brasa.
  - Por categoria.
  - Funcionários com pendências: ordenados por atrasos e depois pendências.
- Estado vazio para filtros sem resultado.

**Regras**: dias anteriores usam os registros congelados (snapshot); item não feito num dia passado conta como atrasado ("não feito").

**Testes**
- Sucesso: KPIs batem com o seed.
- Erro: data fora da janela ou inválida → 422; filtro com id inexistente → retorno vazio (não 500).
- Borda: total 0 → 0% sem divisão por zero; o filtro de status não afeta a tendência de 8 dias; a mudança de nome de checklist aparece com o nome antigo nos dias anteriores.

---

## US16 — Equipe (acompanhamento)

**Como** gestor, **quero** ver a execução por funcionário.

**Aceite**: tabela (Funcionário com "· Inativo", Atribuídas, Concluídas, Execução %, Pendências + chip de atrasos, Editar); detalhe com 3 contadores e itens agrupados por checklist ("✓ 10:12", "atrasado", "pendente") e observações; usa a data do filtro do painel.

**Testes**
- Sucesso: contadores do João conferem.
- Erro: funcionário inexistente → 404.
- Borda: funcionário sem tarefas mostra "—" e estado vazio; inativos vão para o fim da lista com opacidade.

---

## US17 — Histórico e auditoria

**Como** gestor, **quero** consultar todas as ações, **para** auditar quem fez o quê e quando.

**Aceite**: filtros (busca por item/checklist, data, funcionário, ação); contador "N registros · M desmarcações"; tabela Data ("Hoje" ou dd/mm), Hora, Checklist, Item, Responsável, Status, Observação; linhas desmarcadas destacadas; "Mostrar mais registros" (40 por vez).

**Regras**: somente leitura; não existe endpoint para alterar ou apagar eventos; ordenação data desc → hora desc → criação desc.

**Testes**
- Sucesso: paginação 40 + 40; filtros combinados.
- Erro: ação inválida no filtro → 422.
- Borda: busca sem diferenciar maiúsculas e minúsculas nem acentos ("cafe" encontra "café"); exatamente 40 registros não mostra "Mostrar mais"; eventos de funcionário inativo continuam listados.

---

## US18 — Assistente do primeiro checklist (passo a passo)

**Como** gestor pouco acostumado com tecnologia, **quero** criar uma lista de tarefas respondendo uma pergunta por vez, em linguagem simples, **para** colocar o restaurante para funcionar sem precisar entender a tela completa de checklists.

**Aceite**
- Entrada: item "Passo a passo" no menu do gestor, botão "Criar com ajuda" na página Checklists e, no Painel, um convite em destaque enquanto não houver nenhum checklist.
- Uma pergunta por tela, com "Passo N de 7", letras grandes, botões altos (≥ 56 px), "Voltar" sempre visível e sem arrastar-e-soltar. A palavra "checklist" aparece só uma vez ("lista de tarefas (checklist)").
  1. **Boas-vindas**: o que vai acontecer e quanto tempo leva (uns 3 minutos); botão "Começar".
  2. **Nome**: "Como vai se chamar esta lista?". Até 4 sugestões em botões, tiradas de uma lista de ideias comuns (Abertura do restaurante, Limpeza dos banheiros, Fechamento do bar…) sem as que já existem como lista, e campo livre. Se todas as ideias já existirem, o texto pede só para escrever o nome.
  3. **Tarefas**: "O que precisa ser feito?". Escrever e tocar "Adicionar" (ou Enter); cada tarefa aparece numerada com "Tirar". As tarefas já cadastradas aparecem como sugestões de um toque.
  4. **Equipe**: "Quem trabalha com você?". Mostra a equipe ativa por função e permite adicionar pessoas novas com só duas respostas: nome e função (botões Salão, Cozinha, Bar, Limpeza). Cada pessoa nova aparece com a marca "nova" e o botão "Tirar". Dá para seguir sem adicionar ninguém. Gestores não são cadastrados aqui: o assistente indica a página Equipe, porque gestor precisa de PIN.
  5. **Quem**: "Quem vai fazer?". Um botão grande por função, com os nomes das pessoas embaixo ("João, Ana"). As pessoas novas já aparecem embaixo da função delas. Funções sem ninguém, nem ativo nem novo, ficam desabilitadas com "Ninguém nesta função".
  6. **Quando**: "Em quais dias?". Três opções: "Todos os dias", "Só em alguns dias" (abre botões Seg–Dom) e "Só quando alguém pedir".
  7. **Horário**: "Até que horas precisa estar pronto?". Horários comuns em botões e "Outro horário". Este passo é pulado quando a lista é "Só quando alguém pedir".
  8. **Conferir**: um resumo em frase, incluindo "Pessoas novas na equipe: Pedro (Bar)", ("A lista **Abertura** tem 3 tarefas. Quem faz: Salão (João, Ana). Quando: todos os dias, até 10:30."), com "Mudar" em cada parte e o botão "Criar a lista".
  9. **Pronto**: diz quem vai ver a lista e quando. Botões "Ver minhas listas" e "Criar outra lista".
- Os erros aparecem em português simples ao lado da pergunta, e o assistente não avança sem resposta. Se o servidor falhar ao criar, o assistente continua no passo de conferência, com a mensagem, sem perder nada.

**Regras**
- `POST /api/admin/checklists/guided` cria tudo numa transação (pessoas novas, tarefas novas e a lista): se algo falhar, nada fica salvo.
- Pessoas novas (`newEmployees: [{ name, group }]`) entram ativas, com o nome da função como cargo e a próxima cor da paleta. Nome com 1 a 80 caracteres; no máximo 30 por vez; função Gerência → 422; nome repetido na lista ou igual ao de alguém ativo (sem diferenciar maiúsculas) → 409.
- Uma tarefa com o mesmo nome de um item existente (sem diferenciar maiúsculas, minúsculas nem espaços nas pontas) reaproveita esse item, e um item inativo volta a ficar ativo. Tarefas novas viram itens da categoria Organização, não obrigatórios e com observação permitida, ajustáveis depois em Itens.
- Tarefas repetidas na lista contam uma vez; tarefas em branco são ignoradas; no máximo 30 tarefas, cada uma com até 120 caracteres.
- "Só em alguns dias" usa a periodicidade de dias específicos. As demais validações são as mesmas da US14.
- Já existir uma lista com o mesmo nome (sem diferenciar maiúsculas) retorna 409.

**Testes**
- Sucesso: cria lista diária com tarefas novas, que aparece hoje para o Salão na ordem escrita; reaproveita um item existente pelo nome; dias específicos; sob demanda sem horário. Na tela, o fluxo completo envia os dados certos e mostra "Pronto".
- Erro: sem tarefas → 422; função inválida → 422 e nenhuma tarefa nem pessoa nova fica salva; pessoa nova como gestor → 422; pessoa já na equipe → 409; adicionar pessoa sem nome ou sem função mostra a mensagem; nome repetido → 409; sem sessão de gestor → 401; avançar sem responder mostra a mensagem; falha do servidor mantém o resumo.
- Borda: pessoa nova habilita uma função que estava vazia; tirar a única pessoa de uma função já escolhida desmarca essa função; seguir sem adicionar ninguém; tarefas repetidas e em branco; tarefa com mais de 120 caracteres → 422; item inativo reativado; função sem ninguém desabilitada; "Só quando alguém pedir" pula o horário; "Voltar" preserva as respostas.

---

## US19 — Exportar e importar dados

**Como** gestor, **quero** baixar um arquivo com todos os dados e poder carregá-lo de volta, **para** ter uma cópia de segurança e conseguir restaurar o restaurante (por exemplo, numa troca de servidor).

**Aceite**
- Página "Exportar e importar" no menu do gestor.
- "Exportar dados" baixa `rastro-dados-AAAA-MM-DD.json` (data do dia operacional), com o aviso de que o arquivo contém os PINs dos gestores.
- "Escolher arquivo de dados" lê o arquivo e, antes de mudar qualquer coisa, mostra a data da exportação e os totais (funcionários, tarefas, listas, registros no histórico), com o aviso em vermelho de que todos os dados atuais serão apagados. Os botões são "Cancelar" e "Substituir todos os dados".
- Ao terminar, mostra "Dados importados" e o botão "Entrar de novo".

**Regras**
- `GET /api/admin/export` e `POST /api/admin/import` exigem sessão de gestor; a importação aceita arquivos de até 50 MB, lidos só depois de conferir a sessão.
- O arquivo traz `format: "rastro-export"`, `version: 1`, `exportedAt` e as tabelas de dados com as linhas exatamente como estão no banco: funcionários, itens, listas e seus vínculos, execuções, itens das execuções e o log de auditoria.
- Aparelhos e sessões não são exportados. Ao importar, são apagados: todos entram de novo com o PIN.
- A importação substitui tudo numa transação: se algo falhar, os dados atuais ficam intactos. Colunas desconhecidas são ignoradas.
- É recusado (422) arquivo que não é do Rastro, de versão mais nova, incompleto ou corrompido, ou sem nenhum gestor ativo com PIN (ninguém conseguiria entrar).

**Testes**
- Sucesso: ida e volta (exportar → importar num banco novo → exportar de novo) dá tabelas idênticas; banco de produção vazio também exporta; resumo, confirmação e "Entrar de novo" na tela.
- Erro: sem sessão → 401; arquivo de outro sistema, de versão mais nova, corrompido ou sem gestor → 422 sem mudar nada; falha do servidor mantém o resumo com a mensagem.
- Borda: arquivo acima de 100 kB; tabela faltando; colunas desconhecidas; importar o mesmo arquivo duas vezes; sessões e aparelhos encerrados depois da importação; plural e singular no resumo.

---

## Fora do escopo do MVP
- "Declarado × verificado" (validação do gerente, foto obrigatória).
- Notificações de atraso, multi-unidade, exportação de relatórios.
- Barra do protótipo (alternadores de demo, relógio simulado).
