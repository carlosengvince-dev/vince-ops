import { supabase } from './supabase'
import type {
  Criticidade,
  Disciplina,
  Fase,
  OrigemNormativa,
  Papel,
  Tarefa,
} from '../types'

export const TAREFA_ORIGEM_OPTIONS: { value: OrigemNormativa; label: string }[] = [
  { value: 'interno', label: 'Interno' },
  { value: 'EMASA', label: 'EMASA' },
  { value: 'CBMSC', label: 'CBMSC' },
  { value: 'NBR', label: 'NBR' },
]

export const CRITICIDADE_OPTIONS: { value: Criticidade; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'critico', label: 'Crítico' },
]

export const NOVA_CATEGORIA_VALUE = '__nova__'

function mapTarefaRow(raw: Record<string, unknown>): Tarefa {
  const profile = raw.profiles as { nome: string; papel: Papel } | null
  const { profiles: _profiles, ...rest } = raw
  return {
    ...(rest as unknown as Tarefa),
    responsavel_nome: profile?.nome ?? null,
    responsavel_papel: profile?.papel ?? null,
  }
}

export function getCategoriasForPhase(
  tarefas: Tarefa[],
  disciplina: Disciplina,
  fase: Fase,
): string[] {
  const set = new Set<string>()
  for (const t of tarefas) {
    if (
      t.disciplina === disciplina &&
      t.fase === fase &&
      t.revisao_id == null &&
      t.deleted_at === null
    ) {
      set.add(t.categoria)
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export function getNextOrdemInCategoria(
  tarefas: Tarefa[],
  disciplina: Disciplina,
  fase: Fase,
  categoria: string,
): number {
  let max = -1
  for (const t of tarefas) {
    if (
      t.disciplina === disciplina &&
      t.fase === fase &&
      t.categoria === categoria &&
      t.revisao_id == null &&
      t.deleted_at === null
    ) {
      max = Math.max(max, t.ordem)
    }
  }
  return max + 1
}

export interface CreateManualTarefaInput {
  projetoId: string
  disciplina: Disciplina
  fase: Fase
  categoria: string
  nome: string
  descricao: string | null
  criticidade: Criticidade
  origem: OrigemNormativa
  referencia_normativa: string | null
  responsavelId: string | null
  ordem: number
  userId: string
}

export async function createManualTarefa(input: CreateManualTarefaInput): Promise<Tarefa> {
  const { data, error } = await supabase
    .from('tarefas')
    .insert({
      projeto_id: input.projetoId,
      template_id: null,
      revisao_id: null,
      disciplina: input.disciplina,
      fase: input.fase,
      categoria: input.categoria,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      criticidade: input.criticidade,
      origem: input.origem,
      referencia_normativa: input.referencia_normativa?.trim() || null,
      metodologia_minima: null,
      ordem: input.ordem,
      status: 'pendente',
      responsavel_id: input.responsavelId,
      updated_by: input.userId,
    })
    .select('*, profiles!responsavel_id(nome, papel)')
    .single()

  if (error) throw new Error(error.message)
  return mapTarefaRow(data as Record<string, unknown>)
}

export interface UpdateTarefaDetailsInput {
  tarefaId: string
  nome: string
  descricao: string | null
  categoria: string
  criticidade: Criticidade
  origem: OrigemNormativa
  referencia_normativa: string | null
  responsavelId: string | null
  userId: string
}

export async function updateTarefaDetails(input: UpdateTarefaDetailsInput): Promise<Tarefa> {
  const { data, error } = await supabase
    .from('tarefas')
    .update({
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      categoria: input.categoria,
      criticidade: input.criticidade,
      origem: input.origem,
      referencia_normativa: input.referencia_normativa?.trim() || null,
      responsavel_id: input.responsavelId,
      updated_at: new Date().toISOString(),
      updated_by: input.userId,
    })
    .eq('id', input.tarefaId)
    .select('*, profiles!responsavel_id(nome, papel)')
    .single()

  if (error) throw new Error(error.message)
  return mapTarefaRow(data as Record<string, unknown>)
}

export interface MoveTarefaInput {
  tarefaId: string
  fase: Fase
  categoria: string
  ordem: number
  userId: string
}

export async function moveTarefaToPhase(input: MoveTarefaInput): Promise<Tarefa> {
  const { data, error } = await supabase
    .from('tarefas')
    .update({
      fase: input.fase,
      categoria: input.categoria,
      ordem: input.ordem,
      updated_at: new Date().toISOString(),
      updated_by: input.userId,
    })
    .eq('id', input.tarefaId)
    .select('*, profiles!responsavel_id(nome, papel)')
    .single()

  if (error) throw new Error(error.message)
  return mapTarefaRow(data as Record<string, unknown>)
}

export async function softDeleteTarefa(tarefaId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('tarefas')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', tarefaId)

  if (error) throw new Error(error.message)
}

export async function reorderTarefasOrdem(
  updates: { id: string; ordem: number }[],
  userId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const results = await Promise.all(
    updates.map(({ id, ordem }) =>
      supabase
        .from('tarefas')
        .update({ ordem, updated_at: now, updated_by: userId })
        .eq('id', id),
    ),
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) throw new Error(failed.error.message)
}

export function tarefaToFormValues(tarefa: Tarefa) {
  return {
    nome: tarefa.nome,
    descricao: tarefa.descricao ?? '',
    categoria: tarefa.categoria,
    categoriaIsNew: false,
    novaCategoriaText: '',
    criticidade: tarefa.criticidade,
    origem: tarefa.origem,
    referencia_normativa: tarefa.referencia_normativa ?? '',
    responsavelId: tarefa.responsavel_id ?? '',
  }
}

export type TaskFormValues = ReturnType<typeof tarefaToFormValues>

export interface ReorderableTarefa {
  id: string
  nome: string
  ordem: number
}

/** Reordena tarefas dentro de uma categoria e recalcula ordem (0, 1, 2…). */
export function reorderTarefas<T extends ReorderableTarefa>(
  tarefas: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= tarefas.length || toIndex >= tarefas.length) {
    return tarefas.map((t, i) => ({ ...t, ordem: i }))
  }
  if (fromIndex === toIndex) {
    return tarefas.map((t, i) => ({ ...t, ordem: i }))
  }

  const result = [...tarefas]
  const [removed] = result.splice(fromIndex, 1)
  result.splice(toIndex, 0, removed)
  return result.map((t, i) => ({ ...t, ordem: i }))
}
