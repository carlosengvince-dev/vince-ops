# VINCE Ops — Briefing para o Cursor: Recebimento dentro de Informações Gerais
> Este é um BRIEFING, não um prompt de execução. Peça ao Cursor para analisar
> o código real, responder as perguntas em aberto e devolver um plano técnico
> detalhado — igual foi feito com RT/ART. Não executar nada ainda.

---

## Objetivo

A fase "Recebimento" (código interno `PRE_INFO`) hoje é uma etapa própria
na sequência de fases de HID e PPCI, mas nunca teve tarefas de checklist
vinculadas a ela — só serve pra exibir a tela de conferência de documentos
(`documentos_projeto`: recebido / aguardando / não receberemos).

Isso causa um problema visual real: ela aparece sempre travada em 0% de
progresso na barra lateral, dando a falsa impressão de etapa pendente
eterna, mesmo quando todos os documentos já foram conferidos.

**Decisão já tomada:** eliminar Recebimento como fase própria. A tela de
documentos passa a viver como uma seção (bloco) dentro da fase
"Informações Gerais" (`INFO_GERAL`), que passa a ser a primeira fase
visível da sequência.

---

## Estado atual confirmado

- Os projetos ME e ORO já avançaram de PRE_INFO para INFO_GERAL — não há
  nenhum projeto ativo posicionado em PRE_INFO neste momento
- O sistema já tem uma proteção embutida: tanto `upsert_fase_config`
  quanto `delete_fase_config` recusam a operação se algum projeto ativo
  estiver com `fases_atuais->>disciplina = codigo` daquela fase — ou seja,
  tentar desativar/excluir PRE_INFO enquanto algum projeto estiver
  posicionado ali vai falhar alto e claro, não corromper nada
- Projetos concluídos/cancelados renderizam a partir de um snapshot
  congelado (`snapshot_fechamento.estrutura_fases`) e não devem ser
  afetados por mudança nenhuma na configuração viva de fases

---

## Minha proposta de sequenciamento (5 passos, cada um validado antes do próximo)

**Passo 1 — Mover a tela (só frontend, PRE_INFO continua ativa no banco)**
Mover o componente de documentos para renderizar dentro da visão de
INFO_GERAL, como seção recolhível no topo, acima do checklist de tarefas
normal daquela fase. Não mexer em fases_config ainda — separar
deliberadamente "onde a tela aparece" de "a fase existe ou não" em dois
momentos distintos.

**Passo 2 — Validar visualmente**
Confirmar em ME e ORO que os documentos já conferidos aparecem
corretamente dentro de Informações Gerais, junto com as tarefas normais
daquela fase.

**Passo 3 — Desativar PRE_INFO no banco (só HID e PPCI)**
S� depois do Passo 2 validado. Usar a RPC já existente
(`upsert_fase_config` com `p_ativo: false`), que vai recusar sozinha se
houver algum projeto posicionado ali.

**Passo 4 — Ajustar criação de novos projetos**
Projeto novo hoje nasce com fase inicial = PRE_INFO (primeira fase por
ordem). Precisa nascer direto em INFO_GERAL daqui pra frente. Isso vale
tanto para o modo "Novo" quanto para o seletor de "fase de entrada" do
modo "Em andamento" — PRE_INFO não deve mais aparecer como opção em
lugar nenhum de criação de projeto.

**Passo 5 — Conferência final**
Sidebar de ME, ORO e projetos futuros não deve mais mostrar "Recebimento"
como fase separada. Projeto concluído/cancelado que porventura tenha
passado por PRE_INFO antes desta mudança deve continuar mostrando
corretamente no retrato congelado dele, sem alteração.

---

## Perguntas que preciso que você analise no código real e responda

**1. Mapeamento completo de referências a `PRE_INFO`**
Antes de qualquer execução, preciso de uma lista de TODOS os lugares no
código que referenciam a string `PRE_INFO` explicitamente ou assumem que
ela é a primeira fase — incluindo (mas não limitado a): criação de
projeto (modo novo e em andamento), seletor de fase de entrada, qualquer
lógica de "primeira fase da sequência", testes ou validações hardcoded.

**2. Confirmar estrutura de `documentos_projeto`**
Essa tabela tem alguma coluna de fase, ou é vinculada só por `projeto_id`
(sem relação com qual fase está sendo exibida)? Minha suposição é a
segunda — se estiver certo, mover a tela é puramente um problema de
renderização, sem migração de dados. Confirme isso antes de prosseguir.

**3. Ordem de dependência entre os Passos 3 e 4**
Existe risco de o Passo 3 (desativar PRE_INFO) rodar antes do Passo 4
(ajustar criação de projeto) e algum fluxo de criação tentar inicializar
um projeto novo numa fase que já está inativa, quebrando a criação? Se
sim, sugira a ordem correta ou execução combinada dos dois passos juntos.

**4. Desativar vs excluir — preciso da sua opinião técnica**
Minha recomendação é **desativar** (`ativo = false` via `upsert_fase_config`),
não excluir (`delete_fase_config`, que faz soft-delete). Motivo: mais
reversível, a config continua existindo caso um dia seja necessário
reativar ou consultar. Você vê algum motivo técnico pra preferir exclusão
em vez de desativação neste caso específico? Se não, seguimos com
desativar.

**5. Nome do rótulo de "Informações Gerais"**
Não é bloqueante, mas: faz sentido renomear o label de INFO_GERAL para
algo como "Informações gerais e recebimento", já que agora ela absorve
essa responsabilidade? Ou mantém o nome atual e só a posição na sequência
já resolve o problema perceptivo? Pode sugerir, não decido isso sem ver
como fica na tela.

---

## O que NÃO deve ser tocado

- `documentos_projeto` (dados) — nenhuma migração de dados esperada aqui,
  diferente do caso de RT/ART
- Snapshot de fechamento de projetos concluídos/cancelados
- Qualquer lógica de cálculo de progresso — PRE_INFO nunca teve tarefas
  vinculadas, então a matemática de % provavelmente já está correta;
  o problema é só visual/estrutural

---

## Formato da resposta esperada

Por favor, **não execute nada ainda**. Analise o código, responda as 5
perguntas acima, e devolva um plano técnico detalhado (passo a passo,
como fizemos no RT/ART) para eu revisar antes de dar o aceite final.
