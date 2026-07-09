# VINCE Ops — Guia de Operação e Estrutura Completa
> Documento de referência definitivo. Julho/2026.
> Sistema em produção: https://vince-ops.vercel.app

---

## 1. Infraestrutura — onde tudo mora

| Item | Localização |
|---|---|
| Sistema em produção | https://vince-ops.vercel.app |
| Código fonte | github.com/carlosengvince-dev/vince-ops (público) |
| Banco de dados | Supabase, projeto `hmjppouvwhjxxwgnxppz`, região São Paulo |
| Deploy automático | Vercel — todo `git push origin main` atualiza o site em 2-3 min |
| Pasta local | `D:\VINCE\sistemas-web\vince-ops\` |
| Backups manuais | `D:\VINCE\backups\[data]\` (CSVs) |
| Migrations SQL | `supabase/migrations/` no repo (001 a 025) |
| Decisões de arquitetura | `DECISIONS.md` na raiz do repo |

Chaves do Supabase: apenas em `.env.local` (nunca no Git) e nas
Environment Variables do Vercel.

---

## 2. Checklist de ativação — fazer UMA vez, nesta ordem

1. [ ] **Popular os templates reais** — Configurações → Templates:
   revisar/criar as tarefas reais de HID, PPCI e SPK por fase
   e categoria (o que está lá hoje é parcialmente teste)
2. [ ] **Ajustar fases ao fluxo real** — Configurações → Fases:
   renomear, reordenar, desativar ou criar fases (ex: VISTORIA)
3. [ ] **Conferir disciplinas e cores** — Configurações → Disciplinas
4. [ ] **SALVAR O PADRÃO** — Configurações → Sistema → Padrões e
   restauração → "Salvar configuração atual como padrão" com o
   nome **"Padrão VINCE 2026"**. Este é seu ponto de restauração
   mestre. Refazer sempre que a estrutura evoluir de forma estável.
5. [ ] **Cadastrar clientes reais** — aba Clientes
6. [ ] **Cadastrar projetos em andamento** — Novo projeto → modo
   "Em andamento": fase de entrada + seleção das tarefas restantes
7. [ ] **Projetos antigos finalizados** — modo "Registro histórico"
   (vão direto para o Histórico, sem checklist)
8. [ ] **Apagar os projetos/clientes de teste** que sobraram
9. [ ] **Adicionar o João** — Configurações → Usuários → Adicionar
   (2 etapas: criar no Supabase Auth + colar UUID). Papel: projetista
10. [ ] **Testar como projetista** — validar que João vê tudo em
    modo correto (sem editar configs, timer próprio funcionando)

---

## 3. Rotina de operação

### Diária (você e João)
- Manhã: abrir Dashboard → barra "Hoje" → iniciar timer na tarefa
- Durante o dia: status das tarefas atualizados conforme avança;
  comentários nas tarefas para registros; chat do projeto para
  conversas gerais
- Revisões do trabalho do João: criar **Pendência** tipo
  "Solicitação" com tarefas vinculadas → ele corrige → marca
  respondida (tudo registrado, nada no WhatsApp)
- Fim do dia: parar timer

### Semanal (você — 10 min, toda sexta)
1. **Backup CSV** no Supabase SQL Editor → Export das tabelas:
   `projetos`, `tarefas`, `registros_tempo`, `clientes`,
   `templates_checklist`, `comentarios`, `configuracoes`
   → salvar em `D:\VINCE\backups\[data]\`
2. Revisar calendário do Dashboard: prazos próximos
3. Conferir tarefas bloqueadas e pendências abertas

### Mensal
- Supabase Dashboard → verificar uso do banco (deve estar <10%)
- Quando o uso diário for constante e a lentidão de "acordar"
  incomodar: migrar para Supabase Pro (~R$150/mês, backup
  automático incluso — elimina o backup manual semanal)

---

## 4. Problemas conhecidos e soluções

| Sintoma | Causa | Solução |
|---|---|---|
| Sistema lento na primeira abertura da semana | Supabase free pausa após 7 dias inativo | Supabase Dashboard → "Restore project" (30s). Uso diário evita |
| Erro "new row violates row-level security" | Alguma escrita nova sem RPC | Padrão obrigatório: criar RPC `security definer` com `assert_papel()` — NUNCA liberar write direto na tabela |
| Erro "Could not find the function ... in schema cache" | Assinatura da RPC divergente do código, ou sobrecarga | Conferir assinatura com `select pg_get_functiondef(oid) from pg_proc where proname = 'nome'`; ao mudar assinatura, `DROP FUNCTION` da antiga antes |
| Configuração bagunçada | Erro de edição | Padrões e restauração → restaurar (por aba ou tudo). Backup automático pré-restauração protege |
| Cores de disciplina não atualizam | Cache de CSS vars | F5 resolve; se persistir, verificar injectDisciplinaCssVars |

**Regra de ouro anti-bug (para qualquer sessão futura com IA/Cursor):**
toda escrita no banco via RPC `security definer` + `assert_papel()`;
todo SQL executado vira arquivo numerado em `supabase/migrations/`;
todo soft delete é idempotente (0 linhas = sucesso);
unicidade sempre com índice parcial `where deleted_at is null`.

---

## 5. Mapa do sistema — o que está pronto

**Operação**
- Auth com 5 papéis (você = Diretor Executivo, imortal no sistema)
- Projetos: 3 modos de criação, numeração VNC-2026-XXX, Home com
  dados completos (cliente, empreendimento, protocolos, RT)
- Checklist por disciplina → fase → categoria → tarefa; criar,
  editar, mover entre fases, excluir e reordenar tarefas por projeto
- Avanço de fase com regras EMASA/CBMSC + liberação forçada
- Timer (individual + equipe em tempo real, polling 30s) +
  lançamento manual de horas + histórico de sessões
- Comentários por tarefa + chat unificado do projeto
- Pendências externas (órgãos/cliente/interno) → geram revisões
- Revisões com checklist próprio e numeração por disciplina
- Histórico com filtros + snapshot imutável de fechamento
  (horas, desvio de prazo, membros, **estrutura de fases da época**)

**Configuração (Sessões 3-4 — o coração da flexibilidade)**
- Disciplinas: criar/renomear/excluir, cores personalizadas,
  copiar estrutura completa de outra disciplina
- Fases: criar/renomear/reordenar/desativar/excluir; sem travas
  arbitrárias (só integridade real); ativar/desativar por projeto
- Categorias: entidade única, renomear com cascata controlada,
  excluir com escopo, gestão direto na tela de templates
- Padrões nomeados + restauração total ou por aba + backup
  automático pré-restauração
- Projetos finalizados = retrato congelado (mudanças de config
  não alteram o histórico)

---

## 6. Pendências e roadmap

**Curto prazo (quando a operação pedir)**
- Dashboard "segunda tela": seção travados, equipe agora,
  visão semanal combinada — planejado, não implementado
- Notificações (sininho): prazo <7 dias + tarefa crítica concluída
- Ajustes visuais/nomes de abas (você mencionou — sem impacto estrutural)
- Mobile: funciona no navegador, não otimizado

**V2 (validado como prioridade nas suas respostas)**
- **Dashboard executivo do cliente** — URL pública por projeto,
  sem login, sem horas/valores. Maior impacto + validação da tese SaaS
- **Integração com a Calculadora** — horas reais alimentam
  precificação (fecha o loop financeiro)

**Deliberadamente cortado até dezembro:** Kanban transversal,
calendário semanal, relatório automático, multi-tenant/SaaS.

**Riscos aceitos e monitorados:** repo público + Vercel Hobby em
uso comercial (corrigir com Vercel Pro ~US$20/mês quando fizer
sentido); horas estimadas só para HID/PPCI (colunas fixas);
sem testes automatizados (validação manual pós-sessão).

---

## 7. Como retomar com IA em sessões futuras

O fluxo validado: **IA arquiteta e revisa → Cursor executa →
você valida no browser e no Supabase → push**.

Cole este contexto ao abrir uma nova conversa:

> Trabalho no VINCE Ops (React+Vite+TS, Supabase, Vercel), sistema
> de gestão de projetos da VINCE Engenharia. Repo:
> github.com/carlosengvince-dev/vince-ops. Padrões inegociáveis:
> escrita no banco SÓ via RPC security definer com assert_papel();
> writes diretos negados no RLS; migrations numeradas em
> supabase/migrations/; soft delete idempotente; unicidade parcial
> (where deleted_at is null). Fases, categorias e disciplinas são
> entidades configuráveis (fases_config, categorias_config,
> disciplinas_config). Consulte DECISIONS.md no repo. Sou leigo em
> programação: me entregue SQLs prontos para o Supabase e prompts
> prontos para o Cursor, um passo por vez, com validação entre eles.

---

## 8. Custo atual e gatilhos de upgrade

| Item | Hoje | Gatilho para pagar |
|---|---|---|
| Supabase | R$0 | Pausas frequentes ou equipe usando diário → Pro ~R$150/mês (traz backup automático) |
| Vercel | R$0 | Formalizar uso comercial / SaaS → Pro ~US$20/mês |
| Total | **R$0/mês** | Estimativa: primeiro upgrade em 1-3 meses de uso intenso |
