-- Fase 3: aplicar template da biblioteca em tarefas de projetos ativo/em_revisão.
-- Sempre explícito; nunca cria tarefas novas — só atualiza as que já têm template_id.

create or replace function public.preview_apply_template_to_projetos(p_template_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_projetos int;
  v_tarefas int;
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo']);

  if not exists (
    select 1 from public.templates_checklist
    where id = p_template_id and deleted_at is null
  ) then
    raise exception 'Template não encontrado';
  end if;

  select
    count(distinct t.projeto_id)::int,
    count(*)::int
  into v_projetos, v_tarefas
  from public.tarefas t
  join public.projetos p on p.id = t.projeto_id
  where t.template_id = p_template_id
    and t.deleted_at is null
    and t.revisao_id is null
    and p.deleted_at is null
    and p.status in ('ativo', 'em_revisao');

  return jsonb_build_object(
    'template_id', p_template_id,
    'projetos', coalesce(v_projetos, 0),
    'tarefas', coalesce(v_tarefas, 0)
  );
end;
$$;

create or replace function public.apply_template_to_projetos(
  p_template_id uuid,
  p_escopo text default 'conteudo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tc public.templates_checklist%rowtype;
  v_updated int := 0;
  v_projetos int := 0;
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo']);

  if p_escopo is null or p_escopo not in ('conteudo', 'conteudo_e_colocacao') then
    raise exception 'Escopo inválido. Use conteudo ou conteudo_e_colocacao';
  end if;

  select * into tc
  from public.templates_checklist
  where id = p_template_id and deleted_at is null;

  if not found then
    raise exception 'Template não encontrado';
  end if;

  if p_escopo = 'conteudo' then
    with touched as (
      update public.tarefas t
      set
        nome = tc.nome,
        descricao = tc.descricao,
        criticidade = tc.criticidade,
        origem = tc.origem,
        referencia_normativa = tc.referencia_normativa,
        metodologia_minima = tc.metodologia_minima,
        updated_at = now()
      from public.projetos p
      where t.projeto_id = p.id
        and t.template_id = tc.id
        and t.deleted_at is null
        and t.revisao_id is null
        and p.deleted_at is null
        and p.status in ('ativo', 'em_revisao')
      returning t.projeto_id
    )
    select count(*)::int, count(distinct projeto_id)::int
    into v_updated, v_projetos
    from touched;
  else
    with touched as (
      update public.tarefas t
      set
        nome = tc.nome,
        descricao = tc.descricao,
        criticidade = tc.criticidade,
        origem = tc.origem,
        referencia_normativa = tc.referencia_normativa,
        metodologia_minima = tc.metodologia_minima,
        categoria = tc.categoria,
        fase = tc.fase,
        ordem = tc.ordem,
        disciplina = tc.disciplina,
        updated_at = now()
      from public.projetos p
      where t.projeto_id = p.id
        and t.template_id = tc.id
        and t.deleted_at is null
        and t.revisao_id is null
        and p.deleted_at is null
        and p.status in ('ativo', 'em_revisao')
      returning t.projeto_id
    )
    select count(*)::int, count(distinct projeto_id)::int
    into v_updated, v_projetos
    from touched;
  end if;

  return jsonb_build_object(
    'template_id', p_template_id,
    'escopo', p_escopo,
    'tarefas_atualizadas', coalesce(v_updated, 0),
    'projetos_afetados', coalesce(v_projetos, 0)
  );
end;
$$;

grant execute on function public.preview_apply_template_to_projetos(uuid) to authenticated;
grant execute on function public.apply_template_to_projetos(uuid, text) to authenticated;
