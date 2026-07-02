import { supabase } from './supabase'
import type {
  Criticidade,
  Disciplina,
  Fase,
  Metodologia,
  OrigemNormativa,
  Papel,
  Tarefa,
  TarefaStatus,
} from '../types'

export interface UpsertTarefaRpcParams {
  p_id: string | null
  p_projeto_id?: string
  p_revisao_id?: string | null
  p_template_id?: string | null
  p_disciplina?: Disciplina
  p_fase?: Fase
  p_categoria?: string
  p_nome?: string
  p_descricao?: string | null
  p_criticidade?: Criticidade
  p_origem?: OrigemNormativa
  p_referencia_normativa?: string | null
  p_metodologia_minima?: Metodologia | null
  p_ordem?: number
  p_status?: TarefaStatus
  p_motivo_bloqueio?: string | null
  p_responsavel_id?: string | null
  p_data_conclusao?: string | null
}

const UPSERT_TAREFA_RPC_KEYS = [
  'p_id',
  'p_projeto_id',
  'p_revisao_id',
  'p_template_id',
  'p_disciplina',
  'p_fase',
  'p_categoria',
  'p_nome',
  'p_descricao',
  'p_criticidade',
  'p_origem',
  'p_referencia_normativa',
  'p_metodologia_minima',
  'p_ordem',
  'p_status',
  'p_motivo_bloqueio',
  'p_responsavel_id',
  'p_data_conclusao',
] as const satisfies readonly (keyof UpsertTarefaRpcParams)[]

function toUpsertTarefaRpcPayload(params: UpsertTarefaRpcParams): UpsertTarefaRpcParams {
  const payload = {} as UpsertTarefaRpcParams
  for (const key of UPSERT_TAREFA_RPC_KEYS) {
    if (params[key] !== undefined) {
      payload[key] = params[key] as never
    }
  }
  return payload
}

export interface TarefaInsertRow {
  projeto_id: string
  revisao_id?: string | null
  template_id?: string | null
  disciplina: Disciplina
  fase: Fase
  categoria: string
  nome: string
  descricao?: string | null
  criticidade?: Criticidade
  origem?: OrigemNormativa
  referencia_normativa?: string | null
  metodologia_minima?: Metodologia | null
  ordem?: number
  status?: TarefaStatus
  responsavel_id?: string | null
}

const TAREFA_SELECT = '*, profiles!responsavel_id(nome, papel)'

export function mapTarefaRow(raw: Record<string, unknown>): Tarefa {
  const profile = raw.profiles as { nome: string; papel: Papel } | null
  const { profiles: _profiles, ...rest } = raw
  return {
    ...(rest as unknown as Tarefa),
    responsavel_nome: profile?.nome ?? null,
    responsavel_papel: profile?.papel ?? null,
  }
}

export function tarefaToRpcParams(
  tarefa: Tarefa,
  overrides: Partial<UpsertTarefaRpcParams> = {},
): UpsertTarefaRpcParams {
  return {
    p_id: tarefa.id,
    p_projeto_id: tarefa.projeto_id,
    p_revisao_id: tarefa.revisao_id,
    p_template_id: tarefa.template_id,
    p_disciplina: tarefa.disciplina,
    p_fase: tarefa.fase,
    p_categoria: tarefa.categoria,
    p_nome: tarefa.nome,
    p_descricao: tarefa.descricao,
    p_criticidade: tarefa.criticidade,
    p_origem: tarefa.origem,
    p_referencia_normativa: tarefa.referencia_normativa,
    p_metodologia_minima: tarefa.metodologia_minima,
    p_ordem: tarefa.ordem,
    p_status: tarefa.status,
    p_motivo_bloqueio: tarefa.motivo_bloqueio,
    p_responsavel_id: tarefa.responsavel_id,
    p_data_conclusao: tarefa.data_conclusao,
    ...overrides,
  }
}

export function tarefaInsertRowToRpcParams(row: TarefaInsertRow): UpsertTarefaRpcParams {
  return {
    p_id: null,
    p_projeto_id: row.projeto_id,
    p_revisao_id: row.revisao_id ?? null,
    p_template_id: row.template_id ?? null,
    p_disciplina: row.disciplina,
    p_fase: row.fase,
    p_categoria: row.categoria,
    p_nome: row.nome,
    p_descricao: row.descricao ?? null,
    p_criticidade: row.criticidade ?? 'normal',
    p_origem: row.origem ?? 'interno',
    p_referencia_normativa: row.referencia_normativa ?? null,
    p_metodologia_minima: row.metodologia_minima ?? null,
    p_ordem: row.ordem ?? 0,
    p_status: row.status ?? 'pendente',
    p_motivo_bloqueio: null,
    p_responsavel_id: row.responsavel_id ?? null,
    p_data_conclusao: null,
  }
}

export async function upsertTarefaRpc(params: UpsertTarefaRpcParams): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_tarefa', toUpsertTarefaRpcPayload(params))
  if (error) throw new Error(error.message)
  if (!data) throw new Error('upsert_tarefa não retornou id')
  return data as string
}

export async function deleteTarefaRpc(tarefaId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_tarefa', { p_id: tarefaId })
  if (error) throw new Error(error.message)
}

export async function fetchTarefaById(tarefaId: string): Promise<Tarefa> {
  const { data, error } = await supabase
    .from('tarefas')
    .select(TAREFA_SELECT)
    .eq('id', tarefaId)
    .is('deleted_at', null)
    .single()

  if (error) throw new Error(error.message)
  return mapTarefaRow(data as Record<string, unknown>)
}

export async function fetchTarefasByIds(tarefaIds: string[]): Promise<Tarefa[]> {
  if (tarefaIds.length === 0) return []

  const { data, error } = await supabase
    .from('tarefas')
    .select(TAREFA_SELECT)
    .in('id', tarefaIds)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  const byId = new Map(
    (data ?? []).map((row) => {
      const tarefa = mapTarefaRow(row as Record<string, unknown>)
      return [tarefa.id, tarefa] as const
    }),
  )

  return tarefaIds.map((id) => byId.get(id)).filter((t): t is Tarefa => t != null)
}

export async function patchTarefaRpc(
  tarefaId: string,
  patch: Partial<UpsertTarefaRpcParams>,
): Promise<string> {
  const tarefa = await fetchTarefaById(tarefaId)
  return upsertTarefaRpc(tarefaToRpcParams(tarefa, patch))
}

export async function insertTarefasRpc(rows: TarefaInsertRow[]): Promise<Tarefa[]> {
  if (rows.length === 0) return []

  const ids: string[] = []
  for (const row of rows) {
    const id = await upsertTarefaRpc(tarefaInsertRowToRpcParams(row))
    ids.push(id)
  }

  return fetchTarefasByIds(ids)
}

export async function upsertTarefaRpcAndFetch(
  params: UpsertTarefaRpcParams,
): Promise<Tarefa> {
  const id = await upsertTarefaRpc(params)
  return fetchTarefaById(id)
}
