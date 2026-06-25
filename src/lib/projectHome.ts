import { supabase } from './supabase'

export interface ProjetoHomeMetadata {
  nome_empreendimento?: string
  complemento?: string
  bairro?: string
  arquivo_base?: string
  protocolo_emasa?: string
  data_entrada_emasa?: string
  data_prevista_aprovacao_emasa?: string
  data_aprovacao_real_emasa?: string
  processo_cbmsc?: string
  data_protocolo_cbmsc?: string
  data_prevista_aprovacao_cbmsc?: string
  data_aprovacao_real_cbmsc?: string
  nome_rt?: string
  numero_art?: string
  numero_crea_cau?: string
  observacoes_tecnicas?: string
  /** Legado — migrado para campos específicos quando possível */
  data_protocolo_real?: string
  numero_crea?: string
}

export type ProjetoHomeMetadataField = keyof ProjetoHomeMetadata

export type ProjetoHomeColumnField = 'endereco' | 'tipo_edificacao' | 'cliente_id'

const METADATA_STRING_KEYS: ProjetoHomeMetadataField[] = [
  'nome_empreendimento',
  'complemento',
  'bairro',
  'arquivo_base',
  'protocolo_emasa',
  'data_entrada_emasa',
  'data_prevista_aprovacao_emasa',
  'data_aprovacao_real_emasa',
  'processo_cbmsc',
  'data_protocolo_cbmsc',
  'data_prevista_aprovacao_cbmsc',
  'data_aprovacao_real_cbmsc',
  'nome_rt',
  'numero_art',
  'numero_crea_cau',
  'observacoes_tecnicas',
  'data_protocolo_real',
  'numero_crea',
]

function readString(m: Record<string, unknown>, key: string): string {
  return typeof m[key] === 'string' ? (m[key] as string) : ''
}

export function parseProjetoHomeMetadata(
  metadata: Record<string, unknown> | null | undefined,
): ProjetoHomeMetadata {
  const m = metadata ?? {}
  const parsed: ProjetoHomeMetadata = {}

  for (const key of METADATA_STRING_KEYS) {
    parsed[key] = readString(m, key)
  }

  if (!parsed.numero_crea_cau && parsed.numero_crea) {
    parsed.numero_crea_cau = parsed.numero_crea
  }

  return parsed
}

export async function updateProjetoMetadataKey(
  projetoId: string,
  currentMetadata: Record<string, unknown>,
  key: string,
  value: string,
): Promise<Record<string, unknown>> {
  const next = {
    ...currentMetadata,
    [key]: value.trim() || null,
  }

  const { error } = await supabase
    .from('projetos')
    .update({
      metadata: next,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projetoId)

  if (error) throw new Error(error.message)
  return next
}

export async function updateProjetoMetadataField(
  projetoId: string,
  currentMetadata: Record<string, unknown>,
  field: ProjetoHomeMetadataField,
  value: string,
): Promise<Record<string, unknown>> {
  const next = {
    ...currentMetadata,
    [field]: value.trim() || null,
  }

  const { error } = await supabase
    .from('projetos')
    .update({
      metadata: next,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projetoId)

  if (error) throw new Error(error.message)
  return next
}

export async function updateProjetoColumn(
  projetoId: string,
  field: ProjetoHomeColumnField,
  value: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('projetos')
    .update({
      [field]: value,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projetoId)

  if (error) throw new Error(error.message)
}
