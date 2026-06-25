-- VINCE Ops — RLS documentos_projeto: projetistas podem editar status PRÉ-INFO

drop policy if exists "documentos_write_gestor" on documentos_projeto;

create policy "documentos_write_gestor"
  on documentos_projeto for all
  to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

create policy "documentos_update_authenticated"
  on documentos_projeto for update
  to authenticated
  using (deleted_at is null)
  with check (deleted_at is null);

create policy "documentos_insert_authenticated"
  on documentos_projeto for insert
  to authenticated
  with check (true);
