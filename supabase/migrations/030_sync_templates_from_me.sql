-- Sync one-shot: biblioteca (templates_checklist) a partir do piloto ME.
-- Também expõe RPC reutilizável sync_templates_from_projeto (com assert_papel).
-- Não propaga alterações para outros projetos (só catálogo + religa manuais do próprio piloto).

create or replace function public._sync_templates_from_projeto_impl(p_projeto_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int := 0;
  v_deactivated int := 0;
  v_promoted int := 0;
  v_relinked int := 0;
  r record;
  v_tpl_id uuid;
  v_match_id uuid;
begin
  if p_projeto_id is null then
    raise exception 'p_projeto_id é obrigatório';
  end if;

  if not exists (
    select 1 from public.projetos
    where id = p_projeto_id and deleted_at is null
  ) then
    raise exception 'Projeto % não encontrado', p_projeto_id;
  end if;

  -- 1) UPDATE templates a partir das tarefas ligadas do piloto
  with src as (
    select
      t.template_id,
      t.nome,
      t.descricao,
      t.criticidade,
      t.origem,
      t.referencia_normativa,
      t.categoria,
      t.fase,
      t.ordem,
      t.metodologia_minima,
      t.disciplina
    from public.tarefas t
    where t.projeto_id = p_projeto_id
      and t.deleted_at is null
      and t.revisao_id is null
      and t.template_id is not null
  ),
  upd as (
    update public.templates_checklist tc
    set
      nome = src.nome,
      descricao = src.descricao,
      criticidade = src.criticidade,
      origem = src.origem,
      referencia_normativa = src.referencia_normativa,
      categoria = src.categoria,
      fase = src.fase,
      ordem = src.ordem,
      metodologia_minima = src.metodologia_minima,
      disciplina = src.disciplina,
      updated_at = now()
    from src
    where tc.id = src.template_id
      and tc.deleted_at is null
      and (
        coalesce(tc.nome, '') is distinct from coalesce(src.nome, '')
        or coalesce(tc.descricao, '') is distinct from coalesce(src.descricao, '')
        or tc.criticidade is distinct from src.criticidade
        or tc.origem is distinct from src.origem
        or coalesce(tc.referencia_normativa, '') is distinct from coalesce(src.referencia_normativa, '')
        or coalesce(tc.categoria, '') is distinct from coalesce(src.categoria, '')
        or tc.fase is distinct from src.fase
        or tc.ordem is distinct from src.ordem
        or tc.metodologia_minima is distinct from src.metodologia_minima
        or tc.disciplina is distinct from src.disciplina
      )
    returning tc.id
  )
  select count(*) into v_updated from upd;

  -- 2) Desativar templates ativos HID/PPCI sem tarefa correspondente no piloto
  with absent as (
    update public.templates_checklist tc
    set
      ativo = false,
      updated_at = now()
    where tc.deleted_at is null
      and tc.ativo = true
      and tc.disciplina in ('HID', 'PPCI')
      and not exists (
        select 1
        from public.tarefas t
        where t.projeto_id = p_projeto_id
          and t.deleted_at is null
          and t.revisao_id is null
          and t.template_id = tc.id
      )
    returning tc.id
  )
  select count(*) into v_deactivated from absent;

  -- 3) Promover tarefas manuais do piloto → templates (+ religar)
  for r in
    select
      t.id as tarefa_id,
      t.disciplina,
      t.fase,
      t.categoria,
      t.nome,
      t.descricao,
      t.criticidade,
      t.origem,
      t.referencia_normativa,
      t.ordem,
      t.metodologia_minima
    from public.tarefas t
    where t.projeto_id = p_projeto_id
      and t.deleted_at is null
      and t.revisao_id is null
      and t.template_id is null
  loop
    select tc.id
    into v_match_id
    from public.templates_checklist tc
    where tc.deleted_at is null
      and tc.disciplina = r.disciplina
      and tc.fase = r.fase
      and lower(trim(tc.nome)) = lower(trim(r.nome))
    order by tc.ativo desc, tc.updated_at desc nulls last
    limit 1;

    if v_match_id is not null then
      update public.templates_checklist
      set
        nome = r.nome,
        descricao = r.descricao,
        criticidade = coalesce(r.criticidade, 'normal'),
        origem = coalesce(r.origem, 'interno'),
        referencia_normativa = r.referencia_normativa,
        categoria = r.categoria,
        fase = r.fase,
        ordem = coalesce(r.ordem, 0),
        metodologia_minima = r.metodologia_minima,
        ativo = true,
        updated_at = now()
      where id = v_match_id;

      v_tpl_id := v_match_id;
      v_promoted := v_promoted + 1;
    else
      insert into public.templates_checklist (
        disciplina,
        fase,
        categoria,
        nome,
        descricao,
        criticidade,
        origem,
        referencia_normativa,
        executor_padrao,
        metodologia_minima,
        ordem,
        ativo
      )
      values (
        r.disciplina,
        r.fase,
        r.categoria,
        r.nome,
        r.descricao,
        coalesce(r.criticidade, 'normal'),
        coalesce(r.origem, 'interno'),
        r.referencia_normativa,
        'projetista',
        r.metodologia_minima,
        coalesce(r.ordem, 0),
        true
      )
      returning id into v_tpl_id;

      v_promoted := v_promoted + 1;
    end if;

    update public.tarefas
    set
      template_id = v_tpl_id,
      updated_at = now()
    where id = r.tarefa_id
      and template_id is null;

    if found then
      v_relinked := v_relinked + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'projeto_id', p_projeto_id,
    'templates_atualizados', v_updated,
    'templates_desativados', v_deactivated,
    'templates_promovidos', v_promoted,
    'tarefas_religadas', v_relinked
  );
end;
$$;

revoke all on function public._sync_templates_from_projeto_impl(uuid) from public;
revoke all on function public._sync_templates_from_projeto_impl(uuid) from anon, authenticated;

create or replace function public.sync_templates_from_projeto(p_projeto_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo']);
  return public._sync_templates_from_projeto_impl(p_projeto_id);
end;
$$;

grant execute on function public.sync_templates_from_projeto(uuid) to authenticated;

-- One-shot: piloto ME (MARINO ESTALEIRO)
do $$
declare
  v_result jsonb;
begin
  v_result := public._sync_templates_from_projeto_impl(
    '5738da74-39b9-4098-adb8-49fafac2a9f6'::uuid
  );
  raise notice 'sync ME → templates: %', v_result;
end;
$$;
