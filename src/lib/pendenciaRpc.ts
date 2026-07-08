import { supabase } from './supabase'
import type { PendenciaOrgao, PendenciaStatus, PendenciaTipo } from '../types'

export interface UpsertPendenciaRpcParams {
  p_id: string | null
  p_projeto_id?: string
  p_orgao?: PendenciaOrgao
  p_tipo?: PendenciaTipo
  p_descricao?: string
  p_prazo?: string | null
  p_status?: PendenciaStatus
  p_data_recebimento?: string | null
  p_tarefas_vinculadas?: string[]
  p_revisao_gerada_id?: string | null
  p_criado_por?: string | null
}

const UPSERT_PENDENCIA_RPC_KEYS = [
  'p_id',
  'p_projeto_id',
  'p_orgao',
  'p_tipo',
  'p_descricao',
  'p_prazo',
  'p_status',
  'p_data_recebimento',
  'p_tarefas_vinculadas',
  'p_revisao_gerada_id',
  'p_criado_por',
] as const satisfies readonly (keyof UpsertPendenciaRpcParams)[]

function toUpsertPendenciaRpcPayload(
  params: UpsertPendenciaRpcParams,
): UpsertPendenciaRpcParams {
  const payload = {} as UpsertPendenciaRpcParams
  for (const key of UPSERT_PENDENCIA_RPC_KEYS) {
    if (params[key] !== undefined) {
      payload[key] = params[key] as never
    }
  }
  return payload
}

export async function upsertPendenciaRpc(params: UpsertPendenciaRpcParams): Promise<string> {
  const { data, error } = await supabase.rpc(
    'upsert_pendencia',
    toUpsertPendenciaRpcPayload(params),
  )
  if (error) throw new Error(error.message)
  if (!data) throw new Error('upsert_pendencia não retornou id')
  return data as string
}

export async function deletePendenciaRpc(pendenciaId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_pendencia', { p_id: pendenciaId })
  if (error) throw new Error(error.message)
}

export async function fetchPendenciaById(pendenciaId: string) {
  const { data, error } = await supabase
    .from('pendencias_externas')
    .select('*, profiles!criado_por(nome)')
    .eq('id', pendenciaId)
    .is('deleted_at', null)
    .single()

  if (error) throw new Error(error.message)
  return data
}
