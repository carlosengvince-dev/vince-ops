import { supabase } from './supabase'
import type { Disciplina, RevisaoOrigem } from '../types'

export interface UpsertRevisaoRpcParams {
  p_id: string | null
  p_projeto_id?: string
  p_numero?: string
  p_disciplina?: Disciplina
  p_origem?: RevisaoOrigem
  p_descricao?: string | null
  p_status?: 'aberta' | 'concluida'
  p_data_conclusao?: string | null
  p_criado_por?: string | null
}

const UPSERT_REVISAO_RPC_KEYS = [
  'p_id',
  'p_projeto_id',
  'p_numero',
  'p_disciplina',
  'p_origem',
  'p_descricao',
  'p_status',
  'p_data_conclusao',
  'p_criado_por',
] as const satisfies readonly (keyof UpsertRevisaoRpcParams)[]

function toUpsertRevisaoRpcPayload(params: UpsertRevisaoRpcParams): UpsertRevisaoRpcParams {
  const payload = {} as UpsertRevisaoRpcParams
  for (const key of UPSERT_REVISAO_RPC_KEYS) {
    if (params[key] !== undefined) {
      payload[key] = params[key] as never
    }
  }
  return payload
}

export async function upsertRevisaoRpc(params: UpsertRevisaoRpcParams): Promise<string> {
  const { data, error } = await supabase.rpc(
    'upsert_revisao',
    toUpsertRevisaoRpcPayload(params),
  )
  if (error) throw new Error(error.message)
  if (!data) throw new Error('upsert_revisao não retornou id')
  return data as string
}

export async function deleteRevisaoRpc(revisaoId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_revisao', { p_id: revisaoId })
  if (error) throw new Error(error.message)
}

export async function fetchRevisaoById(revisaoId: string) {
  const { data, error } = await supabase
    .from('revisoes')
    .select('*, profiles!criado_por(nome)')
    .eq('id', revisaoId)
    .is('deleted_at', null)
    .single()

  if (error) throw new Error(error.message)
  return data
}
