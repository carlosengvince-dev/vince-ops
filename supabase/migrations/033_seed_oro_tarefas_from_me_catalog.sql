-- One-shot: repovoar checklist do ORO a partir do conjunto vivo do ME,
-- usando conteúdo atual da biblioteca (templates_checklist).
-- NÃO altera tarefas do ME (somente SELECT no filtro EXISTS).
-- Seguro para reexecutar: só insere se ORO estiver com 0 tarefas vivas.

do $$
declare
  v_me uuid;
  v_oro uuid;
  v_me_before int;
  v_oro_before int;
  v_inserted int;
  v_me_after int;
  v_oro_after int;
begin
  select id into v_me from public.projetos where codigo = 'ME' and deleted_at is null;
  select id into v_oro from public.projetos where codigo = 'ORO' and deleted_at is null;

  if v_me is null then
    raise exception 'Projeto ME nao encontrado';
  end if;
  if v_oro is null then
    raise exception 'Projeto ORO nao encontrado';
  end if;

  select count(*) into v_me_before
  from public.tarefas where projeto_id = v_me and deleted_at is null;

  select count(*) into v_oro_before
  from public.tarefas where projeto_id = v_oro and deleted_at is null;

  if v_oro_before <> 0 then
    raise notice 'ORO ja tem % tarefas vivas — nada a fazer', v_oro_before;
    return;
  end if;

  insert into public.tarefas (
    projeto_id,
    revisao_id,
    template_id,
    disciplina,
    fase,
    categoria,
    nome,
    descricao,
    criticidade,
    origem,
    referencia_normativa,
    metodologia_minima,
    ordem,
    status,
    motivo_bloqueio,
    responsavel_id,
    data_conclusao,
    deleted_at,
    categoria_id
  )
  select
    v_oro,
    null,
    tc.id,
    tc.disciplina,
    tc.fase,
    tc.categoria,
    tc.nome,
    tc.descricao,
    tc.criticidade,
    tc.origem,
    tc.referencia_normativa,
    tc.metodologia_minima,
    tc.ordem,
    'pendente',
    null,
    null,
    null,
    null,
    tc.categoria_id
  from public.templates_checklist tc
  where tc.deleted_at is null
    and tc.ativo = true
    and exists (
      select 1
      from public.tarefas mt
      where mt.projeto_id = v_me
        and mt.deleted_at is null
        and mt.template_id = tc.id
    )
    and not exists (
      select 1
      from public.tarefas ot
      where ot.projeto_id = v_oro
        and ot.deleted_at is null
        and ot.template_id = tc.id
    );

  get diagnostics v_inserted = row_count;

  select count(*) into v_me_after
  from public.tarefas where projeto_id = v_me and deleted_at is null;

  select count(*) into v_oro_after
  from public.tarefas where projeto_id = v_oro and deleted_at is null;

  if v_me_after <> v_me_before then
    raise exception 'ME mudou de % para % tarefas — rollback', v_me_before, v_me_after;
  end if;

  if v_oro_after <> v_inserted then
    raise exception 'ORO ficou com % vivas apos inserir % — rollback', v_oro_after, v_inserted;
  end if;

  if v_oro_after <> v_me_after then
    raise exception 'Contagens divergem ORO=% ME=% — rollback', v_oro_after, v_me_after;
  end if;

  raise notice 'OK: inseridas=% ME=% ORO=%', v_inserted, v_me_after, v_oro_after;
end $$;
