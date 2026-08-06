-- One-shot: copiar ordem de categorias HID|EP e HID|PP do ME para o ORO
-- (metadata.checklist_categoria_ordem). Não altera tarefas do ME.

do $$
declare
  v_me_ordem jsonb;
  v_oro_meta jsonb;
  v_ep jsonb;
  v_pp jsonb;
begin
  select coalesce(metadata->'checklist_categoria_ordem', '{}'::jsonb)
  into v_me_ordem
  from public.projetos
  where codigo = 'ME' and deleted_at is null;

  v_ep := v_me_ordem->'HID|EP';
  v_pp := v_me_ordem->'HID|PP';

  if v_ep is null or jsonb_typeof(v_ep) <> 'array' or jsonb_array_length(v_ep) = 0 then
    raise exception 'ME nao tem ordem HID|EP';
  end if;
  if v_pp is null or jsonb_typeof(v_pp) <> 'array' or jsonb_array_length(v_pp) = 0 then
    raise exception 'ME nao tem ordem HID|PP';
  end if;

  select coalesce(metadata, '{}'::jsonb) into v_oro_meta
  from public.projetos
  where codigo = 'ORO' and deleted_at is null;

  v_oro_meta := jsonb_set(
    v_oro_meta,
    '{checklist_categoria_ordem}',
    coalesce(v_oro_meta->'checklist_categoria_ordem', '{}'::jsonb)
      || jsonb_build_object(
           'HID|EP', v_ep,
           'HID|PP', v_pp
         ),
    true
  );

  update public.projetos
  set metadata = v_oro_meta,
      updated_at = now()
  where codigo = 'ORO' and deleted_at is null;
end $$;
