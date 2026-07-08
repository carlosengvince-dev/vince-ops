import { supabase } from './supabase'
import { DISCIPLINA_LABELS } from './constants'
import { slugifyFaseCodigo } from './faseConfig'
import type { Disciplina } from '../types'

export interface DisciplinaConfig {
  id: string
  codigo: Disciplina
  nome: string
  cor_bg: string
  cor_texto: string
  ordem: number
  sistema: boolean
  ativo: boolean
}

const SYSTEM_DISCIPLINAS = new Set<Disciplina>(['HID', 'PPCI', 'SPK'])

const LEGACY_DISCIPLINA_CSS_VARS: Record<
  'HID' | 'PPCI' | 'SPK',
  { bg: string; text: string; border: string }
> = {
  HID: { bg: '--hid-bg', text: '--hid-text', border: '--hid-border' },
  PPCI: { bg: '--ppci-bg', text: '--ppci-text', border: '--ppci-border' },
  SPK: { bg: '--spk-bg', text: '--spk-text', border: '--spk-border' },
}

let disciplinasCache: DisciplinaConfig[] | null = null

function mapDisciplinaRow(row: Record<string, unknown>): DisciplinaConfig {
  return {
    id: row.id as string,
    codigo: row.codigo as Disciplina,
    nome: row.nome as string,
    cor_bg: row.cor_bg as string,
    cor_texto: row.cor_texto as string,
    ordem: row.ordem as number,
    sistema: Boolean(row.sistema),
    ativo: Boolean(row.ativo),
  }
}

function fallbackDisciplinas(): DisciplinaConfig[] {
  return (['HID', 'PPCI', 'SPK'] as Disciplina[]).map((codigo, ordem) => ({
    id: `fallback-${codigo}`,
    codigo,
    nome: DISCIPLINA_LABELS[codigo as keyof typeof DISCIPLINA_LABELS] ?? codigo,
    cor_bg: '#F3F4F6',
    cor_texto: '#374151',
    ordem,
    sistema: true,
    ativo: true,
  }))
}

export function invalidateDisciplinasCache(): void {
  disciplinasCache = null
}

export function getCachedDisciplinas(activeOnly = true): DisciplinaConfig[] {
  const rows = disciplinasCache ?? fallbackDisciplinas()
  return activeOnly
    ? [...rows].filter((d) => d.ativo).sort((a, b) => a.ordem - b.ordem)
    : [...rows].sort((a, b) => a.ordem - b.ordem)
}

export function getCachedDisciplinaByCodigo(
  codigo: Disciplina | string,
  activeOnly = false,
): DisciplinaConfig | undefined {
  const rows = getCachedDisciplinas(activeOnly)
  return rows.find((d) => d.codigo === codigo)
}

export function getDisciplinaLabel(codigo: Disciplina | string): string {
  const found = getCachedDisciplinaByCodigo(codigo, false)
  if (found) return found.nome
  return DISCIPLINA_LABELS[codigo as keyof typeof DISCIPLINA_LABELS] ?? codigo
}

export function getActiveDisciplinaCodigos(): Disciplina[] {
  return getCachedDisciplinas(true).map((d) => d.codigo)
}

export function isSystemDisciplina(codigo: Disciplina | string): boolean {
  return SYSTEM_DISCIPLINAS.has(codigo as Disciplina)
}

export function injectDisciplinaCssVars(rows: DisciplinaConfig[]): void {
  if (typeof document === 'undefined') return
  for (const row of rows) {
    const slug = row.codigo.toLowerCase()
    document.documentElement.style.setProperty(`--disc-${slug}-bg`, row.cor_bg)
    document.documentElement.style.setProperty(`--disc-${slug}-text`, row.cor_texto)

    const legacy = LEGACY_DISCIPLINA_CSS_VARS[row.codigo as keyof typeof LEGACY_DISCIPLINA_CSS_VARS]
    if (legacy) {
      document.documentElement.style.setProperty(legacy.bg, row.cor_bg)
      document.documentElement.style.setProperty(legacy.text, row.cor_texto)
      document.documentElement.style.setProperty(legacy.border, row.cor_texto)
    }
  }
}

export function disciplinaColorsToStyle(row: Pick<DisciplinaConfig, 'cor_bg' | 'cor_texto'>): {
  backgroundColor: string
  color: string
  borderColor: string
} {
  return {
    backgroundColor: row.cor_bg,
    color: row.cor_texto,
    borderColor: row.cor_texto,
  }
}

export async function fetchDisciplinasConfig(
  options?: { includeInactive?: boolean },
): Promise<DisciplinaConfig[]> {
  const includeInactive = options?.includeInactive ?? false

  if (!includeInactive && disciplinasCache) {
    return getCachedDisciplinas(true)
  }

  let query = supabase
    .from('disciplinas_config')
    .select('*')
    .is('deleted_at', null)
    .order('ordem', { ascending: true })

  if (!includeInactive) {
    query = query.eq('ativo', true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []).map((row) => mapDisciplinaRow(row as Record<string, unknown>))
  disciplinasCache = rows.sort((a, b) => a.ordem - b.ordem)
  injectDisciplinaCssVars(disciplinasCache)

  return includeInactive ? rows : rows.filter((d) => d.ativo)
}

export interface UpsertDisciplinaConfigRpcParams {
  p_id: string | null
  p_codigo: string
  p_nome: string
  p_cor_bg?: string
  p_cor_texto?: string
  p_ordem?: number
  p_ativo?: boolean
}

export async function upsertDisciplinaConfigRpc(
  params: UpsertDisciplinaConfigRpcParams,
): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_disciplina_config', {
    p_id: params.p_id,
    p_codigo: params.p_codigo,
    p_nome: params.p_nome,
    p_cor_bg: params.p_cor_bg ?? '#F3F4F6',
    p_cor_texto: params.p_cor_texto ?? '#374151',
    p_ordem: params.p_ordem ?? 0,
    p_ativo: params.p_ativo ?? true,
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('upsert_disciplina_config não retornou id')
  invalidateDisciplinasCache()
  return data as string
}

export async function deleteDisciplinaConfigRpc(disciplinaId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_disciplina_config', { p_id: disciplinaId })
  if (error) throw new Error(error.message)
  invalidateDisciplinasCache()
}

export interface CopiarEstruturaResult {
  fases: number
  categorias: number
  templates: number
}

export async function copiarEstruturaDisciplinaRpc(
  origem: string,
  destino: string,
): Promise<CopiarEstruturaResult> {
  const { data, error } = await supabase.rpc('copiar_estrutura_disciplina', {
    p_origem: origem,
    p_destino: destino,
  })
  if (error) throw new Error(error.message)
  const result = (data ?? {}) as Record<string, unknown>
  return {
    fases: Number(result.fases ?? 0),
    categorias: Number(result.categorias ?? 0),
    templates: Number(result.templates ?? 0),
  }
}

export function slugifyDisciplinaCodigo(nome: string): string {
  return slugifyFaseCodigo(nome)
}

export function formatDisciplinaRpcError(message: string): string {
  if (message.includes('projetos ativos usando esta disciplina')) {
    return 'Há projetos ativos usando esta disciplina. Remova-a dos projetos antes de excluir.'
  }
  if (message.includes('projetos atualmente nesta fase')) {
    return 'Há projetos atualmente nesta fase. Avance-os antes de desativá-la ou excluí-la.'
  }
  if (message.includes('ao menos uma fase ativa')) {
    return 'A disciplina precisa de ao menos uma fase ativa.'
  }
  return message
}
