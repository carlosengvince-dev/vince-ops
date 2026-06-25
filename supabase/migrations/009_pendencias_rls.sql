-- VINCE Ops — RLS pendencias_externas: select autenticados; insert/update apenas gestor
-- Executar no Supabase Dashboard após validação

drop policy if exists "pendencias_select_authenticated" on pendencias_externas;
drop policy if exists "pendencias_write_gestor" on pendencias_externas;

create policy "pendencias_select_authenticated" on pendencias_externas
  for select to authenticated
  using (deleted_at is null);

create policy "pendencias_insert_gestor" on pendencias_externas
  for insert to authenticated
  with check (public.is_gestor());

create policy "pendencias_update_gestor" on pendencias_externas
  for update to authenticated
  using (public.is_gestor() and deleted_at is null)
  with check (public.is_gestor());
