-- VINCE Ops — listagem de profiles com e-mail para gestor (settings)

create or replace function public.list_profiles_with_email()
returns table (
  id uuid,
  nome text,
  papel text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz,
  email text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.nome, p.papel, p.ativo, p.created_at, p.updated_at, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.ativo = true
    and exists (
      select 1 from public.profiles g
      where g.id = auth.uid()
        and g.papel = 'gestor'
        and g.ativo = true
    )
  order by p.nome asc;
$$;

grant execute on function public.list_profiles_with_email() to authenticated;
