-- VINCE Ops — RLS tarefas: projetista pode atualizar status
-- Executar no Supabase Dashboard: SQL Editor → New query → Run
-- Idempotente: remove policies antigas antes de recriar.

drop policy if exists "tarefas_write_gestor" on tarefas;
drop policy if exists "tarefas_update_projetista" on tarefas;
drop policy if exists "tarefas_insert_gestor" on tarefas;
drop policy if exists "tarefas_delete_gestor" on tarefas;

-- select já existe em 001; recriar só se ausente (mesma regra)
drop policy if exists "tarefas_select_authenticated" on tarefas;

create policy "tarefas_select_authenticated"
  on tarefas for select
  to authenticated
  using (deleted_at is null);

create policy "tarefas_update_projetista"
  on tarefas for update
  to authenticated
  using (deleted_at is null)
  with check (deleted_at is null);

create policy "tarefas_insert_gestor"
  on tarefas for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and papel = 'gestor'
    )
  );

create policy "tarefas_delete_gestor"
  on tarefas for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and papel = 'gestor'
    )
  );
