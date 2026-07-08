import { supabase } from './supabase'
import type { Cliente } from '../types'

export interface UpsertClienteRpcParams {
  p_id: string | null
  p_nome?: string
  p_contato?: string | null
  p_email?: string | null
  p_telefone?: string | null
  p_cnpj_cpf?: string | null
  p_observacoes?: string | null
  p_metadata?: Record<string, unknown>
}

const UPSERT_CLIENTE_RPC_KEYS = [
  'p_id',
  'p_nome',
  'p_contato',
  'p_email',
  'p_telefone',
  'p_cnpj_cpf',
  'p_observacoes',
  'p_metadata',
] as const satisfies readonly (keyof UpsertClienteRpcParams)[]

function toUpsertClienteRpcPayload(params: UpsertClienteRpcParams): UpsertClienteRpcParams {
  const payload = {} as UpsertClienteRpcParams
  for (const key of UPSERT_CLIENTE_RPC_KEYS) {
    if (params[key] !== undefined) {
      payload[key] = params[key] as never
    }
  }
  return payload
}

export async function upsertClienteRpc(params: UpsertClienteRpcParams): Promise<string> {
  const { data, error } = await supabase.rpc(
    'upsert_cliente',
    toUpsertClienteRpcPayload(params),
  )
  if (error) throw new Error(error.message)
  if (!data) throw new Error('upsert_cliente não retornou id')
  return data as string
}

export async function deleteClienteRpc(clienteId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_cliente', { p_id: clienteId })
  if (error) throw new Error(error.message)
}

export async function fetchClienteById(clienteId: string): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clienteId)
    .is('deleted_at', null)
    .single()

  if (error) throw new Error(error.message)
  return data as Cliente
}
