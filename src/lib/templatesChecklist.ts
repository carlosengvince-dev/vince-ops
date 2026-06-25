import { supabase } from './supabase'
import type {
  Criticidade,
  Disciplina,
  ExecutorPadrao,
  Fase,
  Metodologia,
  OrigemNormativa,
  TemplateChecklist,
} from '../types'

export interface TemplateChecklistInput {
  disciplina: Disciplina
  fase: Fase
  categoria: string
  nome: string
  descricao?: string | null
  criticidade: Criticidade
  origem: OrigemNormativa
  referencia_normativa?: string | null
  executor_padrao: ExecutorPadrao
  metodologia_minima?: Metodologia | null
  ordem: number
  ativo?: boolean
}

export interface TemplatesGrouped {
  fase: Fase
  categorias: {
    categoria: string
    templates: TemplateChecklist[]
  }[]
}

interface UpsertTemplateRpcParams {
  p_id: string | null
  p_disciplina: Disciplina
  p_fase: Fase
  p_categoria: string
  p_nome: string
  p_descricao: string | null
  p_criticidade: Criticidade
  p_origem: OrigemNormativa
  p_referencia_normativa: string | null
  p_executor_padrao: ExecutorPadrao
  p_metodologia_minima: Metodologia | null
  p_ordem: number
  p_ativo: boolean
}

function inputToRpcParams(
  input: TemplateChecklistInput,
  id: string | null = null,
): UpsertTemplateRpcParams {
  return {
    p_id: id,
    p_disciplina: input.disciplina,
    p_fase: input.fase,
    p_categoria: input.categoria,
    p_nome: input.nome,
    p_descricao: input.descricao ?? null,
    p_criticidade: input.criticidade,
    p_origem: input.origem,
    p_referencia_normativa: input.referencia_normativa ?? null,
    p_executor_padrao: input.executor_padrao,
    p_metodologia_minima: input.metodologia_minima ?? null,
    p_ordem: input.ordem,
    p_ativo: input.ativo ?? true,
  }
}

function templateToRpcParams(
  template: TemplateChecklist,
  overrides: Partial<TemplateChecklistInput> = {},
): UpsertTemplateRpcParams {
  return inputToRpcParams(
    {
      disciplina: overrides.disciplina ?? template.disciplina,
      fase: overrides.fase ?? template.fase,
      categoria: overrides.categoria ?? template.categoria,
      nome: overrides.nome ?? template.nome,
      descricao:
        overrides.descricao !== undefined ? overrides.descricao : template.descricao,
      criticidade: overrides.criticidade ?? template.criticidade,
      origem: overrides.origem ?? template.origem,
      referencia_normativa:
        overrides.referencia_normativa !== undefined
          ? overrides.referencia_normativa
          : template.referencia_normativa,
      executor_padrao: overrides.executor_padrao ?? template.executor_padrao,
      metodologia_minima:
        overrides.metodologia_minima !== undefined
          ? overrides.metodologia_minima
          : template.metodologia_minima,
      ordem: overrides.ordem ?? template.ordem,
      ativo: overrides.ativo !== undefined ? overrides.ativo : template.ativo,
    },
    template.id,
  )
}

async function fetchTemplateById(id: string): Promise<TemplateChecklist> {
  const { data, error } = await supabase
    .from('templates_checklist')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) throw new Error(error.message)
  return data as TemplateChecklist
}

async function upsertTemplateRpc(params: UpsertTemplateRpcParams): Promise<void> {
  const { error } = await supabase.rpc('upsert_template_checklist', params)
  if (error) throw new Error(error.message)
}

export async function fetchAllTemplates(disciplina: Disciplina): Promise<TemplateChecklist[]> {
  const { data, error } = await supabase
    .from('templates_checklist')
    .select('*')
    .eq('disciplina', disciplina)
    .is('deleted_at', null)
    .order('fase')
    .order('categoria')
    .order('ordem')

  if (error) throw new Error(error.message)
  return (data ?? []) as TemplateChecklist[]
}

