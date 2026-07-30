# VINCE Ops — Sessão 3: Fases e Categorias como Entidades Reais
> Reestruturação definitiva. Executar em ordem: Passo 0 → Migration 021 → Prompts 3A → 3B → 3C.
> Cada prompt é validado antes do próximo.

---

## PASSO 0 — Backup rápido (2 minutos)

Antes de mudança estrutural, exporte CSV das tabelas que serão tocadas:

```sql
select * from templates_checklist;
```
```sql
select * from configuracoes;
```
Export → CSV de cada uma. Salvar em `D:\VINCE\backups\[data]\`.

---

## PASSO 1 — Migration 021 (executar no Supabase)

Salvar também como `supabase/migrations/021_fases_categorias_config.sql` no repo.

```sql
-- ═══════════════════════════════════════════════
-- 021 — Fases e categorias como entidades reais
-- ═══════════════════════════════════════════════

-- 1. FASES_CONFIG
create table if not exists fases_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizacoes(id),
  disciplina text not null,
  codigo text not null,          -- ID interno IMUTÁVEL (nunca exibido na UI)
  label text not null,           -- Nome exibido (editável)
  ordem integer not null default 0,
  obrigatoria boolean not null default false,  -- não pode ser desativada/excluída
  sistema boolean not null default true,       -- false = criada pelo usuário
  ativo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (disciplina, codigo)
);

-- Seed HID
insert into fases_config (disciplina, codigo, label, ordem, obrigatoria, sistema) values
  ('HID','PRE_INFO','Recebimento',0,true,true),
  ('HID','INFO_GERAL','Informações gerais',1,false,true),
  ('HID','EP','Estudo preliminar',2,false,true),
  ('HID','PP','Projeto preliminar',3,false,true),
  ('HID','AP','Anteprojeto',4,false,true),
  ('HID','PROTOCOLO_EMASA','Protocolo EMASA',5,false,true),
  ('HID','EX','Executivo',6,false,true),
  ('HID','ENTREGA','Entrega',7,true,true)
on conflict (disciplina, codigo) do nothing;

-- Seed PPCI
insert into fases_config (disciplina, codigo, label, ordem, obrigatoria, sistema) values
  ('PPCI','PRE_INFO','Recebimento',0,true,true),
  ('PPCI','INFO_GERAL','Informações gerais',1,false,true),
  ('PPCI','EP','Estudo preliminar',2,false,true),
  ('PPCI','AP','Anteprojeto',3,false,true),
  ('PPCI','PROTOCOLO_CBMSC','Protocolo CBMSC',4,false,true),
  ('PPCI','EX_APRESENTACAO','Executivo / Apresentação',5,false,true),
  ('PPCI','ENTREGA','Entrega',6,true,true)
on conflict (disciplina, codigo) do nothing;

-- Seed SPK (espelha PPCI — ajustável depois na UI, agora é configurável)
insert into fases_config (disciplina, codigo, label, ordem, obrigatoria, sistema) values
  ('SPK','PRE_INFO','Recebimento',0,true,true),
  ('SPK','INFO_GERAL','Informações gerais',1,false,true),
  ('SPK','EP','Estudo preliminar',2,false,true),
  ('SPK','AP','Anteprojeto',3,false,true),
  ('SPK','PROTOCOLO_CBMSC','Protocolo CBMSC',4,false,true),
  ('SPK','EX_APRESENTACAO','Executivo / Apresentação',5,false,true),
  ('SPK','ENTREGA','Entrega',6,true,true)
on conflict (disciplina, codigo) do nothing;

-- 2. CATEGORIAS_CONFIG
create table if not exists categorias_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizacoes(id),
  disciplina text not null,
  nome text not null,
  ordem integer not null default 0,
  sistema boolean not null default false,   -- true = padrão do sistema
  ativo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (disciplina, nome)
);

