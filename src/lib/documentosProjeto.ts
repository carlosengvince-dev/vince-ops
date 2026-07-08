import { DEFAULT_DOCUMENTOS_PADRAO } from './constants'
import { fetchConfiguracaoJson, saveConfiguracao } from './configuracoes'
import type { DocumentoPadraoConfig } from './configuracoes'
import {
  deleteDocumentoProjetoRpc,
  fetchDocumentoProjetoById,
  upsertDocumentoProjetoRpc,
} from './documentoProjetoRpc'
import type { DocumentoProjeto, DocumentoStatus } from '../types'

export async function fetchDefaultDocumentosPadrao(): Promise<DocumentoPadraoConfig[]> {
  const stored = await fetchConfiguracaoJson<DocumentoPadraoConfig[] | null>(
    'documentos_padrao',
    null,
  )
  if (stored && stored.length > 0) return stored
  return DEFAULT_DOCUMENTOS_PADRAO.map((d) => ({ ...d }))
}

export async function saveDefaultDocumentosPadrao(
  docs: DocumentoPadraoConfig[],
  userId?: string,
): Promise<void> {
  await saveConfiguracao('documentos_padrao', docs, userId)
}

export async function updateDocumentoStatus(
  id: string,
  status: DocumentoStatus,
  dataRecebimento?: string | null,
): Promise<void> {
  let data_recebimento: string | null | undefined
  if (status === 'recebido') {
    data_recebimento = dataRecebimento ?? new Date().toISOString().slice(0, 10)
  } else if (status === 'aguardando') {
    data_recebimento = null
  }

  await upsertDocumentoProjetoRpc({
    p_id: id,
    p_status: status,
    ...(data_recebimento !== undefined ? { p_data_recebimento: data_recebimento } : {}),
  })
}

export async function updateDocumentoObservacoes(
  id: string,
  observacoes: string | null,
): Promise<void> {
  await upsertDocumentoProjetoRpc({
    p_id: id,
    p_observacoes: observacoes,
  })
}

export async function createDocumentoAvulso(
  projetoId: string,
  nome: string,
  tipo: string,
): Promise<DocumentoProjeto> {
  const id = await upsertDocumentoProjetoRpc({
    p_id: null,
    p_projeto_id: projetoId,
    p_nome: nome.trim(),
    p_tipo: tipo.trim() || 'Outro',
    p_status: 'aguardando',
    p_critico: false,
    p_disciplina: null,
  })

  return fetchDocumentoProjetoById(id)
}

export async function softDeleteDocumento(id: string): Promise<void> {
  await deleteDocumentoProjetoRpc(id)
}

export function countCriticosAguardando(documentos: DocumentoProjeto[]): number {
  return documentos.filter(
    (d) => d.deleted_at === null && d.critico && d.status === 'aguardando',
  ).length
}
