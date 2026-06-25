-- VINCE Ops — Schema inicial
-- Executar manualmente no Supabase Dashboard: SQL Editor → New Query → Run
--
-- Ordem de execução:
--   1. Extensões
--   2. Tabelas (dependências)
--   3. Índices
--   4. Função is_gestor()
--   5. ENABLE ROW LEVEL SECURITY
--   6. Policies

-- ═══════════════════════════════════════════
-- 1. EXTENSÕES
-- ═══════════════════════════════════════════
create extension if not exists "pgcrypto";

-- ═══════════════════════════════════════════
-- 2. TABELAS (ordem de dependência)
-- ═══════════════════════════════════════════

-- USUÁRIOS / PERFIS
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  papel text not null check (papel in ('gestor','projetista','administrador','proprietario')),
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CLIENTES
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text,
  email text,
  telefone text,
  cnpj_cpf text,
  observacoes text,
  metadata jsonb default '{}',
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PROJETOS
create table projetos (
  id uuid primary key default gen_random_uuid(),

  codigo text not null unique,
  numero_sequencial serial,
  nome text not null,
  cliente_id uuid references clientes(id),
  endereco text,
  tipo_edificacao text,
  area_m2 numeric,

  disciplinas text[] not null default '{}',
  metodologia jsonb default '{}',

  status text not null default 'ativo'
    check (status in ('ativo','em_revisao','suspenso','cancelado','concluido')),
  justificativa_cancelamento text,

  modo_criacao text not null default 'novo'
    check (modo_criacao in ('novo','em_andamento','historico')),

  fases_atuais jsonb default '{}',

  data_inicio date,
  data_protocolo_prevista date,
  data_entrega_prevista date,
  data_conclusao_real date,

  horas_estimadas_hid numeric,
  horas_estimadas_ppci numeric,

  responsaveis jsonb default '{}',
  snapshot_fechamento jsonb,
  metadata jsonb default '{}',

  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references profiles(id)
);

-- REVISÕES
create table revisoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id),
  numero text not null,
  disciplina text not null,
  origem text not null,
  descricao text,
  status text default 'aberta' check (status in ('aberta','concluida')),
  data_abertura date default current_date,
  data_conclusao date,
  criado_por uuid references profiles(id),
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- PENDÊNCIAS EXTERNAS
create table pendencias_externas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id),
  orgao text not null,
  tipo text not null,
  descricao text not null,
  prazo date,
  status text default 'aberta' check (status in ('aberta','respondida','cancelada')),
  revisao_gerada_id uuid references revisoes(id),
  criado_por uuid references profiles(id),
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- DOCUMENTOS DO PROJETO (painel PRÉ-INFO)
create table documentos_projeto (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id),
  disciplina text,
  nome text not null,
  tipo text not null,
  status text default 'aguardando'
    check (status in ('aguardando','recebido','nao_receberemos')),
  critico boolean default false,
  observacoes text,
  data_recebimento date,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- TEMPLATES DE CHECKLIST
create table templates_checklist (
  id uuid primary key default gen_random_uuid(),
  disciplina text not null,
  fase text not null,
  categoria text not null,
  nome text not null,
  descricao text,
  criticidade text default 'normal' check (criticidade in ('critico','normal')),
  origem text default 'interno'
    check (origem in ('EMASA','CBMSC','NBR','interno')),
  referencia_normativa text,
  executor_padrao text default 'projetista'
    check (executor_padrao in ('gestor','projetista','ambos')),
  metodologia_minima text check (metodologia_minima in ('2D','3D','BIM')),
  ordem integer default 0,
  ativo boolean default true,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TAREFAS DOS PROJETOS
create table tarefas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id),
  revisao_id uuid references revisoes(id),
  template_id uuid references templates_checklist(id),

  disciplina text not null,
  fase text not null,
  categoria text not null,

  nome text not null,
  descricao text,
  criticidade text default 'normal' check (criticidade in ('critico','normal')),
  origem text default 'interno'
    check (origem in ('EMASA','CBMSC','NBR','interno')),
  referencia_normativa text,
  metodologia_minima text,
  ordem integer default 0,

  status text default 'pendente'
    check (status in ('pendente','em_elaboracao','em_revisao','bloqueado','concluido','nao_aplica')),
  motivo_bloqueio text,

  responsavel_id uuid references profiles(id),
  data_conclusao timestamptz,

  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by uuid references profiles(id)
);

-- COMENTÁRIOS NAS TAREFAS
create table comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id),
  autor_id uuid not null references profiles(id),
  texto text not null,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- REGISTROS DE TEMPO
