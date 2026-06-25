-- VINCE Ops — RLS comentarios: autor insere/atualiza próprio; gestor também pode soft-delete
-- Executar no Supabase Dashboard após validação

drop policy if exists "comentarios_write_gestor" on comentarios;
drop policy if exists "comentarios_insert_own" on comentarios;
drop policy if exists "comentarios_update_own_or_gestor" on comentarios;
drop policy if exists "comentarios_delete_own_or_gestor" on comentarios;

create policy "comentarios_insert_own" on comentarios
  for insert to authenticated
  with check (autor_id = auth.uid());

create policy "comentarios_update_own_or_gestor" on comentarios
  for update to authenticated
  using (
    deleted_at is null
    and (autor_id = auth.uid() or public.is_gestor())
  )
  with check (autor_id = auth.uid() or public.is_gestor());

create policy "comentarios_delete_own_or_gestor" on comentarios
  for delete to authenticated
  using (autor_id = auth.uid() or public.is_gestor());
