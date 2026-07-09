-- ═══════════════════════════════════════════════
-- 024a — Excluir categoria com escopo (cascata opcional)
-- ═══════════════════════════════════════════════

-- Assinatura muda: dropar a antiga para não criar sobrecarga
drop function if exists public.delete_categoria_config(uuid);

create or replace function public.delete_categoria_config(
  p_id uuid,
  p_excluir_templates boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_nome text;
  v_disc text;
  v_tpls int := 0;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  select nome, disciplina into v_nome, v_disc
  from categorias_config where id = p_id and deleted_at is null;
  if v_nome is null then
    raise exception 'Categoria não encontrada';
  end if;

  update categorias_config set deleted_at = now() where id = p_id;

  if p_excluir_templates then
    update templates_checklist
    set deleted_at = now(), updated_at = now()
    where categoria = v_nome and disciplina = v_disc
      and deleted_at is null;
    get diagnostics v_tpls = row_count;
  end if;

  return jsonb_build_object('templates_excluidos', v_tpls);
end;
$$;

-- ═══════════════════════════════════════════════
-- 024b — Snapshots de configuração (padrões nomeados)
-- ═══════════════════════════════════════════════

create table if not exists config_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizacoes(id),
  nome text not null,
  automatico boolean not null default false,
  dados jsonb not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table config_snapshots enable row level security;
create policy "config_snapshots_select" on config_snapshots
  for select to authenticated using (true);
-- Sem policy de write. RPC é o caminho.

-- Fotografa o estado atual de toda a configuração
create or replace function public.salvar_config_snapshot(
  p_nome text,
  p_automatico boolean default false
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_dados jsonb;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  v_dados := jsonb_build_object(
    'disciplinas', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
      from disciplinas_config d where d.deleted_at is null),
    'fases', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
      from fases_config f where f.deleted_at is null),
    'categorias', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      from categorias_config c where c.deleted_at is null),
    'templates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      from templates_checklist t where t.deleted_at is null),
    'configuracoes', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
      from configuracoes g)
  );

  insert into config_snapshots (nome, automatico, dados, created_by)
  values (p_nome, p_automatico, v_dados, (select auth.uid()))
  returning id into v_id;

  return v_id;
end;
$$;

