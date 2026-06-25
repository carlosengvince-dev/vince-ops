import { DEFAULT_DOCUMENTOS_PADRAO } from './constants'
import { fetchConfiguracaoJson, saveConfiguracao } from './configuracoes'
import type { DocumentoPadraoConfig } from './configuracoes'
import { supabase } from './supabase'
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
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'recebido') {
    patch.data_recebimento = dataRecebimento ?? new Date().toISOString().slice(0, 10)
  } else if (status === 'aguardando') {
    patch.data_recebimento = null
  }

  const { error } = await supabase.from('documentos_projeto').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateDocumentoObservacoes(
  id: string,
  observacoes: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('documentos_projeto')
    .update({ observacoes, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function createDocumentoAvulso(
  projetoId: string,
  nome: string,
  tipo: string,
): Promise<DocumentoProjeto> {
  const { data, error } = await supabase
    .from('documentos_projeto')
    .insert({
      projeto_id: projetoId,
      nome: nome.trim(),
      tipo: tipo.trim() || 'Outro',
      status: 'aguardando',
      critico: false,
      disciplina: null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as DocumentoProjeto
}

export async function softDeleteDocumento(id: string): Promise<void> {
  const { error } = await supabase
    .from('documentos_projeto')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export function countCriticosAguardando(documentos: DocumentoProjeto[]): number {
  return documentos.filter(
    (d) => d.deleted_at === null && d.critico && d.status === 'aguardando',
  ).length
}
