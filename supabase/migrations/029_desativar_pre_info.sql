-- 1) Qualquer projeto ativo/em_revisão ainda em PRE_INFO → INFO_GERAL
-- 2) Desativa a fase PRE_INFO (Recebimento) em HID, PPCI e SPK

do $$
declare
  r record;
  next_fases jsonb;
begin
  for r in
    select p.id, p.fases_atuais, f.disciplina
    from public.projetos p
    join public.fases_config f
      on f.codigo = 'PRE_INFO'
     and f.deleted_at is null
    where p.deleted_at is null
      and p.status in ('ativo', 'em_revisao')
      and p.fases_atuais->>f.disciplina = 'PRE_INFO'
  loop
    next_fases := jsonb_set(
      coalesce(r.fases_atuais, '{}'::jsonb),
      array[r.disciplina],
      '"INFO_GERAL"'::jsonb,
      true
    );
    update public.projetos
    set
      fases_atuais = next_fases,
      updated_at = now()
    where id = r.id;
  end loop;

  update public.fases_config
  set
    ativo = false,
    updated_at = now()
  where codigo = 'PRE_INFO'
    and deleted_at is null
    and ativo = true;
end $$;