-- Restaura um snapshot.
-- Segurança dupla: cria snapshot automático do estado atual ANTES.
-- Upsert por id (restaura valores, ressuscita excluídos).
-- Soft-deleta itens vivos ausentes do snapshot,
-- PULANDO os protegidos por integridade (reportados no retorno).
create or replace function public.restaurar_config_snapshot(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_dados jsonb;
  v_nome text;
  rec record;
  v_del_fases int := 0;
  v_del_cats int := 0;
  v_del_tpls int := 0;
  v_del_discs int := 0;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  select nome, dados into v_nome, v_dados
  from config_snapshots where id = p_id;
  if v_dados is null then
    raise exception 'Snapshot não encontrado';
  end if;

  -- Rede de segurança: fotografa o estado atual antes de mexer
  perform public.salvar_config_snapshot(
    'Antes de restaurar: ' || v_nome, true);

  -- DISCIPLINAS
  for rec in select * from jsonb_to_recordset(v_dados->'disciplinas')
    as x(id uuid, codigo text, nome text, cor_bg text, cor_texto text,
         ordem int, sistema boolean, ativo boolean)
  loop
    insert into disciplinas_config
      (id, codigo, nome, cor_bg, cor_texto, ordem, sistema, ativo)
    values (rec.id, rec.codigo, rec.nome, rec.cor_bg, rec.cor_texto,
            rec.ordem, rec.sistema, rec.ativo)
    on conflict (id) do update set
      nome = excluded.nome, cor_bg = excluded.cor_bg,
      cor_texto = excluded.cor_texto, ordem = excluded.ordem,
      ativo = excluded.ativo, deleted_at = null, updated_at = now();
  end loop;

  update disciplinas_config d set deleted_at = now()
  where d.deleted_at is null
    and not (d.id in (select (x->>'id')::uuid
      from jsonb_array_elements(v_dados->'disciplinas') x))
    and not exists (
      select 1 from projetos p
      where p.deleted_at is null and p.status in ('ativo','em_revisao')
        and d.codigo = any(p.disciplinas)
    );
  get diagnostics v_del_discs = row_count;

  -- FASES
  for rec in select * from jsonb_to_recordset(v_dados->'fases')
    as x(id uuid, disciplina text, codigo text, label text, ordem int,
         obrigatoria boolean, sistema boolean, ativo boolean)
  loop
    insert into fases_config
      (id, disciplina, codigo, label, ordem, obrigatoria, sistema, ativo)
    values (rec.id, rec.disciplina, rec.codigo, rec.label, rec.ordem,
            rec.obrigatoria, rec.sistema, rec.ativo)
    on conflict (id) do update set
      label = excluded.label, ordem = excluded.ordem,
      ativo = excluded.ativo, deleted_at = null, updated_at = now();
  end loop;

  update fases_config f set deleted_at = now()
  where f.deleted_at is null
    and not (f.id in (select (x->>'id')::uuid
      from jsonb_array_elements(v_dados->'fases') x))
    and not exists (
      select 1 from projetos p
      where p.deleted_at is null and p.status in ('ativo','em_revisao')
        and p.fases_atuais->>f.disciplina = f.codigo
    );
  get diagnostics v_del_fases = row_count;

  -- CATEGORIAS
  for rec in select * from jsonb_to_recordset(v_dados->'categorias')
    as x(id uuid, disciplina text, nome text, ordem int,
         sistema boolean, ativo boolean)
  loop
    insert into categorias_config
      (id, disciplina, nome, ordem, sistema, ativo)
    values (rec.id, rec.disciplina, rec.nome, rec.ordem,
            rec.sistema, rec.ativo)
    on conflict (id) do update set
      nome = excluded.nome, ordem = excluded.ordem,
      ativo = excluded.ativo, deleted_at = null, updated_at = now();
  end loop;

  update categorias_config c set deleted_at = now()
  where c.deleted_at is null
    and not (c.id in (select (x->>'id')::uuid
      from jsonb_array_elements(v_dados->'categorias') x));
  get diagnostics v_del_cats = row_count;

  -- TEMPLATES
  for rec in select * from jsonb_to_recordset(v_dados->'templates')
    as x(id uuid, disciplina text, fase text, categoria text, nome text,
         descricao text, criticidade text, origem text,
         referencia_normativa text, executor_padrao text,
         metodologia_minima text, ordem int, ativo boolean)
  loop
    insert into templates_checklist
      (id, disciplina, fase, categoria, nome, descricao, criticidade,
       origem, referencia_normativa, executor_padrao,
       metodologia_minima, ordem, ativo)
    values (rec.id, rec.disciplina, rec.fase, rec.categoria, rec.nome,
            rec.descricao, rec.criticidade, rec.origem,
            rec.referencia_normativa, rec.executor_padrao,
            rec.metodologia_minima, rec.ordem, rec.ativo)
    on conflict (id) do update set
      fase = excluded.fase, categoria = excluded.categoria,
      nome = excluded.nome, descricao = excluded.descricao,
      criticidade = excluded.criticidade, origem = excluded.origem,
      referencia_normativa = excluded.referencia_normativa,
      executor_padrao = excluded.executor_padrao,
      metodologia_minima = excluded.metodologia_minima,
      ordem = excluded.ordem, ativo = excluded.ativo,
      deleted_at = null, updated_at = now();
  end loop;

  update templates_checklist t set deleted_at = now()
  where t.deleted_at is null
    and not (t.id in (select (x->>'id')::uuid
      from jsonb_array_elements(v_dados->'templates') x));
  get diagnostics v_del_tpls = row_count;

  -- CONFIGURACOES (chave/valor)
  for rec in select * from jsonb_to_recordset(v_dados->'configuracoes')
    as x(chave text, valor jsonb)
  loop
    insert into configuracoes (chave, valor, updated_by)
    values (rec.chave, rec.valor, (select auth.uid()))
    on conflict (chave) do update set
      valor = excluded.valor, updated_at = now(),
      updated_by = (select auth.uid());
  end loop;

  return jsonb_build_object(
    'disciplinas_removidas', v_del_discs,
    'fases_removidas', v_del_fases,
    'categorias_removidas', v_del_cats,
    'templates_removidos', v_del_tpls
  );
end;
$$;