export function groupTemplatesByFaseCategoria(templates: TemplateChecklist[]): TemplatesGrouped[] {
  const byFase = new Map<Fase, Map<string, TemplateChecklist[]>>()

  for (const t of templates) {
    if (!byFase.has(t.fase)) byFase.set(t.fase, new Map())
    const byCat = byFase.get(t.fase)!
    if (!byCat.has(t.categoria)) byCat.set(t.categoria, [])
    byCat.get(t.categoria)!.push(t)
  }

  const result: TemplatesGrouped[] = []
  for (const [fase, catMap] of byFase) {
    const categorias = [...catMap.entries()].map(([categoria, items]) => ({
      categoria,
      templates: items.sort((a, b) => a.ordem - b.ordem),
    }))
    result.push({ fase, categorias })
  }

  return result.sort((a, b) => a.fase.localeCompare(b.fase))
}

export async function createTemplate(input: TemplateChecklistInput): Promise<void> {
  await upsertTemplateRpc(inputToRpcParams(input, null))
}

export async function updateTemplate(
  id: string,
  patch: Partial<TemplateChecklistInput>,
): Promise<void> {
  const current = await fetchTemplateById(id)
  await upsertTemplateRpc(templateToRpcParams(current, patch))
}

export async function toggleTemplateAtivo(id: string, ativo: boolean): Promise<void> {
  const current = await fetchTemplateById(id)
  await upsertTemplateRpc(templateToRpcParams(current, { ativo }))
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_template_checklist', { p_id: id })
  if (error) throw new Error(error.message)
}

export async function reorderTemplates(updates: { id: string; ordem: number }[]): Promise<void> {
  if (updates.length === 0) return

  const ids = updates.map((u) => u.id)
  const ordemMap = new Map(updates.map((u) => [u.id, u.ordem]))

  const { data, error } = await supabase
    .from('templates_checklist')
    .select('*')
    .in('id', ids)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  await Promise.all(
    (data ?? []).map((row) =>
      upsertTemplateRpc(
        templateToRpcParams(row as TemplateChecklist, {
          ordem: ordemMap.get(row.id) ?? row.ordem,
        }),
      ),
    ),
  )
}

export async function renameCategoriaInTemplates(
  disciplina: Disciplina,
  from: string,
  to: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('templates_checklist')
    .select('*')
    .eq('disciplina', disciplina)
    .eq('categoria', from)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  const templates = (data ?? []) as TemplateChecklist[]
  await Promise.all(
    templates.map((t) => upsertTemplateRpc(templateToRpcParams(t, { categoria: to }))),
  )

  return templates.length
}

export async function renameCategoriaInTarefasAtivas(
  disciplina: Disciplina,
  from: string,
  to: string,
): Promise<number> {
  const { data: projetos, error: projError } = await supabase
    .from('projetos')
    .select('id')
    .in('status', ['ativo', 'em_revisao'])
    .is('deleted_at', null)

  if (projError) throw new Error(projError.message)
  const ids = (projetos ?? []).map((p) => p.id)
  if (ids.length === 0) return 0

  const { data, error } = await supabase
    .from('tarefas')
    .update({ categoria: to, updated_at: new Date().toISOString() })
    .in('projeto_id', ids)
    .eq('disciplina', disciplina)
    .eq('categoria', from)
    .is('deleted_at', null)
    .select('id')

  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export async function countTemplatesInCategoria(
  disciplina: Disciplina,
  categoria: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('templates_checklist')
    .select('id', { count: 'exact', head: true })
    .eq('disciplina', disciplina)
    .eq('categoria', categoria)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function countTarefasAtivasInCategoria(
  disciplina: Disciplina,
  categoria: string,
): Promise<number> {
  const { data: projetos } = await supabase
    .from('projetos')
    .select('id')
    .in('status', ['ativo', 'em_revisao'])
    .is('deleted_at', null)

  const ids = (projetos ?? []).map((p) => p.id)
  if (ids.length === 0) return 0

  const { count, error } = await supabase
    .from('tarefas')
    .select('id', { count: 'exact', head: true })
    .in('projeto_id', ids)
    .eq('disciplina', disciplina)
    .eq('categoria', categoria)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
  return count ?? 0
}
