-- Inclui responsavel_tecnico_id no patch_projeto (antes a coluna era ignorada no vínculo).

create or replace function public.patch_projeto(p_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  update projetos set
    cliente_id = case when p_patch ? 'cliente_id'
      then (p_patch->>'cliente_id')::uuid else cliente_id end,
    responsavel_tecnico_id = case when p_patch ? 'responsavel_tecnico_id'
      then (p_patch->>'responsavel_tecnico_id')::uuid else responsavel_tecnico_id end,
    fases_atuais = case when p_patch ? 'fases_atuais'
      then (p_patch->'fases_atuais') else fases_atuais end,
    status = case when p_patch ? 'status'
      then (p_patch->>'status') else status end,
    endereco = case when p_patch ? 'endereco'
      then (p_patch->>'endereco') else endereco end,
    tipo_edificacao = case when p_patch ? 'tipo_edificacao'
      then (p_patch->>'tipo_edificacao') else tipo_edificacao end,
    metadata = case when p_patch ? 'metadata'
      then (p_patch->'metadata') else metadata end,
    justificativa_cancelamento = case when p_patch ? 'justificativa_cancelamento'
      then (p_patch->>'justificativa_cancelamento') else justificativa_cancelamento end,
    data_conclusao_real = case when p_patch ? 'data_conclusao_real'
      then (p_patch->>'data_conclusao_real')::date else data_conclusao_real end,
    snapshot_fechamento = case when p_patch ? 'snapshot_fechamento'
      then (p_patch->'snapshot_fechamento') else snapshot_fechamento end,
    disciplinas = case when p_patch ? 'disciplinas'
      then (select array_agg(x) from jsonb_array_elements_text(p_patch->'disciplinas') x)
      else disciplinas end,
    metodologia = case when p_patch ? 'metodologia'
      then (p_patch->'metodologia') else metodologia end,
    responsaveis = case when p_patch ? 'responsaveis'
      then (p_patch->'responsaveis') else responsaveis end,
    updated_at = now()
  where id = p_id and deleted_at is null;
end;
$function$;
