-- ═══════════════════════════════════════════════
-- 022a — Unicidade só entre registros vivos
-- (corrige: recriar fase/categoria com nome de excluída)
-- ═══════════════════════════════════════════════

alter table fases_config
  drop constraint if exists fases_config_disciplina_codigo_key;
create unique index if not exists fases_config_codigo_vivo
  on fases_config (disciplina, codigo)
  where deleted_at is null;

alter table categorias_config
  drop constraint if exists categorias_config_disciplina_nome_key;
create unique index if not exists categorias_config_nome_vivo
  on categorias_config (disciplina, nome)
  where deleted_at is null;

-- RPCs que usavam ON CONFLICT na constraint antiga
-- precisam apontar para o índice parcial:

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
    on conflict (disciplina, nome) where deleted_at is null
    do update set ativo = true
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

create or replace function public.sync_categoria_vinculo()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_cat_id uuid;
begin
  if new.categoria is null or btrim(new.categoria) = '' then
    raise exception 'Tarefa precisa de uma categoria definida';
  end if;

  select id into v_cat_id from categorias_config
  where disciplina = new.disciplina and nome = new.categoria
    and deleted_at is null;

  if v_cat_id is null then
    insert into categorias_config (disciplina, nome, sistema)
    values (new.disciplina, new.categoria, false)
    on conflict (disciplina, nome) where deleted_at is null
    do update set ativo = true
    returning id into v_cat_id;
  end if;

  new.categoria_id := v_cat_id;
  return new;
end;
$$;

