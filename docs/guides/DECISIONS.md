# Decisões de arquitetura — VINCE Ops

Registro das decisões tomadas nesta sessão (migração de writes para RPC).

## 1. Writes diretos negados no RLS; RPCs `security definer` como único caminho de escrita

O Supabase passou a **negar writes diretos** nas tabelas `clientes`, `pendencias_externas`, `revisoes`, `liberacoes_fase` e `documentos_projeto`. Políticas RLS sozinhas são insuficientes para garantir regras de negócio — o app não deve mais usar `.insert()`, `.update()` ou `.upsert()` nessas tabelas.

Toda escrita passa por funções RPC com `security definer` e `set search_path = public`, que executam a operação com privilégios elevados **após** validar autorização. Leituras continuam via `.select()` nas tabelas.

## 2. `assert_papel()` centraliza autorização

A função `public.assert_papel(text[])` verifica se o usuário autenticado possui um dos papéis permitidos (e está ativo). Cada RPC chama `perform public.assert_papel(...)` no início.

Papéis por entidade:

| RPC | Papéis permitidos |
|-----|-------------------|
| `upsert_cliente`, `delete_cliente` | gestor, diretor_executivo |
| `upsert_pendencia`, `delete_pendencia` | gestor, diretor_executivo |
| `upsert_revisao`, `delete_revisao` | gestor, diretor_executivo |
| `insert_liberacao_fase` | gestor, diretor_executivo |
| `upsert_documento_projeto` | gestor, diretor_executivo, **projetista** |
| `delete_documento_projeto` | gestor, diretor_executivo |

Mudanças futuras de permissão ficam em um único lugar (`assert_papel` e as listas de papéis nas RPCs).

## 3. SQL versionado em `supabase/migrations/`

Todo SQL executado manualmente no Supabase Dashboard deve ser commitado como arquivo numerado em `supabase/migrations/`. Versionamento manual até adoção do Supabase CLI para deploy automatizado.

Nesta sessão: `020_rpcs_escrita_completa.sql` (pendencias, revisoes, liberacoes_fase, documentos_projeto). As RPCs `upsert_cliente`, `delete_cliente` e `assert_papel` já existiam no banco antes desta migration.

## Padrão de código TypeScript

Cada entidade com writes RPC tem um módulo `src/lib/*Rpc.ts` (ex.: `clienteRpc.ts`, `pendenciaRpc.ts`) seguindo o mesmo padrão de `projetoRpc.ts` e `tarefaRpc.ts`:

- Interface tipada com parâmetros `p_*`
- Whitelist de chaves enviadas ao RPC (omite `undefined`)
- Funções `upsert*Rpc` / `delete*Rpc` que lançam `Error` com mensagem do Supabase
- Fetch pós-escrita via `.select()` quando o RPC retorna apenas o `uuid`

## Sessão 3 — Fases e categorias

1. Fases e categorias passam a ser entidades em tabelas próprias (`fases_config`, `categorias_config`). Em fases, o código permanece imutável e o label é editável; em categorias, renomeações com impacto em templates/tarefas são feitas por RPC de cascata (`rename_categoria`).
2. `projeto_fases` guarda apenas exceções de ativação por projeto (ausência de registro = fase ativa), e permanece como base para evolução futura de responsáveis por fase (modelo N:N).
3. `templates_checklist.categoria` e `tarefas.categoria` continuam texto nesta etapa; consistência de nomes é garantida pelo fluxo de renomeação centralizado via RPC. Migração para FK foi adiada deliberadamente.
4. As tabelas novas incluem `org_id` para suportar tenancy futura sem novo redesign estrutural.

5. Estimativas por disciplina custom virão em campo jsonb em iteração futura; colunas `horas_estimadas_hid` / `horas_estimadas_ppci` mantidas por compatibilidade.

## Sessão 3D — Disciplinas dinâmicas

1. `disciplinas_config` é a fonte de verdade para nome e cores exibidos; `codigo` permanece chave imutável em `projetos.disciplinas`, `tarefas.disciplina`, `fases_config.disciplina` etc.
2. HID/PPCI/SPK mantêm classes CSS legadas (`disc-tone--hid` etc.); disciplinas custom usam cores de `disciplinas_config` via style inline e CSS vars `--disc-{codigo}-bg/text`.
3. Travas de fase obrigatória foram removidas do banco (migration 022b); proteções restantes são projetos na fase atual e ao menos uma fase ativa por disciplina.
