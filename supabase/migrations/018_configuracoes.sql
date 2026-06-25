-- VINCE Ops — tabela de configurações do sistema

create table if not exists configuracoes (
  chave text primary key,
  valor jsonb not null default '[]',
  updated_at timestamptz default now(),
  updated_by uuid references profiles(id)
);

alter table configuracoes enable row level security;

drop policy if exists "configuracoes_select_authenticated" on configuracoes;
drop policy if exists "configuracoes_write_gestor" on configuracoes;

create policy "configuracoes_select_authenticated"
  on configuracoes for select
  to authenticated
  using (true);

create policy "configuracoes_write_gestor"
  on configuracoes for all
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());
