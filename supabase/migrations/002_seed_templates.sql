-- VINCE Ops — Seed mínimo de templates de checklist
-- Executar no Supabase Dashboard após 001_initial_schema.sql
--
-- Conteúdo mínimo para validação do sistema.
-- Idempotente: não duplica se já existir (disciplina + fase + categoria + nome).

insert into templates_checklist (
  disciplina,
  fase,
  categoria,
  nome,
  criticidade,
  origem,
  referencia_normativa,
  ordem,
  executor_padrao,
  ativo
)
select
  v.disciplina,
  v.fase,
  v.categoria,
  v.nome,
  v.criticidade,
  v.origem,
  v.referencia_normativa,
  v.ordem,
  'projetista',
  true
from (
  values
    -- HID — INFO_GERAL — Dados do cliente
    ('HID', 'INFO_GERAL', 'Dados do cliente', 'Identificação do cliente',           'normal',  'interno', null,                  1),
    ('HID', 'INFO_GERAL', 'Dados do cliente', 'Endereço completo da obra',          'normal',  'interno', null,                  2),
    ('HID', 'INFO_GERAL', 'Dados do cliente', 'Contato do responsável',             'normal',  'interno', null,                  3),

    -- HID — EP — Levantamento
    ('HID', 'EP',         'Levantamento',     'Planta baixa arquitetônica recebida','critico', 'interno', null,                  1),
    ('HID', 'EP',         'Levantamento',     'Cota de nível do terreno',           'normal',  'interno', null,                  2),

    -- HID — AP — Hidráulica
    ('HID', 'AP',         'Hidráulica',       'Dimensionamento de reservatórios',   'critico', 'NBR',     'NBR 5626 item 6.2',   1),
    ('HID', 'AP',         'Hidráulica',       'Memorial de cálculo hidráulico',     'critico', 'EMASA',   null,                  2),
    ('HID', 'AP',         'Hidráulica',       'Planta baixa isométrica',            'critico', 'EMASA',   null,                  3),

    -- HID — AP — Sanitário
    ('HID', 'AP',         'Sanitário',        'Posicionamento de caixas de inspeção','critico', 'EMASA',   null,                  1),
    ('HID', 'AP',         'Sanitário',        'Rede de esgoto — planta baixa',      'critico', 'NBR',     'NBR 8160',            2),

    -- PPCI — EP — Levantamento
    ('PPCI','EP',         'Levantamento',     'Planta baixa arquitetônica recebida','critico', 'interno', null,                  1),
    ('PPCI','EP',         'Levantamento',     'Classificação de risco da edificação','critico','CBMSC',   null,                  2),

    -- PPCI — AP — Sistemas de proteção
    ('PPCI','AP',         'Sistemas de proteção', 'Dimensionamento da rede de hidrantes', 'critico', 'CBMSC', null,              1),
    ('PPCI','AP',         'Sistemas de proteção', 'Planta de rota de fuga',             'critico', 'CBMSC', null,              2)
) as v (
  disciplina,
  fase,
  categoria,
  nome,
  criticidade,
  origem,
  referencia_normativa,
  ordem
)
where not exists (
  select 1
  from templates_checklist t
  where t.disciplina = v.disciplina
    and t.fase = v.fase
    and t.categoria = v.categoria
    and t.nome = v.nome
    and t.deleted_at is null
);

-- Verificação (opcional — deve retornar 14)
-- select count(*) from templates_checklist where deleted_at is null;
