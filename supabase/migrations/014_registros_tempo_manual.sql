-- VINCE Ops — campos para lançamento manual de horas

alter table registros_tempo
  add column if not exists origem text not null default 'timer'
    check (origem in ('timer', 'manual')),
  add column if not exists descricao text;
