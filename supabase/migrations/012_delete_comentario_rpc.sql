-- VINCE Ops — soft delete de comentários via RPC (security definer)

create or replace function public.delete_comentario(
  comentario_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update comentarios
  set deleted_at = now()
  where id = comentario_id
    and deleted_at is null
    and (autor_id = auth.uid() or exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.papel = 'gestor'
        and profiles.ativo = true
    ));
end;
$$;

grant execute on function public.delete_comentario(uuid) to authenticated;
