create table if not exists chat_mensagens (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id),
  autor_id uuid not null references profiles(id),
  texto text not null,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists chat_mensagens_projeto_idx
  on chat_mensagens(projeto_id, created_at desc)
  where deleted_at is null;

alter table chat_mensagens enable row level security;

create policy "chat_select_authenticated"
  on chat_mensagens for select to authenticated
  using (deleted_at is null);

create policy "chat_insert_authenticated"
  on chat_mensagens for insert to authenticated
  with check (autor_id = auth.uid());

create policy "chat_softdelete_own_or_gestor"
  on chat_mensagens for update to authenticated
  using (
    deleted_at is null and
    (autor_id = auth.uid() or public.is_gestor())
  )
  with check (autor_id = auth.uid() or public.is_gestor());
