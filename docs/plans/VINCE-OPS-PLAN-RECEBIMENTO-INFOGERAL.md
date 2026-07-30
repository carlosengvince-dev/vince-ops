# VINCE Ops — Plano técnico: Recebimento dentro de Informações Gerais
> Resposta ao briefing `docs/plans/VINCE-OPS-BRIEFING-RECEBIMENTO-INFOGERAL.md`.
> Diagnóstico no código real + plano passo a passo para aceite.
> **Não executar até o aceite final.**

---

## Objetivo (confirmado)

Eliminar "Recebimento" (`PRE_INFO`) como fase própria na sidebar.
A conferência de documentos (`PreInfoPanel` / `documentos_projeto`) passa a
viver como **seção no topo** da fase **Informações Gerais** (`INFO_GERAL`),
que se torna a primeira fase visível da sequência.

Problema que isso resolve: `PRE_INFO` sem tarefas → `calcPhaseProgress`
sempre retorna **0%** → falsa impressão de etapa eternamente pendente.

---

## Respostas às 5 perguntas do briefing

### 1. Mapeamento completo de `PRE_INFO`

**Referências explícitas (código de produto):**

| Arquivo | Uso |
|---------|-----|
| `src/types/index.ts` | Tipo `Fase` inclui `'PRE_INFO'` |
| `src/lib/constants.ts` | Sequências HID/PPCI/**SPK** começam em `PRE_INFO`; label `Recebimento`; excluída de `FASES_COM_CHECKLIST` |
| `src/lib/faseConfig.ts` | `obrigatoria` especial; fallback `sequence[0] ?? 'PRE_INFO'`; `getFasesComChecklist` remove `PRE_INFO` |
| `src/lib/projects.ts` | **modo novo** grava `fasesAtuais[d] = 'PRE_INFO'` (hardcoded) |
| `src/lib/projetoDisciplinas.ts` | **adicionar disciplina** grava sempre `'PRE_INFO'` |
| `src/pages/ProjectDetail.tsx` | Se `faseAtiva === 'PRE_INFO'` → só `PreInfoPanel`; senão → `ChecklistPanel`; navegação AP → PRE_INFO |
| `src/components/settings/TemplatesChecklistSection.tsx` | Já esconde PRE_INFO da UI de templates |
| `src/lib/timer.ts` | Fallback de fase quando tarefa some → `'PRE_INFO'` (cosmética de log) |

**Assunções de “primeira fase” (sem string, mas acopladas):**
- `getFaseAtualFromSequence` → se fase atual inválida, usa `sequence[0]`
- Seletor “em andamento” (`StepChecklistSelect`) já **exclui** PRE_INFO (só checklist)
- Modal adicionar disciplina filtra templates sem PRE_INFO, mas **persiste** PRE_INFO mesmo assim

**Fora de escopo (homônimo):** “Recebimento” em pendências (`data_recebimento`) — não é a fase.

**Atenção SPK:** `PHASE_SEQUENCES.SPK` e o seed de fases também têm `PRE_INFO`.
O briefing citou só HID/PPCI; o plano recomenda **desativar nas três** (mesmo bug visual).

---

### 2. Estrutura de `documentos_projeto` — confirmado

**Sem coluna de fase.** Vínculo só por `projeto_id` (+ `disciplina` opcional).

Carregamento em `useProjectDetail`: todos os docs do projeto, sem filtro de fase.
A relação com PRE_INFO é **somente de renderização** em `ProjectDetail`.

→ Mover a tela = mudança de UI. **Nenhuma migração de dados** em `documentos_projeto`.

---

### 3. Ordem Passo 3 vs Passo 4 — risco real

**Sim, há risco** se desativar PRE_INFO antes de ajustar criação:

- `buildFasesAtuais` (modo novo) e `buildFasesAtuaisComNovaDisciplina` **hardcodam** `'PRE_INFO'`
- Desativar PRE_INFO remove ela da sequência ativa; gravar `fases_atuais = PRE_INFO` deixaria o projeto numa fase inexistente/inativa → sidebar/navegação quebradas
- A RPC de desativar só bloqueia se **já existe** projeto ativo **posicionado** ali; não impede criar projeto novo apontando para código desativado

**Ordem correta (ajustada):**

1. Frontend: docs dentro de INFO_GERAL (+ redirect PRE_INFO → INFO_GERAL)  
2. Validação visual (ME / ORO)  
3. **Código de criação/entrada + desativar PRE_INFO no mesmo deploy** (não separar em releases)  
4. Conferência final  

Ou seja: o antigo “Passo 4” sobe **junto** com o “Passo 3”, nunca depois em produção sozinho.

---

### 4. Desativar vs excluir — opinião técnica

**Seguir desativar** (`upsert_fase_config` / `p_ativo: false`).

Motivos:
- Reversível (reativar se precisar)
- Soft-delete (`delete_fase_config`) é mais agressivo e desnecessário aqui
- Snapshots de projetos fechados já congelam `estrutura_fases` — não dependem da fase viva
- Não há motivo técnico para excluir neste caso

---

### 5. Nome do rótulo de INFO_GERAL — sugestão

**Manter** o label da fase: **“Informações Gerais”**.

Na seção embutida, usar o título já existente do painel:
**“Recebimento de documentos”** (como em `PreInfoPanel`).

Motivo: evita fase com nome longo na sidebar; a responsabilidade nova fica clara
no bloco, não no nome da etapa. Renomear para “Informações gerais e recebimento”
só faria sentido se, após validar na tela, a equipe achar a seção “escondida”.

**Decisão padrão deste plano:** não renomear a fase agora (pode reavaliar no Passo 2).

---

## Estado atual (código + produto)

- ME / ORO já em INFO_GERAL — janela segura para desativar PRE_INFO (após ajuste de criação)
- `upsert_fase_config` / `delete_fase_config` recusam se projeto ativo/em_revisão estiver na fase
- Projetos concluídos/cancelados usam `snapshot_fechamento.estrutura_fases` — **não tocar**
- Progresso 0% em PRE_INFO = `calcPhaseProgress` com zero tarefas (comportamento esperado, não bug de % a “corrigir”)

---

## Plano de execução (4 entregas + validação)

### Entrega A — Só frontend: docs dentro de INFO_GERAL
*(PRE_INFO continua ativa no banco e ainda pode aparecer na sidebar)*

**O quê**
- Em `ProjectDetail.tsx`: quando `faseAtiva === 'INFO_GERAL'`, renderizar
  `PreInfoPanel` (seção recolhível, **aberta por padrão** na 1ª visita da sessão
  do projeto, ou sempre aberta no topo — preferência: **sempre visível no topo**,
  sem esconder documentos atrás de clique extra) **acima** do `ChecklistPanel`
  da mesma fase
- Quando `faseAtiva === 'PRE_INFO'`: **redirect** para `INFO_GERAL` (mesma
  disciplina, query param `fase=INFO_GERAL`) — evita tela “órfã” e deep links
  antigos
- Banner de críticos em AP (`ChecklistPanel` → `onNavigateToPreInfo`): navegar
  para `INFO_GERAL` (âncora/`#recebimento` opcional) em vez de `PRE_INFO`
- **Não** alterar `fases_config`, criação de projeto, nem progresso

**Arquivos principais**
- `src/pages/ProjectDetail.tsx`
- `src/components/projects/PreInfoPanel.tsx` (ajuste leve de layout/cabeçalho se precisar
  parecer “seção” e não página inteira)
- `src/components/projects/ChecklistPanel.tsx` (só destino da navegação de críticos)

**Validação A**
- Em ME e ORO: INFO_GERAL mostra documentos já conferidos + checklist da fase
- Clicar “Recebimento” na sidebar (ainda visível) cai em INFO_GERAL com os docs
- Nenhum dado de `documentos_projeto` alterado

---

### Entrega B — Validação visual (humano, sem código)

Checklist:
- [ ] ME: docs + tarefas INFO_GERAL ok
- [ ] ORO: idem
- [ ] Scroll/comentários/timer intactos
- [ ] Projeto concluído/cancelado (se houver com PRE_INFO no snapshot): retrato
      congelado inalterado

Só após OK → Entrega C.

---

### Entrega C — Criação/entrada + desativar PRE_INFO (mesmo deploy)

**C1 — Código (obrigatório antes/junto da desativação)**

| Ponto | Mudança |
|-------|---------|
| `projects.ts` → `buildFasesAtuais` modo `novo` | Inicial = primeira fase **ativa** da sequência (`INFO_GERAL` após PRE_INFO sumir; até lá, preferir `'INFO_GERAL'` explícito, não `'PRE_INFO'`) |
| `projetoDisciplinas.ts` → `buildFasesAtuaisComNovaDisciplina` | Idem: nova disciplina nasce em `INFO_GERAL` (ou 1ª fase ativa com checklist) |
| `faseConfig.ts` fallback `?? 'PRE_INFO'` | Trocar para `?? 'INFO_GERAL'` (ou `sequence[0]` sem fallback PRE_INFO) |
| `timer.ts` fallback | Preferir `'INFO_GERAL'` (baixo impacto) |
| Constantes / cópia Settings | Textos “PRÉ-INFO” / “Documentos padrão PRÉ-INFO” → “Recebimento” ou “documentos do projeto” (cosmético) |
| Tipo `Fase` / `PHASE_SEQUENCES` | **Manter** `PRE_INFO` no union e nas sequências fallback por compatibilidade de snapshots antigos; fase simplesmente fica inativa no banco |

Seletor “em andamento” já exclui PRE_INFO — sem mudança estrutural.

**C2 — Banco (após C1 no mesmo release)**

Desativar PRE_INFO via RPC existente, **para HID, PPCI e SPK**:

- `upsert_fase_config(..., p_ativo: false)` por cada linha `fases_config` com
  `codigo = 'PRE_INFO'`
- Se a RPC recusar: algum projeto ativo ainda posicionado em PRE_INFO —
  avançar antes (estado atual: nenhum, conforme briefing)

Opcional: migration SQL `029_desativar_pre_info.sql` idempotente que faz o
`UPDATE ... SET ativo = false` **somente se** nenhum projeto ativo/em_revisão
tiver `fases_atuais->>disciplina = 'PRE_INFO'` (mesma guarda da RPC).

**Não** chamar `delete_fase_config`.

**Validação C**
- Criar projeto modo Novo → `fases_atuais` = INFO_GERAL; sidebar **sem** Recebimento
- Adicionar disciplina a projeto existente → nasce em INFO_GERAL
- Modo Em andamento: seletor sem PRE_INFO (já era assim)
- ME/ORO: sidebar sem Recebimento; docs continuam em INFO_GERAL

---

### Entrega D — Conferência final + regressões

- [ ] Sidebar ME / ORO / projeto novo: sem fase “Recebimento”
- [ ] INFO_GERAL é a primeira fase visível
- [ ] Docs editáveis (status / obs / avulso) na Home da fase
- [ ] Avançar fase a partir de INFO_GERAL funciona
- [ ] Snapshot de projeto fechado com PRE_INFO histórico: inalterado
- [ ] `npm run build` passa
- [ ] Backup pré-deploy: `Backup-agora.bat pre-recebimento-infogeral`

---

## O que NÃO deve ser tocado

- Dados de `documentos_projeto` (sem migração de linhas)
- `snapshot_fechamento` / `estrutura_fases` de projetos concluídos/cancelados
- Fórmula de `calcPhaseProgress` (não “inventar” % com base em documentos)
- Soft-delete / exclusão da linha `fases_config` PRE_INFO
- Pendências “Recebimento” / `data_recebimento` (outro domínio)

---

## Decisões fechadas neste plano

| # | Decisão |
|---|--------|
| A | Mover UI primeiro; desativar fase só depois da validação visual |
| B | Criação/entrada + desativar PRE_INFO no **mesmo** deploy |
| C | **Desativar**, não excluir |
| D | Incluir **SPK** na desativação (além de HID/PPCI) |
| E | Manter label da fase “Informações Gerais”; seção “Recebimento de documentos” |
| F | Sem migração de `documentos_projeto` |
| G | Redirect `fase=PRE_INFO` → `INFO_GERAL` no frontend |

---

## Ordem resumida (aceite → execução)

```text
Backup → Entrega A (UI) → Validação B (ME/ORO)
  → Entrega C (código criação + desativar PRE_INFO HID/PPCI/SPK)
  → Entrega D (checklist final + build)
```

---

## Pronto para aceite?

Se a tabela de decisões (A–G) estiver ok — em especial **incluir SPK (D)** e
**não renomear a fase (E)** — este plano pode ir para execução na ordem acima.

Pontos para você só confirmar se discordar:
1. SPK também desativa PRE_INFO? *(plano assume sim)*
2. Seção de documentos sempre aberta no topo de INFO_GERAL, sem collapse? *(plano assume sim; collapse fica opcional depois)*
