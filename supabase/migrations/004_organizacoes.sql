-- VINCE Ops — Organizações (fundação multi-tenant)
-- Executar no Supabase Dashboard: SQL Editor → New query → Run

create table if not exists organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique,
  metadata jsonb default '{}',
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table projetos add column if not exists
  organizacao_id uuid references organizacoes(id);

alter table clientes add column if not exists
  organizacao_id uuid references organizacoes(id);

insert into organizacoes (nome, slug)
values ('VINCE Engenharia', 'vince')
on conflict (slug) do nothing;

alter table organizacoes enable row level security;

drop policy if exists "org_select_authenticated" on organizacoes;
drop policy if exists "org_write_gestor" on organizacoes;

create policy "org_select_authenticated" on organizacoes
  for select to authenticated using (deleted_at is null);

create policy "org_write_gestor" on organizacoes
  for all to authenticated
  using (public.is_gestor()) with check (public.is_gestor());

-- Opcional: vincular registros existentes à org padrão
update projetos
set organizacao_id = (select id from organizacoes where slug = 'vince' limit 1)
where organizacao_id is null;

update clientes
set organizacao_id = (select id from organizacoes where slug = 'vince' limit 1)
where organizacao_id is null;