-- Seed automático: importar TODAS as categorias já existentes nos templates
insert into categorias_config (disciplina, nome, sistema)
select distinct disciplina, categoria, true
from templates_checklist
where deleted_at is null and categoria is not null and categoria <> ''
on conflict (disciplina, nome) do nothing;

-- Seed: importar da lista antiga de configuracoes (se existir)
insert into categorias_config (disciplina, nome, sistema)
select 'HID', x, true
from jsonb_array_elements_text(
  (select valor from configuracoes where chave = 'categorias_hid')) x
on conflict (disciplina, nome) do nothing;

insert into categorias_config (disciplina, nome, sistema)
select 'PPCI', x, true
from jsonb_array_elements_text(
  (select valor from configuracoes where chave = 'categorias_ppci')) x
on conflict (disciplina, nome) do nothing;

insert into categorias_config (disciplina, nome, sistema)
select 'SPK', x, true
from jsonb_array_elements_text(
  (select valor from configuracoes where chave = 'categorias_spk')) x
on conflict (disciplina, nome) do nothing;

-- 3. PROJETO_FASES (exceções por projeto + âncora futura
--    para múltiplos responsáveis por fase)
create table if not exists projeto_fases (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id),
  fase_config_id uuid not null references fases_config(id),
  ativa boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (projeto_id, fase_config_id)
);
-- Regra: ausência de registro = fase ATIVA (default).
-- Só guarda exceções (desativações) e futuras atribuições.

-- 4. RLS — leitura aberta, escrita só via RPC (padrão do sistema)
alter table fases_config enable row level security;
alter table categorias_config enable row level security;
alter table projeto_fases enable row level security;

create policy "fases_config_select" on fases_config
  for select to authenticated using (deleted_at is null);
create policy "categorias_config_select" on categorias_config
  for select to authenticated using (deleted_at is null);
create policy "projeto_fases_select" on projeto_fases
  for select to authenticated using (true);
-- Nenhuma policy de write = negado. RPCs são o único caminho.

-- 5. RPCs

