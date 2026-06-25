-- VINCE Ops — soft delete de registros_tempo via RPC (security definer)

create or replace function public.delete_registro_tempo(
  registro_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update registros_tempo
  set deleted_at = now()
  where id = registro_id
    and deleted_at is null
    and (usuario_id = auth.uid() or exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.papel = 'gestor'
        and profiles.ativo = true
    ));
end;
$$;

grant execute on function public.delete_registro_tempo(uuid) to authenticated;
