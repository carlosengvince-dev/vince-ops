-- One-shot: restaurar status/conclusão e remapar registros_tempo do ORO
-- das tarefas soft-deleted para as tarefas novas (match por template_id).
-- NÃO altera o projeto ME.

do $$
declare
  v_oro uuid;
  v_me uuid;
  v_me_before int;
  v_me_after int;
  v_status_restored int;
  v_horas_moved int;
begin
  select id into v_oro from public.projetos where codigo = 'ORO' and deleted_at is null;
  select id into v_me from public.projetos where codigo = 'ME' and deleted_at is null;

  if v_oro is null then
    raise exception 'Projeto ORO nao encontrado';
  end if;
  if v_me is null then
    raise exception 'Projeto ME nao encontrado';
  end if;

  select count(*) into v_me_before
  from public.tarefas where projeto_id = v_me and deleted_at is null;

  with map as (
    select
      o.id as old_id,
      n.id as new_id,
      o.status,
      o.data_conclusao,
      o.responsavel_id,
      o.motivo_bloqueio,
      o.updated_by
    from public.tarefas o
    join public.tarefas n
      on n.projeto_id = o.projeto_id
     and n.deleted_at is null
     and n.template_id = o.template_id
    where o.projeto_id = v_oro
      and o.deleted_at is not null
      and o.template_id is not null
      and o.status is distinct from 'pendente'
  )
  update public.tarefas t
  set
    status = m.status,
    data_conclusao = m.data_conclusao,
    responsavel_id = m.responsavel_id,
    motivo_bloqueio = m.motivo_bloqueio,
    updated_at = now(),
    updated_by = m.updated_by
  from map m
  where t.id = m.new_id
    and t.deleted_at is null
    and t.status = 'pendente';

  get diagnostics v_status_restored = row_count;

  with map as (
    select o.id as old_id, n.id as new_id
    from public.tarefas o
    join public.tarefas n
      on n.projeto_id = o.projeto_id
     and n.deleted_at is null
     and n.template_id = o.template_id
    where o.projeto_id = v_oro
      and o.deleted_at is not null
      and o.template_id is not null
  )
  update public.registros_tempo rt
  set tarefa_id = m.new_id
  from map m
  where rt.tarefa_id = m.old_id
    and rt.projeto_id = v_oro
    and rt.deleted_at is null;

  get diagnostics v_horas_moved = row_count;

  select count(*) into v_me_after
  from public.tarefas where projeto_id = v_me and deleted_at is null;

  if v_me_after <> v_me_before then
    raise exception 'ME mudou (% -> %) — rollback', v_me_before, v_me_after;
  end if;

  raise notice 'OK status_restored=% horas_moved=% ME=%',
    v_status_restored, v_horas_moved, v_me_after;
end $$;
