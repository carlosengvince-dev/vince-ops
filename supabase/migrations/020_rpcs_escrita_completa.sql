-- VINCE Ops — RPCs de escrita: pendencias_externas, revisoes, liberacoes_fase, documentos_projeto
-- Pré-requisitos no banco: public.assert_papel(text[]), upsert_cliente, delete_cliente
-- Executar no Supabase Dashboard ANTES de testar o app com as mudanças de código.

-- ---------------------------------------------------------------------------
-- pendencias_externas
-- ---------------------------------------------------------------------------

create or replace function public.upsert_pendencia(
  p_id uuid,
  p_projeto_id uuid default null,
  p_orgao text default null,
  p_tipo text default null,
  p_descricao text default null,
  p_prazo date default null,
  p_status text default null,
  p_data_recebimento date default null,
  p_tarefas_vinculadas uuid[] default null,
  p_revisao_gerada_id uuid default null,
  p_criado_por uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo']);

  if p_id is null then
    if p_projeto_id is null or p_orgao is null or p_tipo is null or p_descricao is null then
      raise exception 'Campos obrigatórios: p_projeto_id, p_orgao, p_tipo, p_descricao';
    end if;

    insert into pendencias_externas (
      projeto_id,
      orgao,
      tipo,
      descricao,
      prazo,
      status,
      data_recebimento,
      tarefas_vinculadas,
      revisao_gerada_id,
      criado_por
    ) values (
      p_projeto_id,
      p_orgao,
      p_tipo,
      p_descricao,
      p_prazo,
      coalesce(p_status, 'aberta'),
      p_data_recebimento,
      coalesce(p_tarefas_vinculadas, '{}'),
      p_revisao_gerada_id,
      coalesce(p_criado_por, auth.uid())
    )
    returning id into v_id;
  else
    update pendencias_externas
    set
      orgao = coalesce(p_orgao, orgao),
      tipo = coalesce(p_tipo, tipo),
      descricao = coalesce(p_descricao, descricao),
      prazo = coalesce(p_prazo, prazo),
      status = coalesce(p_status, status),
      data_recebimento = coalesce(p_data_recebimento, data_recebimento),
      tarefas_vinculadas = coalesce(p_tarefas_vinculadas, tarefas_vinculadas),
      revisao_gerada_id = coalesce(p_revisao_gerada_id, revisao_gerada_id),
      updated_at = now()
    where id = p_id
      and deleted_at is null
    returning id into v_id;

    if v_id is null then
      raise exception 'Pendência não encontrada ou já excluída: %', p_id;
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.delete_pendencia(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo']);

  update pendencias_externas
  set deleted_at = now(), updated_at = now()
  where id = p_id
    and deleted_at is null;

  if not found then
    raise exception 'Pendência não encontrada ou já excluída: %', p_id;
  end if;
end;
$$;

grant execute on function public.upsert_pendencia(
  uuid, uuid, text, text, text, date, text, date, uuid[], uuid, uuid
) to authenticated;
grant execute on function public.delete_pendencia(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- revisoes
-- ---------------------------------------------------------------------------

create or replace function public.upsert_revisao(
  p_id uuid,
  p_projeto_id uuid default null,
  p_numero text default null,
  p_disciplina text default null,
  p_origem text default null,
  p_descricao text default null,
  p_status text default null,
  p_data_conclusao date default null,
  p_criado_por uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo']);

  if p_id is null then
    if p_projeto_id is null or p_numero is null or p_disciplina is null or p_origem is null then
      raise exception 'Campos obrigatórios: p_projeto_id, p_numero, p_disciplina, p_origem';
    end if;

    insert into revisoes (
      projeto_id,
      numero,
      disciplina,
      origem,
      descricao,
      status,
      criado_por
    ) values (
      p_projeto_id,
      p_numero,
      p_disciplina,
      p_origem,
      p_descricao,
      coalesce(p_status, 'aberta'),
      coalesce(p_criado_por, auth.uid())
    )
    returning id into v_id;
  else
    update revisoes
    set
      numero = coalesce(p_numero, numero),
      disciplina = coalesce(p_disciplina, disciplina),
      origem = coalesce(p_origem, origem),
      descricao = coalesce(p_descricao, descricao),
      status = coalesce(p_status, status),
      data_conclusao = coalesce(p_data_conclusao, data_conclusao)
    where id = p_id
      and deleted_at is null
    returning id into v_id;

    if v_id is null then
      raise exception 'Revisão não encontrada ou já excluída: %', p_id;
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.delete_revisao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo']);

  update revisoes
  set deleted_at = now()
  where id = p_id
    and deleted_at is null;

  if not found then
    raise exception 'Revisão não encontrada ou já excluída: %', p_id;
  end if;
end;
$$;

grant execute on function public.upsert_revisao(
  uuid, uuid, text, text, text, text, text, date, uuid
) to authenticated;
grant execute on function public.delete_revisao(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- liberacoes_fase (somente insert)
-- ---------------------------------------------------------------------------

create or replace function public.insert_liberacao_fase(
  p_projeto_id uuid,
  p_disciplina text,
  p_fase_liberada text,
  p_liberado_por uuid,
  p_justificativa text,
  p_tarefas_pendentes_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo']);

  insert into liberacoes_fase (
    projeto_id,
    disciplina,
    fase_liberada,
    liberado_por,
    justificativa,
    tarefas_pendentes_ids
  ) values (
    p_projeto_id,
    p_disciplina,
    p_fase_liberada,
    p_liberado_por,
    p_justificativa,
    coalesce(p_tarefas_pendentes_ids, '{}')
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.insert_liberacao_fase(
  uuid, text, text, uuid, text, uuid[]
) to authenticated;

-- ---------------------------------------------------------------------------
-- documentos_projeto (projetista pode marcar documento como recebido)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_documento_projeto(
  p_id uuid,
  p_projeto_id uuid default null,
  p_disciplina text default null,
  p_nome text default null,
  p_tipo text default null,
  p_status text default null,
  p_critico boolean default null,
  p_observacoes text default null,
  p_data_recebimento date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo', 'projetista']);

  if p_id is null then
    if p_projeto_id is null or p_nome is null or p_tipo is null then
      raise exception 'Campos obrigatórios: p_projeto_id, p_nome, p_tipo';
    end if;

    insert into documentos_projeto (
      projeto_id,
      disciplina,
      nome,
      tipo,
      status,
      critico,
      observacoes,
      data_recebimento
    ) values (
      p_projeto_id,
      p_disciplina,
      p_nome,
      p_tipo,
      coalesce(p_status, 'aguardando'),
      coalesce(p_critico, false),
      p_observacoes,
      p_data_recebimento
    )
    returning id into v_id;
  else
    update documentos_projeto
    set
      disciplina = coalesce(p_disciplina, disciplina),
      nome = coalesce(p_nome, nome),
      tipo = coalesce(p_tipo, tipo),
      status = coalesce(p_status, status),
      critico = coalesce(p_critico, critico),
      observacoes = coalesce(p_observacoes, observacoes),
      data_recebimento = coalesce(p_data_recebimento, data_recebimento)
    where id = p_id
      and deleted_at is null
    returning id into v_id;

    if v_id is null then
      raise exception 'Documento não encontrado ou já excluído: %', p_id;
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.delete_documento_projeto(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_papel(array['gestor', 'diretor_executivo']);

  update documentos_projeto
  set deleted_at = now()
  where id = p_id
    and deleted_at is null;

  if not found then
    raise exception 'Documento não encontrado ou já excluído: %', p_id;
  end if;
end;
$$;

grant execute on function public.upsert_documento_projeto(
  uuid, uuid, text, text, text, text, boolean, text, date
) to authenticated;
grant execute on function public.delete_documento_projeto(uuid) to authenticated;