create table registros_tempo (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id),
  projeto_id uuid not null references projetos(id),
  disciplina text not null,
  usuario_id uuid not null references profiles(id),
  inicio timestamptz not null,
  fim timestamptz,
  duracao_segundos integer,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- LIBERAÇÕES DE FASE
create table liberacoes_fase (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id),
  disciplina text not null,
  fase_liberada text not null,
  liberado_por uuid not null references profiles(id),
  justificativa text not null,
  tarefas_pendentes_ids uuid[],
  created_at timestamptz default now()
);

-- FEED DE ATIVIDADE
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references projetos(id),
  usuario_id uuid not null references profiles(id),
  tipo text not null,
  descricao text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════
-- 3. ÍNDICES
-- ═══════════════════════════════════════════
create unique index projetos_codigo_idx on projetos(codigo) where deleted_at is null;

create index registros_tempo_ativo_idx
  on registros_tempo(usuario_id)
  where fim is null and deleted_at is null;

-- ═══════════════════════════════════════════
-- 4. FUNÇÃO AUXILIAR (RLS)
-- ═══════════════════════════════════════════
create or replace function public.is_gestor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and papel = 'gestor'
      and ativo = true
  );
$$;

-- ═══════════════════════════════════════════
-- 5. HABILITAR ROW LEVEL SECURITY
-- ═══════════════════════════════════════════
alter table profiles enable row level security;
alter table clientes enable row level security;
alter table projetos enable row level security;
alter table revisoes enable row level security;
alter table pendencias_externas enable row level security;
alter table documentos_projeto enable row level security;
alter table templates_checklist enable row level security;
alter table tarefas enable row level security;
alter table comentarios enable row level security;
alter table registros_tempo enable row level security;
alter table liberacoes_fase enable row level security;
alter table activity_log enable row level security;

-- ═══════════════════════════════════════════
-- 6. POLICIES (mínimo — refinar nas fases seguintes)
-- ═══════════════════════════════════════════

-- profiles
create policy "profiles_select_authenticated"
  on profiles for select
  to authenticated
  using (true);

create policy "profiles_update_self_or_gestor"
  on profiles for update
  to authenticated
  using (id = auth.uid() or public.is_gestor());

create policy "profiles_insert_gestor"
  on profiles for insert
  to authenticated
  with check (public.is_gestor());

-- clientes
create policy "clientes_select_authenticated"
  on clientes for select
  to authenticated
  using (deleted_at is null);

create policy "clientes_write_gestor"
  on clientes for all
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- projetos
create policy "projetos_select_authenticated"
  on projetos for select
  to authenticated
  using (deleted_at is null);

create policy "projetos_write_gestor"
  on projetos for all
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- revisoes
create policy "revisoes_select_authenticated"
  on revisoes for select
  to authenticated
  using (deleted_at is null);

create policy "revisoes_write_gestor"
  on revisoes for all
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- pendencias_externas
create policy "pendencias_select_authenticated"
  on pendencias_externas for select
  to authenticated
  using (deleted_at is null);

create policy "pendencias_write_gestor"
  on pendencias_externas for all
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- documentos_projeto
create policy "documentos_select_authenticated"
  on documentos_projeto for select
  to authenticated
  using (deleted_at is null);

create policy "documentos_write_gestor"
  on documentos_projeto for all
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- templates_checklist
create policy "templates_select_authenticated"
  on templates_checklist for select
  to authenticated
  using (deleted_at is null);

create policy "templates_write_gestor"
  on templates_checklist for all
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- tarefas
create policy "tarefas_select_authenticated"
  on tarefas for select
  to authenticated
  using (deleted_at is null);

create policy "tarefas_write_gestor"
  on tarefas for all
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- comentarios
create policy "comentarios_select_authenticated"
  on comentarios for select
  to authenticated
  using (deleted_at is null);

create policy "comentarios_write_gestor"
  on comentarios for all
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- registros_tempo
create policy "registros_tempo_select_authenticated"
  on registros_tempo for select
  to authenticated
  using (deleted_at is null);

create policy "registros_tempo_write_gestor"
  on registros_tempo for all
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- liberacoes_fase
create policy "liberacoes_select_authenticated"
  on liberacoes_fase for select
  to authenticated
  using (true);

create policy "liberacoes_write_gestor"
  on liberacoes_fase for all
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- activity_log
create policy "activity_log_select_authenticated"
  on activity_log for select
  to authenticated
  using (true);

create policy "activity_log_insert_authenticated"
  on activity_log for insert
  to authenticated
  with check (usuario_id = auth.uid());

create policy "activity_log_write_gestor"
  on activity_log for update
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

create policy "activity_log_delete_gestor"
  on activity_log for delete
  to authenticated
  using (public.is_gestor());
