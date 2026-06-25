-- VINCE Ops — RLS tarefas: gestor altera responsável; projetista não pode mudar responsavel_id
-- Executar no Supabase Dashboard após validação

drop policy if exists "tarefas_update_projetista" on tarefas;
drop policy if exists "tarefas_update_gestor" on tarefas;

create policy "tarefas_update_gestor" on tarefas
  for update to authenticated
  using (public.is_gestor() and deleted_at is null)
  with check (public.is_gestor());

create policy "tarefas_update_projetista" on tarefas
  for update to authenticated
  using (deleted_at is null and not public.is_gestor())
  with check (
    deleted_at is null
    and responsavel_id is not distinct from (
      select t.responsavel_id from tarefas t where t.id = tarefas.id
    )
  );
