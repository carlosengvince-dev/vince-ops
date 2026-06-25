-- VINCE Ops — constraint única e RLS revisoes (7.4)
-- Executar no Supabase Dashboard após validação

alter table revisoes drop constraint if exists revisoes_numero_unico;

alter table revisoes
  add constraint revisoes_numero_unico
  unique (projeto_id, disciplina, numero);

drop policy if exists "revisoes_insert_gestor" on revisoes;
drop policy if exists "revisoes_update_gestor" on revisoes;
drop policy if exists "revisoes_write_gestor" on revisoes;

create policy "revisoes_write_gestor" on revisoes
  for all to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());
