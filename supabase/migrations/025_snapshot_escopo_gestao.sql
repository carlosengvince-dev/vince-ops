-- ═══ 025a — Gestão de snapshots ═══
create or replace function public.rename_config_snapshot(
  p_id uuid, p_novo_nome text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);
  update config_snapshots set nome = p_novo_nome where id = p_id;
end;
$$;

create or replace function public.delete_config_snapshot(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);
  delete from config_snapshots where id = p_id;  -- definitivo
end;
$$;

-- ═══ 025b — Restauração por escopo ═══
-- Assinatura muda: dropar a antiga (evita sobrecarga no PostgREST)
drop function if exists public.restaurar_config_snapshot(uuid);

create or replace function public.restaurar_config_snapshot(
  p_id uuid,
  p_escopo text default 'tudo'
  -- 'tudo' | 'disciplinas' | 'fases' | 'categorias'
  -- | 'templates' | 'configuracoes'
)
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

  perform public.salvar_config_snapshot(
    'Antes de restaurar (' || p_escopo || '): ' || v_nome, true);

  if p_escopo in ('tudo','disciplinas') then
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
  end if;

  if p_escopo in ('tudo','fases') then
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
  end if;

  if p_escopo in ('tudo','categorias') then
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
  end if;

  if p_escopo in ('tudo','templates') then
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
  end if;

  if p_escopo in ('tudo','configuracoes') then
    for rec in select * from jsonb_to_recordset(v_dados->'configuracoes')
      as x(chave text, valor jsonb)
    loop
      insert into configuracoes (chave, valor, updated_by)
      values (rec.chave, rec.valor, (select auth.uid()))
      on conflict (chave) do update set
        valor = excluded.valor, updated_at = now(),
        updated_by = (select auth.uid());
    end loop;
  end if;

  return jsonb_build_object(
    'disciplinas_removidas', v_del_discs,
    'fases_removidas', v_del_fases,
    'categorias_removidas', v_del_cats,
    'templates_removidos', v_del_tpls
  );
end;
$$;