create or replace function public.duplicar_fase_disciplina(
  p_fase_codigo text,
  p_disciplina_origem text,
  p_disciplina_destino text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tpls int := 0;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  insert into categorias_config (disciplina, nome, sistema, ordem)
  select distinct p_disciplina_destino, t.categoria, false, 0
  from templates_checklist t
  where t.disciplina = p_disciplina_origem and t.fase = p_fase_codigo
    and t.deleted_at is null and t.ativo = true
  on conflict (disciplina, nome) where deleted_at is null do nothing;

  insert into templates_checklist (
    disciplina, fase, categoria, nome, descricao, criticidade,
    origem, referencia_normativa, executor_padrao,
    metodologia_minima, ordem, ativo
  )
  select p_disciplina_destino, t.fase, t.categoria, t.nome,
    t.descricao, t.criticidade, t.origem, t.referencia_normativa,
    t.executor_padrao, t.metodologia_minima, t.ordem, t.ativo
  from templates_checklist t
  where t.disciplina = p_disciplina_origem and t.fase = p_fase_codigo
    and t.deleted_at is null and t.ativo = true
    and not exists (
      select 1 from templates_checklist d
      where d.disciplina = p_disciplina_destino
        and d.fase = t.fase and d.nome = t.nome
        and d.deleted_at is null
    );
  get diagnostics v_tpls = row_count;

  return jsonb_build_object('templates_copiados', v_tpls);
end;
$$;

-- ═══════════════════════════════════════════════
-- 022b — Remover travas arbitrárias das fases
-- Ficam só proteções de integridade real
-- ═══════════════════════════════════════════════

update fases_config set obrigatoria = false;

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
    -- Proteção 1: não desativar fase onde algum projeto está agora
    if p_ativo = false and exists (
      select 1 from projetos p
      join fases_config f on f.id = p_id
      where p.deleted_at is null
        and p.status in ('ativo','em_revisao')
        and p.fases_atuais->>f.disciplina = f.codigo
    ) then
      raise exception 'Há projetos atualmente nesta fase. Avance-os antes de desativá-la.';
    end if;

    update fases_config set
      label = p_label, ordem = p_ordem, ativo = p_ativo,
      updated_at = now()
    where id = p_id and deleted_at is null;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.delete_fase_config(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_disc text;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  select disciplina into v_disc from fases_config
  where id = p_id and deleted_at is null;
  if v_disc is null then
    raise exception 'Fase não encontrada';
  end if;

  -- Proteção 1: projetos atualmente nesta fase
  if exists (
    select 1 from projetos p
    join fases_config f on f.id = p_id
    where p.deleted_at is null
      and p.status in ('ativo','em_revisao')
      and p.fases_atuais->>f.disciplina = f.codigo
  ) then
    raise exception 'Há projetos atualmente nesta fase. Avance-os antes de excluí-la.';
  end if;

  -- Proteção 2: disciplina precisa de ao menos 1 fase viva
  if (select count(*) from fases_config
      where disciplina = v_disc and deleted_at is null
        and ativo = true and id <> p_id) = 0 then
    raise exception 'A disciplina precisa de ao menos uma fase ativa.';
  end if;

  update fases_config set deleted_at = now() where id = p_id;
end;
$$;

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

  -- Única proteção: não desativar a fase ATUAL do projeto
  if p_ativa = false and exists (
    select 1 from projetos p
    join fases_config f on f.id = p_fase_config_id
    where p.id = p_projeto_id
      and p.fases_atuais->>f.disciplina = f.codigo
  ) then
    raise exception 'Esta é a fase atual do projeto. Avance ou retorne antes de desativá-la.';
  end if;

  insert into projeto_fases (projeto_id, fase_config_id, ativa)
  values (p_projeto_id, p_fase_config_id, p_ativa)
  on conflict (projeto_id, fase_config_id)
  do update set ativa = excluded.ativa, updated_at = now();
end;
$$;

-- ═══════════════════════════════════════════════
-- 022c — Disciplinas como entidade configurável
-- ═══════════════════════════════════════════════

create table if not exists disciplinas_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizacoes(id),
  codigo text not null,          -- ID interno imutável (HID, PPCI, SPK, custom)
  nome text not null,            -- Nome exibido (editável)
  cor_bg text not null default '#F3F4F6',
  cor_texto text not null default '#374151',
  ordem integer not null default 0,
  sistema boolean not null default false,
  ativo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists disciplinas_config_codigo_vivo
  on disciplinas_config (codigo)
  where deleted_at is null;

insert into disciplinas_config (codigo, nome, cor_bg, cor_texto, ordem, sistema) values
  ('HID', 'Hidrossanitário', '#DBEAFE', '#1D4ED8', 0, true),
  ('PPCI', 'PPCI', '#FEE2E2', '#DC2626', 1, true),
  ('SPK', 'Sprinkler', '#D1FAE5', '#16A34A', 2, true)
on conflict (codigo) where deleted_at is null do nothing;

alter table disciplinas_config enable row level security;
create policy "disciplinas_config_select" on disciplinas_config
  for select to authenticated using (deleted_at is null);
-- Sem policy de write. RPC é o caminho.

create or replace function public.upsert_disciplina_config(
  p_id uuid,
  p_codigo text,
  p_nome text,
  p_cor_bg text default '#F3F4F6',
  p_cor_texto text default '#374151',
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
    insert into disciplinas_config (codigo, nome, cor_bg, cor_texto, ordem, sistema, ativo)
    values (p_codigo, p_nome, p_cor_bg, p_cor_texto, p_ordem, false, p_ativo)
    returning id into v_id;
  else
    update disciplinas_config set
      nome = p_nome, cor_bg = p_cor_bg, cor_texto = p_cor_texto,
      ordem = p_ordem, ativo = p_ativo, updated_at = now()
    where id = p_id and deleted_at is null;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.delete_disciplina_config(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_cod text;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  select codigo into v_cod from disciplinas_config
  where id = p_id and deleted_at is null;
  if v_cod is null then
    raise exception 'Disciplina não encontrada';
  end if;

  -- Proteção: projetos ativos usando a disciplina
  if exists (
    select 1 from projetos p
    where p.deleted_at is null
      and p.status in ('ativo','em_revisao')
      and v_cod = any(p.disciplinas)
  ) then
    raise exception 'Há projetos ativos usando esta disciplina. Remova-a dos projetos antes.';
  end if;

  update disciplinas_config set deleted_at = now() where id = p_id;
end;
$$;

-- Copiar estrutura completa (fases + categorias + templates)
-- de uma disciplina para outra — usado ao criar disciplina nova
create or replace function public.copiar_estrutura_disciplina(
  p_origem text,
  p_destino text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_fases int := 0;
  v_cats int := 0;
  v_tpls int := 0;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  insert into fases_config (disciplina, codigo, label, ordem, obrigatoria, sistema, ativo)
  select p_destino, f.codigo, f.label, f.ordem, false, false, f.ativo
  from fases_config f
  where f.disciplina = p_origem and f.deleted_at is null
  on conflict (disciplina, codigo) where deleted_at is null do nothing;
  get diagnostics v_fases = row_count;

  insert into categorias_config (disciplina, nome, ordem, sistema, ativo)
  select p_destino, c.nome, c.ordem, false, c.ativo
  from categorias_config c
  where c.disciplina = p_origem and c.deleted_at is null
  on conflict (disciplina, nome) where deleted_at is null do nothing;
  get diagnostics v_cats = row_count;

  insert into templates_checklist (
    disciplina, fase, categoria, nome, descricao, criticidade,
    origem, referencia_normativa, executor_padrao,
    metodologia_minima, ordem, ativo
  )
  select p_destino, t.fase, t.categoria, t.nome, t.descricao,
    t.criticidade, t.origem, t.referencia_normativa,
    t.executor_padrao, t.metodologia_minima, t.ordem, t.ativo
  from templates_checklist t
  where t.disciplina = p_origem and t.deleted_at is null and t.ativo = true;
  get diagnostics v_tpls = row_count;

  return jsonb_build_object(
    'fases', v_fases, 'categorias', v_cats, 'templates', v_tpls
  );
end;
$$;