-- Grants das RPCs de RT (padrão das demais migrations) + migração única de legado ART.

grant execute on function public.upsert_responsavel_tecnico(
  uuid, text, text, text, boolean
) to authenticated;

grant execute on function public.delete_responsavel_tecnico(uuid) to authenticated;

-- numero_art (texto livre) → metadata.art_por_disciplina[disciplina]
-- Disciplina alvo: HID se o projeto tiver HID; senão a 1ª disciplina ativa do array.
update public.projetos p
set
  metadata =
    (coalesce(p.metadata, '{}'::jsonb) - 'numero_art')
    || jsonb_build_object(
      'art_por_disciplina',
      coalesce(p.metadata->'art_por_disciplina', '{}'::jsonb)
        || jsonb_build_object(v.disc_key, trim(p.metadata->>'numero_art'))
    ),
  updated_at = now()
from (
  select
    id,
    case
      when disciplinas @> array['HID']::text[] then 'HID'
      when cardinality(disciplinas) > 0 then disciplinas[1]
      else 'HID'
    end as disc_key
  from public.projetos
) v
where p.id = v.id
  and p.deleted_at is null
  and nullif(trim(p.metadata->>'numero_art'), '') is not null
  and (
    p.metadata->'art_por_disciplina' is null
    or p.metadata->'art_por_disciplina' = '{}'::jsonb
    or nullif(trim(p.metadata->'art_por_disciplina'->>v.disc_key), '') is null
  );
