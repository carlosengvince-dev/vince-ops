-- VINCE Ops — melhorias em pendencias_externas (7.3)
-- Executar no Supabase Dashboard após validação

alter table pendencias_externas
  add column if not exists data_recebimento date,
  add column if not exists tarefas_vinculadas uuid[] default '{}';