-- Fases: criar/editar (código imutável após criação)
create or replace function public.upsert_fase_config(
  p_id uuid,
  p_disciplina text,
  p_codigo text,
  p_label text,
  p_ordem integer default 0,
  p_ativo boolean default true
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  if p_id is null then
    insert into fases_config (disciplina, codigo, label, ordem, obrigatoria, sistema, ativo)
    values (p_disciplina, p_codigo, p_label, p_ordem, false, false, p_ativo)
    returning id into v_id;
  else
    update fases_config set
      label = p_label,
      ordem = p_ordem,
      -- fases obrigatórias não podem ser desativadas
      ativo = case when obrigatoria then true else p_ativo end,
      updated_at = now()
    where id = p_id and deleted_at is null;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

-- Fases: excluir (só customizadas)
create or replace function public.delete_fase_config(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);
  update fases_config set deleted_at = now()
  where id = p_id and deleted_at is null
    and sistema = false;  -- fases de sistema são intocáveis
  if not found then
    raise exception 'Fase de sistema não pode ser excluída';
  end if;
end;
$$;

-- Categorias: criar/editar
create or replace function public.upsert_categoria_config(
  p_id uuid,
  p_disciplina text,
  p_nome text,
  p_ordem integer default 0,
  p_ativo boolean default true
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  if p_id is null then
    insert into categorias_config (disciplina, nome, ordem, sistema, ativo)
    values (p_disciplina, p_nome, p_ordem, false, p_ativo)
    on conflict (disciplina, nome) do update set
      ativo = true, deleted_at = null
    returning id into v_id;
  else
    update categorias_config set
      ordem = p_ordem, ativo = p_ativo, updated_at = now()
    where id = p_id and deleted_at is null;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

-- Categorias: renomear com cascata controlada
-- p_escopo: 'config' | 'config_templates' | 'tudo'
create or replace function public.rename_categoria(
  p_id uuid,
  p_novo_nome text,
  p_escopo text default 'config_templates'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_antigo text;
  v_disc text;
  v_templates integer := 0;
  v_tarefas integer := 0;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  select nome, disciplina into v_antigo, v_disc
  from categorias_config where id = p_id and deleted_at is null;
  if v_antigo is null then
    raise exception 'Categoria não encontrada';
  end if;

  update categorias_config set nome = p_novo_nome, updated_at = now()
  where id = p_id;

  if p_escopo in ('config_templates', 'tudo') then
    update templates_checklist set categoria = p_novo_nome, updated_at = now()
    where categoria = v_antigo and disciplina = v_disc and deleted_at is null;
    get diagnostics v_templates = row_count;
  end if;

  if p_escopo = 'tudo' then
    update tarefas set categoria = p_novo_nome, updated_at = now()
    where categoria = v_antigo and disciplina = v_disc and deleted_at is null
      and projeto_id in (
        select id from projetos
        where status in ('ativo','em_revisao') and deleted_at is null
      );
    get diagnostics v_tarefas = row_count;
  end if;

  return jsonb_build_object(
    'templates_afetados', v_templates,
    'tarefas_afetadas', v_tarefas
  );
end;
$$;

-- Categorias: excluir (soft)
create or replace function public.delete_categoria_config(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);
  update categorias_config set deleted_at = now()
  where id = p_id and deleted_at is null;
end;
$$;

-- Fases por projeto: ativar/desativar
create or replace function public.set_projeto_fase(
  p_projeto_id uuid,
  p_fase_config_id uuid,
  p_ativa boolean
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  -- fases obrigatórias não podem ser desativadas
  if p_ativa = false and exists (
    select 1 from fases_config
    where id = p_fase_config_id and obrigatoria = true
  ) then
    raise exception 'Fase obrigatória não pode ser desativada';
  end if;

  insert into projeto_fases (projeto_id, fase_config_id, ativa)
  values (p_projeto_id, p_fase_config_id, p_ativa)
  on conflict (projeto_id, fase_config_id)
  do update set ativa = excluded.ativa, updated_at = now();
end;
$$;

-- Aplicar exceção a vários projetos de uma vez
-- (usado por "aplicar a todos os projetos ativos")
create or replace function public.set_fase_projetos_ativos(
  p_fase_config_id uuid,
  p_ativa boolean
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  insert into projeto_fases (projeto_id, fase_config_id, ativa)
  select id, p_fase_config_id, p_ativa
  from projetos
  where status in ('ativo','em_revisao') and deleted_at is null
  on conflict (projeto_id, fase_config_id)
  do update set ativa = excluded.ativa, updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
```

Validar após executar:
```sql
select disciplina, codigo, label, ordem from fases_config order by disciplina, ordem;
select disciplina, nome, sistema from categorias_config order by disciplina, ordem, nome;
```
Deve mostrar todas as fases e todas as categorias já existentes importadas.

---

## PROMPT 3A — Fases dinâmicas (mandar pro Cursor)

```
Migration 021 executada no Supabase. Existem agora:
- Tabela fases_config (fonte de verdade das fases)
- Tabela categorias_config (fonte de verdade das categorias)
- Tabela projeto_fases (exceções por projeto)
- RPCs: upsert_fase_config, delete_fase_config,
  upsert_categoria_config, rename_categoria,
  delete_categoria_config, set_projeto_fase,
  set_fase_projetos_ativos

## Esta etapa (3A): migrar FASES do hardcode para o banco.
NÃO mexer em categorias ainda (será a 3B).

### 1. Novo módulo src/lib/faseConfig.ts

- fetchFasesConfig(disciplina?): busca fases_config
  where ativo = true and deleted_at is null,
  order by ordem. Cache em memória (Map por disciplina)
  com invalidação manual (invalidateFasesCache()).
- Tipos: FaseConfig { id, disciplina, codigo, label,
  ordem, obrigatoria, sistema, ativo }

### 2. Substituir PHASE_SEQUENCES hardcoded

Buscar TODOS os usos de PHASE_SEQUENCES / labels de fase
em constants.ts e substituir por dados de fases_config:
- Sidebar de fases do projeto (PhaseSidebar)
- Criação de projeto (fase de entrada, modos)
- Avanço de fase (canAdvancePhase — a SEQUÊNCIA agora
  vem do banco, ordenada por ordem)
- Dashboard (labels de fase)
- Qualquer lugar que renderize nome de fase

REGRA CRÍTICA DE COMPATIBILIDADE:
- projetos.fases_atuais continua guardando o CODIGO
  (ex: {"HID": "AP"}). Nada muda no formato dos dados.
- A lógica de bloqueio EMASA/CBMSC continua keyed
  pelos códigos PROTOCOLO_EMASA / PROTOCOLO_CBMSC.
- O código é o identificador; o label é só exibição.

### 3. UI Configurações → Fases (reescrever)

- Lê de fases_config via faseConfig.ts
- NUNCA exibir o código interno (INFO_GERAL etc.) —
  o usuário vê apenas o label. Código só existe
  internamente.
- Cada fase: label editável inline + setinhas ↑↓ para
  reordenar (persiste ordem via upsert_fase_config) +
  toggle ativo/inativo
- Fases com obrigatoria = true: toggle desabilitado
  com tooltip "Fase obrigatória"
- Fases com sistema = true: sem botão excluir,
  ícone de cadeado discreto
- Fases com sistema = false: botão excluir com
  ConfirmModal danger → delete_fase_config
- Botão "+ Nova fase": modal com:
  - Nome da fase (obrigatório)
  - Posição: select "Após [fase X]"
  - Aplicar a: "Todos os projetos" (default) |
    "Somente projetos novos"
  - Ao salvar: gerar codigo = slug do nome em
    UPPER_SNAKE (ex: "Vistoria técnica" → VISTORIA_TECNICA),
    chamar upsert_fase_config com p_id: null.
    Se "Somente projetos novos": chamar
    set_fase_projetos_ativos(novaFaseId, false)
    para desativar em todos os projetos existentes.
- Usar o SettingsSaveBar existente para alterações
  de label/ordem em lote (padrão já estabelecido)

### 4. Sidebar do projeto respeitando projeto_fases

- Ao renderizar fases de um projeto: buscar exceções
  em projeto_fases where projeto_id = X
- Fase com registro ativa = false: NÃO renderizar
  na sidebar
- canAdvancePhase: pular fases desativadas na sequência
- Progresso do projeto: ignorar tarefas de fases
  desativadas

Se o PHASE_SEQUENCES do constants.ts tiver alguma fase
ou disciplina divergente do seed da migration, me avisar
ANTES de prosseguir (não inventar).

npm run build deve passar.
Validar: sidebar renderiza fases do banco, labels
editados persistem após F5, nova fase aparece.
Confirmar antes da 3B.
```

---

## PROMPT 3B — Categorias unificadas (mandar após validar 3A)

```
3A validada. Agora migrar CATEGORIAS para categorias_config.

### 1. Novo módulo src/lib/categoriaConfig.ts

- fetchCategoriasConfig(disciplina): where ativo = true
  and deleted_at is null, order by ordem, nome
- createCategoria(disciplina, nome) →
  upsert_categoria_config com p_id: null (idempotente)
- renameCategoria(id, novoNome, escopo) →
  rename_categoria — retorna contagens
- deleteCategoria(id) → delete_categoria_config

### 2. Aba Configurações → Categorias (reescrever)

- Lê SOMENTE de categorias_config (remover a união
  confusa com templates e a lista antiga de configuracoes)
- Badge "Padrão" (cinza) nas com sistema = true
- Renomear: modal com preview do impacto e escopo:
  ( ) Só a lista de categorias
  (•) Lista + templates  [default]
  ( ) Lista + templates + tarefas de projetos ativos
  Ao confirmar: renameCategoria → toast com resultado:
  "Renomeada. X templates e Y tarefas atualizados."
- Excluir: ConfirmModal danger. Aviso se houver
  templates usando: "X tarefas de template usam esta
  categoria. Elas manterão o nome atual como texto."
- Adicionar: input + botão (persiste na hora via RPC,
  sem save bar — operação atômica)
- Reordenar: setinhas ↑↓

### 3. Integração com templates e tarefas

- "+ Nova categoria" dentro do template checklist:
  chama createCategoria() ANTES de abrir o form —
  a categoria nasce na fonte de verdade
- Select/autocomplete de categoria (modal de tarefa,
  mover tarefa, template): opções vêm de
  fetchCategoriasConfig(disciplina)
- Campo categoria em templates_checklist e tarefas
  CONTINUA texto (sem migração de FK agora) — a tabela
  config é a fonte de verdade dos NOMES, o rename em
  cascata mantém a consistência

### 4. Limpeza

- Remover funções antigas: mergeCategoriasUnion,
  addCategoriaToList, fetchDistinctCategoriasTemplates
  e as chaves categorias_hid/ppci/spk de configuracoes
  (deixar de ler; não precisa apagar do banco)

npm run build deve passar.
Validar: criar categoria no template → aparece na aba;
renomear com escopo "tudo" → templates e tarefas mudam;
excluir → some; F5 → tudo persiste.
Confirmar antes da 3C.
```

---

## PROMPT 3C — Fases por projeto na Home (mandar após validar 3B)

```
3B validada. Última etapa: controle de fases por projeto.

### Home do projeto → seção "Fases do projeto"

Na seção "Dados do projeto" (ou card próprio abaixo),
adicionar sub-seção colapsável "Fases ativas":

- Para cada disciplina do projeto: lista das fases
  (de fases_config, ordem) com toggle
- Estado do toggle: buscar projeto_fases;
  ausência de registro = ativa
- Toggle de fase obrigatória: desabilitado + tooltip
- Ao DESATIVAR: ConfirmModal warning
  "As tarefas desta fase deixarão de contar no
  progresso e a fase não aparecerá na sequência."
  + select "Aplicar a: Só este projeto (default) /
  Todos os projetos ativos"
  → set_projeto_fase ou set_fase_projetos_ativos
- Ao REATIVAR: direto, sem modal
- Registrar em activity_log:
  "{nome} desativou a fase {label} ({disciplina})"

### Consistência (verificar se 3A já cobriu)

- Sidebar não mostra fases desativadas
- Avanço de fase pula desativadas
- Se a fase ATUAL do projeto for desativada:
  bloquear com aviso "Avance ou retorne a fase antes
  de desativá-la"
- Progresso e dashboard ignoram tarefas de fases
  desativadas

Só gestor/diretor vê os toggles; projetista vê a
lista em modo leitura.

npm run build deve passar.
Validar: desativar PROTOCOLO_EMASA em um projeto sem
aprovação → some da sidebar → progresso recalcula →
reativar → volta.
```

---

## Sequência de deploy

Após cada prompt validado localmente:
```
git add .
git commit -m "feat(sessao3): [3A fases dinamicas | 3B categorias | 3C fases por projeto]"
git push origin main
```

## Registrar no DECISIONS.md (pedir ao Cursor no final da 3C)

1. Fases e categorias são entidades em tabelas próprias;
   código imutável + label editável (fases), rename em
   cascata via RPC (categorias)
2. projeto_fases guarda só exceções (ausência = ativa)
   e nasce como âncora para responsáveis por fase (N:N futuro)
3. Tarefas/templates mantêm categoria como texto; a
   consistência é garantida pelo rename_categoria —
   migração para FK adiada deliberadamente
4. org_id presente nas tabelas novas para tenancy futura
