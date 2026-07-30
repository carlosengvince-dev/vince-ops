-- Fase 2 biblioteca: promover / atualizar / desvincular tarefa ↔ template.
-- Não altera outros projetos; só catálogo + a tarefa alvo.
-- Projetos concluido/cancelado: bloqueados.

create or replace function public.promote_tarefa_to_template(p_tarefa_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarefas%rowtype;
  v_status text;
  v_match_id uuid;
  v_tpl_id uuid;
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo']);

  select * into t
  from public.tarefas
  where id = p_tarefa_id and deleted_at is null;

  if not found then
    raise exception 'Tarefa não encontrada';
  end if;

  select p.status into v_status
  from public.projetos p
  where p.id = t.projeto_id and p.deleted_at is null;

  if v_status is null then
    raise exception 'Projeto da tarefa não encontrado';
  end if;

  if v_status not in ('ativo', 'em_revisao') then
    raise exception 'Só é possível alterar a biblioteca a partir de projetos ativos ou em revisão';
  end if;

  if t.template_id is not null then
    -- Já vinculada: atualiza o template e devolve o id
    update public.templates_checklist
    set
      nome = t.nome,
      descricao = t.descricao,
      criticidade = coalesce(t.criticidade, 'normal'),
      origem = coalesce(t.origem, 'interno'),
      referencia_normativa = t.referencia_normativa,
      categoria = t.categoria,
      fase = t.fase,
      ordem = coalesce(t.ordem, 0),
      metodologia_minima = t.metodologia_minima,
      disciplina = t.disciplina,
      ativo = true,
      updated_at = now()
    where id = t.template_id
      and deleted_at is null;

    if not found then
      raise exception 'Template vinculado não encontrado ou excluído';
    end if;

    return t.template_id;
  end if;

  select tc.id into v_match_id
  from public.templates_checklist tc
  where tc.deleted_at is null
    and tc.disciplina = t.disciplina
    and tc.fase = t.fase
    and lower(trim(tc.nome)) = lower(trim(t.nome))
  order by tc.ativo desc, tc.updated_at desc nulls last
  limit 1;

  if v_match_id is not null then
    update public.templates_checklist
    set
      nome = t.nome,
      descricao = t.descricao,
      criticidade = coalesce(t.criticidade, 'normal'),
      origem = coalesce(t.origem, 'interno'),
      referencia_normativa = t.referencia_normativa,
      categoria = t.categoria,
      fase = t.fase,
      ordem = coalesce(t.ordem, 0),
      metodologia_minima = t.metodologia_minima,
      ativo = true,
      updated_at = now()
    where id = v_match_id;

    v_tpl_id := v_match_id;
  else
    insert into public.templates_checklist (
      disciplina, fase, categoria, nome, descricao, criticidade, origem,
      referencia_normativa, executor_padrao, metodologia_minima, ordem, ativo
    ) values (
      t.disciplina, t.fase, t.categoria, t.nome, t.descricao,
      coalesce(t.criticidade, 'normal'), coalesce(t.origem, 'interno'),
      t.referencia_normativa, 'projetista', t.metodologia_minima,
      coalesce(t.ordem, 0), true
    )
    returning id into v_tpl_id;
  end if;

  update public.tarefas
  set template_id = v_tpl_id, updated_at = now()
  where id = t.id;

  return v_tpl_id;
end;
$$;

create or replace function public.push_tarefa_to_template(p_tarefa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarefas%rowtype;
  v_status text;
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo']);

  select * into t
  from public.tarefas
  where id = p_tarefa_id and deleted_at is null;

  if not found then
    raise exception 'Tarefa não encontrada';
  end if;

  if t.template_id is null then
    raise exception 'Tarefa sem vínculo com a biblioteca. Use promover primeiro.';
  end if;

  select p.status into v_status
  from public.projetos p
  where p.id = t.projeto_id and p.deleted_at is null;

  if v_status is null or v_status not in ('ativo', 'em_revisao') then
    raise exception 'Só é possível alterar a biblioteca a partir de projetos ativos ou em revisão';
  end if;

  update public.templates_checklist
  set
    nome = t.nome,
    descricao = t.descricao,
    criticidade = coalesce(t.criticidade, 'normal'),
    origem = coalesce(t.origem, 'interno'),
    referencia_normativa = t.referencia_normativa,
    categoria = t.categoria,
    fase = t.fase,
    ordem = coalesce(t.ordem, 0),
    metodologia_minima = t.metodologia_minima,
    disciplina = t.disciplina,
    updated_at = now()
  where id = t.template_id
    and deleted_at is null;

  if not found then
    raise exception 'Template vinculado não encontrado ou excluído';
  end if;
end;
$$;

create or replace function public.unlink_tarefa_template(p_tarefa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarefas%rowtype;
  v_status text;
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo']);

  select * into t
  from public.tarefas
  where id = p_tarefa_id and deleted_at is null;

  if not found then
    raise exception 'Tarefa não encontrada';
  end if;

  select p.status into v_status
  from public.projetos p
  where p.id = t.projeto_id and p.deleted_at is null;

  if v_status is null or v_status not in ('ativo', 'em_revisao') then
    raise exception 'Só é possível desvincular em projetos ativos ou em revisão';
  end if;

  update public.tarefas
  set template_id = null, updated_at = now()
  where id = t.id;
end;
$$;

grant execute on function public.promote_tarefa_to_template(uuid) to authenticated;
grant execute on function public.push_tarefa_to_template(uuid) to authenticated;
grant execute on function public.unlink_tarefa_template(uuid) to authenticated;
