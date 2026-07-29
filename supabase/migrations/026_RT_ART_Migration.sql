-- Tabela de Responsáveis Técnicos (mesmo padrão de clientes)
create table if not exists responsaveis_tecnicos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizacoes(id),
  nome text not null,
  documento text,   -- CPF/CNPJ
  registro text,    -- CREA/CAU
  ativo boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table responsaveis_tecnicos enable row level security;

create policy "rt_select_authenticated" on responsaveis_tecnicos
  for select to authenticated using (deleted_at is null);
-- Sem policy de write — RPC é o único caminho.

create or replace function public.upsert_responsavel_tecnico(
  p_id uuid,
  p_nome text,
  p_documento text default null,
  p_registro text default null,
  p_ativo boolean default true
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  if p_id is null then
    insert into responsaveis_tecnicos (nome, documento, registro, ativo)
    values (p_nome, p_documento, p_registro, p_ativo)
    returning id into v_id;
  else
    update responsaveis_tecnicos set
      nome = p_nome, documento = p_documento,
      registro = p_registro, ativo = p_ativo, updated_at = now()
    where id = p_id and deleted_at is null;
    v_id := p_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.delete_responsavel_tecnico(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  if exists (
    select 1 from projetos
    where responsavel_tecnico_id = p_id
      and status in ('ativo','em_revisao') and deleted_at is null
  ) then
    raise exception 'Há projetos ativos vinculados a este RT. Desvincule antes de excluir.';
  end if;

  update responsaveis_tecnicos set deleted_at = now() where id = p_id;
end;
$$;

-- Vínculo no projeto (nullable — projetos existentes não quebram)
alter table projetos
  add column if not exists responsavel_tecnico_id uuid references responsaveis_tecnicos(id);