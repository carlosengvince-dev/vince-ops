import { supabase } from './supabase'
import type { Disciplina, DocumentoProjeto, DocumentoStatus } from '../types'

export interface UpsertDocumentoProjetoRpcParams {
  p_id: string | null
  p_projeto_id?: string
  p_disciplina?: Disciplina | null
  p_nome?: string
  p_tipo?: string
  p_status?: DocumentoStatus
  p_critico?: boolean
  p_observacoes?: string | null
  p_data_recebimento?: string | null
}

const UPSERT_DOCUMENTO_PROJETO_RPC_KEYS = [
  'p_id',
  'p_projeto_id',
  'p_disciplina',
  'p_nome',
  'p_tipo',
  'p_status',
  'p_critico',
  'p_observacoes',
  'p_data_recebimento',
] as const satisfies readonly (keyof UpsertDocumentoProjetoRpcParams)[]

function toUpsertDocumentoProjetoRpcPayload(
  params: UpsertDocumentoProjetoRpcParams,
): UpsertDocumentoProjetoRpcParams {
  const payload = {} as UpsertDocumentoProjetoRpcParams
  for (const key of UPSERT_DOCUMENTO_PROJETO_RPC_KEYS) {
    if (params[key] !== undefined) {
      payload[key] = params[key] as never
    }
  }
  return payload
}

export async function upsertDocumentoProjetoRpc(
  params: UpsertDocumentoProjetoRpcParams,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    'upsert_documento_projeto',
    toUpsertDocumentoProjetoRpcPayload(params),
  )
  if (error) throw new Error(error.message)
  if (!data) throw new Error('upsert_documento_projeto não retornou id')
  return data as string
}

export async function deleteDocumentoProjetoRpc(documentoId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_documento_projeto', { p_id: documentoId })
  if (error) throw new Error(error.message)
}

export async function fetchDocumentoProjetoById(documentoId: string): Promise<DocumentoProjeto> {
  const { data, error } = await supabase
    .from('documentos_projeto')
    .select('*')
    .eq('id', documentoId)
    .is('deleted_at', null)
    .single()

  if (error) throw new Error(error.message)
  return data as DocumentoProjeto
}

export async function insertDocumentosProjetoRpc(
  projetoId: string,
  docs: Array<{
    nome: string
    tipo: string
    critico: boolean
    disciplina?: Disciplina | null
  }>,
): Promise<void> {
  await Promise.all(
    docs.map((doc) =>
      upsertDocumentoProjetoRpc({
        p_id: null,
        p_projeto_id: projetoId,
        p_nome: doc.nome,
        p_tipo: doc.tipo,
        p_critico: doc.critico,
        p_disciplina: doc.disciplina ?? null,
        p_status: 'aguardando',
      }),
    ),
  )
}
