-- VINCE Ops — RLS comentarios: permitir soft delete (with check não exige deleted_at null)
-- Executar no Supabase se soft delete falhar silenciosamente

drop policy if exists "comentarios_update_own_or_gestor" on comentarios;

create policy "comentarios_update_own_or_gestor" on comentarios
  for update to authenticated
  using (
    deleted_at is null
    and (autor_id = auth.uid() or public.is_gestor())
  )
  with check (autor_id = auth.uid() or public.is_gestor());
