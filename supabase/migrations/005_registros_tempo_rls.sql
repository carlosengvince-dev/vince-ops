-- VINCE Ops — RLS registros_tempo: usuário gerencia próprio timer
-- Executar no Supabase Dashboard após validação

drop policy if exists "registros_tempo_write_gestor" on registros_tempo;
drop policy if exists "registros_tempo_insert_own" on registros_tempo;
drop policy if exists "registros_tempo_update_own" on registros_tempo;
drop policy if exists "registros_tempo_delete_gestor" on registros_tempo;

create policy "registros_tempo_insert_own" on registros_tempo
  for insert to authenticated
  with check (usuario_id = auth.uid());

create policy "registros_tempo_update_own" on registros_tempo
  for update to authenticated
  using (usuario_id = auth.uid() and deleted_at is null);

create policy "registros_tempo_delete_gestor" on registros_tempo
  for delete to authenticated
  using (public.is_gestor());
