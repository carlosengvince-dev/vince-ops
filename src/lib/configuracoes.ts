import { supabase } from './supabase'

export const DEFAULT_TIPOS_EDIFICACAO = [
  'Residencial',
  'Comercial',
  'Industrial',
  'Misto',
  'Institucional',
  'Educacional',
  'Saúde',
] as const

export interface DocumentoPadraoConfig {
  nome: string
  tipo: string
  critico: boolean
}

export interface CampoProjetoCustom {
  id: string
  nome: string
  tipo: 'text' | 'date' | 'select'
  secao: 'empreendimento' | 'projeto' | 'especificidades'
  opcoes?: string[]
  ativo: boolean
}

let configuracoesIndisponivel = false

function isConfiguracoesUnavailableError(error: { code?: string; message?: string }): boolean {
  if (error.code === 'PGRST205' || error.code === '42P01') return true
  const msg = error.message?.toLowerCase() ?? ''
  return msg.includes('404') || msg.includes('not found') || msg.includes('schema cache')
}

function parseListaValor(valor: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(valor) || valor.length === 0) return [...fallback]
  if (valor.every((v) => typeof v === 'string')) return valor as string[]
  return [...fallback]
}

export async function fetchConfiguracaoJson<T>(
  chave: string,
  fallback: T,
): Promise<T> {
  if (configuracoesIndisponivel) return fallback

  const { data, error } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', chave)
    .maybeSingle()

  if (error) {
    if (isConfiguracoesUnavailableError(error)) {
      configuracoesIndisponivel = true
    }
    return fallback
  }

  if (!data?.valor) return fallback
  return data.valor as T
}

export async function fetchConfiguracaoLista(
  chave: string,
  fallback: readonly string[],
): Promise<string[]> {
  const valor = await fetchConfiguracaoJson<unknown>(chave, fallback)
  return parseListaValor(valor, fallback)
}

export async function saveConfiguracao(
  chave: string,
  valor: unknown,
  _userId?: string,
): Promise<void> {
  const { error } = await supabase.rpc('upsert_configuracao', {
    p_chave: chave,
    p_valor: valor,
  })

  if (error) throw new Error(error.message)
  configuracoesIndisponivel = false
}
