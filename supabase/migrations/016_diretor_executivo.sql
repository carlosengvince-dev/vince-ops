-- VINCE Ops — papel Diretor Executivo

alter table profiles
  drop constraint if exists profiles_papel_check;

alter table profiles
  add constraint profiles_papel_check
  check (papel in (
    'diretor_executivo',
    'gestor',
    'projetista',
    'administrador',
    'proprietario'
  ));

update profiles
set papel = 'diretor_executivo'
where id = '5ee9b51b-e845-4a20-b707-ce7c9fa68b14';

create or replace function public.is_gestor()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and papel in ('gestor', 'diretor_executivo')
      and ativo = true
  );
$$;
