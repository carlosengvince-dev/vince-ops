import { supabase } from './supabase'
import type {
  Disciplina,
  FasesAtuais,
  Metodologia,
  ModoCriacao,
  Projeto,
  ProjetoStatus,
} from '../types'

export interface UpsertProjetoRpcParams {
  p_id: string | null
  p_codigo?: string
  p_nome?: string
  p_cliente_id?: string | null
  p_endereco?: string | null
  p_tipo_edificacao?: string | null
  p_area_m2?: number | null
  p_disciplinas?: Disciplina[]
  p_metodologia?: Partial<Record<Disciplina, Metodologia>>
  p_status?: ProjetoStatus
  p_justificativa_cancelamento?: string | null
  p_modo_criacao?: ModoCriacao
  p_fases_atuais?: FasesAtuais
  p_data_inicio?: string | null
  p_data_protocolo_prevista?: string | null
  p_data_entrega_prevista?: string | null
  p_data_conclusao_real?: string | null
  p_horas_estimadas_hid?: number | null
  p_horas_estimadas_ppci?: number | null
  p_responsaveis?: Partial<Record<Disciplina, string[]>>
  p_snapshot_fechamento?: Record<string, unknown> | null
  p_metadata?: Record<string, unknown>
}

const UPSERT_PROJETO_RPC_KEYS = [
  'p_id',
  'p_codigo',
  'p_nome',
  'p_cliente_id',
  'p_endereco',
  'p_tipo_edificacao',
  'p_area_m2',
  'p_disciplinas',
  'p_metodologia',
  'p_status',
  'p_modo_criacao',
  'p_fases_atuais',
  'p_data_inicio',
  'p_data_protocolo_prevista',
  'p_data_entrega_prevista',
  'p_data_conclusao_real',
  'p_horas_estimadas_hid',
  'p_horas_estimadas_ppci',
  'p_responsaveis',
  'p_justificativa_cancelamento',
  'p_snapshot_fechamento',
  'p_metadata',
] as const satisfies readonly (keyof UpsertProjetoRpcParams)[]

function toUpsertProjetoRpcPayload(params: UpsertProjetoRpcParams): UpsertProjetoRpcParams {
  const payload = {} as UpsertProjetoRpcParams
  for (const key of UPSERT_PROJETO_RPC_KEYS) {
    if (params[key] !== undefined) {
      payload[key] = params[key] as never
    }
  }
  return payload
}

export function projectRowToRpcParams(
  row: Record<string, unknown>,
  id: string | null = null,
): UpsertProjetoRpcParams {
  return {
    p_id: id,
    p_codigo: row.codigo as string,
    p_nome: row.nome as string,
    p_cliente_id: (row.cliente_id as string | null) ?? null,
    p_endereco: (row.endereco as string | null) ?? null,
    p_tipo_edificacao: (row.tipo_edificacao as string | null) ?? null,
    p_area_m2: (row.area_m2 as number | null) ?? null,
    p_disciplinas: row.disciplinas as Disciplina[],
    p_metodologia: row.metodologia as Partial<Record<Disciplina, Metodologia>>,
    p_status: row.status as ProjetoStatus,
    p_justificativa_cancelamento: (row.justificativa_cancelamento as string | null) ?? null,
    p_modo_criacao: row.modo_criacao as ModoCriacao,
    p_fases_atuais: row.fases_atuais as FasesAtuais,
    p_data_inicio: (row.data_inicio as string | null) ?? null,
    p_data_protocolo_prevista: (row.data_protocolo_prevista as string | null) ?? null,
    p_data_entrega_prevista: (row.data_entrega_prevista as string | null) ?? null,
    p_data_conclusao_real: (row.data_conclusao_real as string | null) ?? null,
    p_horas_estimadas_hid: (row.horas_estimadas_hid as number | null) ?? null,
    p_horas_estimadas_ppci: (row.horas_estimadas_ppci as number | null) ?? null,
    p_responsaveis: (row.responsaveis as Partial<Record<Disciplina, string[]>>) ?? {},
    p_snapshot_fechamento: (row.snapshot_fechamento as Record<string, unknown> | null) ?? null,
    p_metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

export function projetoToRpcParams(
  projeto: Projeto,
  overrides: Partial<UpsertProjetoRpcParams> = {},
): UpsertProjetoRpcParams {
  return {
    p_id: projeto.id,
    p_codigo: projeto.codigo,
    p_nome: projeto.nome,
    p_cliente_id: projeto.cliente_id,
    p_endereco: projeto.endereco,
    p_tipo_edificacao: projeto.tipo_edificacao,
    p_area_m2: projeto.area_m2,
    p_disciplinas: projeto.disciplinas,
    p_metodologia: projeto.metodologia,
    p_status: projeto.status,
    p_justificativa_cancelamento: projeto.justificativa_cancelamento,
    p_modo_criacao: projeto.modo_criacao,
    p_fases_atuais: projeto.fases_atuais,
    p_data_inicio: projeto.data_inicio,
    p_data_protocolo_prevista: projeto.data_protocolo_prevista,
    p_data_entrega_prevista: projeto.data_entrega_prevista,
    p_data_conclusao_real: projeto.data_conclusao_real,
    p_horas_estimadas_hid: projeto.horas_estimadas_hid,
    p_horas_estimadas_ppci: projeto.horas_estimadas_ppci,
    p_responsaveis: projeto.responsaveis,
    p_snapshot_fechamento: projeto.snapshot_fechamento,
    p_metadata: projeto.metadata,
    ...overrides,
  }
}

export async function upsertProjetoRpc(params: UpsertProjetoRpcParams): Promise<string> {
  const { data, error } = await supabase.rpc(
    'upsert_projeto',
    toUpsertProjetoRpcPayload(params),
  )
  if (error) throw new Error(error.message)
  if (!data) throw new Error('upsert_projeto não retornou id')
  return data as string
}

export async function deleteProjetoRpc(projetoId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_projeto', { p_id: projetoId })
  if (error) throw new Error(error.message)
}

export async function fetchProjetoById(projetoId: string): Promise<Projeto> {
  const { data, error } = await supabase
    .from('projetos')
    .select('*')
    .eq('id', projetoId)
    .is('deleted_at', null)
    .single()

  if (error) throw new Error(error.message)
  return data as Projeto
}

export async function patchProjetoRpc(
  projetoId: string,
  patch: Omit<UpsertProjetoRpcParams, 'p_id'>,
): Promise<string> {
  return upsertProjetoRpc({ p_id: projetoId, ...patch })
}
