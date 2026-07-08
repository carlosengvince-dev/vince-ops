import { getActiveDisciplinaCodigos } from './disciplinaConfig'
import { supabase } from './supabase'
import { PHASE_LABELS, PHASE_SEQUENCES } from './constants'
import type { Disciplina, Fase, ProjetoStatus } from '../types'

export interface SnapshotFaseEntry {
  codigo: Fase
  label: string
  ordem: number
}

export type EstruturaFasesSnapshot = Partial<Record<Disciplina, SnapshotFaseEntry[]>>

export interface FaseConfig {
  id: string
  disciplina: Disciplina
  codigo: Fase
  label: string
  ordem: number
  obrigatoria: boolean
  sistema: boolean
  ativo: boolean
}

export interface ProjetoFaseOverride {
  fase_config_id: string
  codigo: Fase
  ativa: boolean
}

const fasesCache = new Map<Disciplina, FaseConfig[]>()
let allFasesCache: FaseConfig[] | null = null

function mapFaseRow(row: Record<string, unknown>): FaseConfig {
  return {
    id: row.id as string,
    disciplina: row.disciplina as Disciplina,
    codigo: row.codigo as Fase,
    label: row.label as string,
    ordem: row.ordem as number,
    obrigatoria: Boolean(row.obrigatoria),
    sistema: Boolean(row.sistema),
    ativo: Boolean(row.ativo),
  }
}

function fallbackFases(disciplina: Disciplina): FaseConfig[] {
  const sequence =
    disciplina in PHASE_SEQUENCES
      ? PHASE_SEQUENCES[disciplina as keyof typeof PHASE_SEQUENCES]
      : []
  return sequence.map((codigo, ordem) => ({
    id: `fallback-${disciplina}-${codigo}`,
    disciplina,
    codigo,
    label: PHASE_LABELS[codigo] ?? codigo,
    ordem,
    obrigatoria: codigo === 'PRE_INFO' || codigo === 'ENTREGA',
    sistema: true,
    ativo: true,
  }))
}

function rebuildCache(rows: FaseConfig[]) {
  allFasesCache = rows
  fasesCache.clear()
  for (const disciplina of getActiveDisciplinaCodigos()) {
    fasesCache.set(
      disciplina,
      rows
        .filter((f) => f.disciplina === disciplina)
        .sort((a, b) => a.ordem - b.ordem),
    )
  }
}

export function invalidateFasesCache(): void {
  fasesCache.clear()
  allFasesCache = null
}

export function getCachedFases(disciplina: Disciplina, activeOnly = true): FaseConfig[] {
  const rows = fasesCache.get(disciplina) ?? fallbackFases(disciplina)
  return activeOnly ? rows.filter((f) => f.ativo) : rows
}

export function getCachedAllFases(activeOnly = true): FaseConfig[] {
  const rows = allFasesCache ?? []
  if (rows.length === 0) {
    return getActiveDisciplinaCodigos().flatMap((d) => fallbackFases(d))
  }
  return activeOnly ? rows.filter((f) => f.ativo) : rows
}

export function getPhaseSequence(disciplina: Disciplina, activeOnly = true): Fase[] {
  return getCachedFases(disciplina, activeOnly).map((f) => f.codigo)
}

export function getPhaseLabel(codigo: Fase, disciplina?: Disciplina): string {
  const searchIn = disciplina
    ? getCachedFases(disciplina, false)
    : getCachedAllFases(false)
  const found = searchIn.find((f) => f.codigo === codigo)
  return found?.label ?? PHASE_LABELS[codigo as keyof typeof PHASE_LABELS] ?? codigo
}

export function getPhaseLabelMap(disciplina: Disciplina): Record<string, string> {
  const map: Record<string, string> = { ...PHASE_LABELS }
  for (const fase of getCachedFases(disciplina, false)) {
    map[fase.codigo] = fase.label
  }
  return map
}

export async function fetchFasesConfig(
  disciplina?: Disciplina,
  options?: { includeInactive?: boolean },
): Promise<FaseConfig[]> {
  const includeInactive = options?.includeInactive ?? false

  if (!includeInactive && disciplina && fasesCache.has(disciplina)) {
    return getCachedFases(disciplina, true)
  }

  let query = supabase
    .from('fases_config')
    .select('*')
    .is('deleted_at', null)
    .order('ordem', { ascending: true })

  if (!includeInactive) {
    query = query.eq('ativo', true)
  }
  if (disciplina) {
    query = query.eq('disciplina', disciplina)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []).map((row) => mapFaseRow(row as Record<string, unknown>))

  if (disciplina) {
    fasesCache.set(disciplina, rows.sort((a, b) => a.ordem - b.ordem))
  } else {
    rebuildCache(rows)
  }

  return includeInactive ? rows : rows.filter((f) => f.ativo)
}

export async function fetchAllFasesConfig(
  options?: { includeInactive?: boolean },
): Promise<FaseConfig[]> {
  return fetchFasesConfig(undefined, options)
}

export async function fetchProjetoFases(projetoId: string): Promise<ProjetoFaseOverride[]> {
  const { data, error } = await supabase
    .from('projeto_fases')
    .select('fase_config_id, ativa, fases_config(codigo)')
    .eq('projeto_id', projetoId)

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((row) => {
      const r = row as Record<string, unknown>
      const fase = r.fases_config as { codigo: Fase } | null
      if (!fase?.codigo) return null
      return {
        fase_config_id: r.fase_config_id as string,
        codigo: fase.codigo,
        ativa: Boolean(r.ativa),
      }
    })
    .filter((item): item is ProjetoFaseOverride => item != null)
}

export function buildProjetoFaseOverrideMap(
  overrides: ProjetoFaseOverride[],
): Map<Fase, boolean> {
  const map = new Map<Fase, boolean>()
  for (const item of overrides) {
    if (item.codigo) map.set(item.codigo, item.ativa)
  }
  return map
}

export function getActivePhasesForProjeto(
  disciplina: Disciplina,
  overrides: Map<Fase, boolean>,
): FaseConfig[] {
  return getCachedFases(disciplina, true).filter((fase) => {
    const override = overrides.get(fase.codigo)
    if (override !== undefined) return override
    return true
  })
}

export function getActivePhaseSequenceForProjeto(
  disciplina: Disciplina,
  overrides: Map<Fase, boolean>,
): Fase[] {
  return getActivePhasesForProjeto(disciplina, overrides).map((f) => f.codigo)
}

export function slugifyFaseCodigo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}

export interface UpsertFaseConfigRpcParams {
  p_id: string | null
  p_disciplina: Disciplina
  p_codigo: string
  p_label: string
  p_ordem: number
  p_ativo?: boolean
}

export async function upsertFaseConfigRpc(params: UpsertFaseConfigRpcParams): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_fase_config', {
    p_id: params.p_id,
    p_disciplina: params.p_disciplina,
    p_codigo: params.p_codigo,
    p_label: params.p_label,
    p_ordem: params.p_ordem,
    p_ativo: params.p_ativo ?? true,
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('upsert_fase_config não retornou id')
  invalidateFasesCache()
  return data as string
}

export async function deleteFaseConfigRpc(faseId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_fase_config', { p_id: faseId })
  if (error) throw new Error(error.message)
  invalidateFasesCache()
}

export async function setProjetoFaseRpc(
  projetoId: string,
  faseConfigId: string,
  ativa: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('set_projeto_fase', {
    p_projeto_id: projetoId,
    p_fase_config_id: faseConfigId,
    p_ativa: ativa,
  })
  if (error) throw new Error(error.message)
}

export async function setFaseProjetosAtivosRpc(
  faseConfigId: string,
  ativa: boolean,
): Promise<number> {
  const { data, error } = await supabase.rpc('set_fase_projetos_ativos', {
    p_fase_config_id: faseConfigId,
    p_ativa: ativa,
  })
  if (error) throw new Error(error.message)
  return (data as number) ?? 0
}

export function getFaseIndexInSequence(sequence: readonly Fase[], fase: Fase): number {
  return sequence.indexOf(fase)
}

export function getNextFaseInSequence(sequence: readonly Fase[], faseAtual: Fase): Fase | null {
  const idx = sequence.indexOf(faseAtual)
  if (idx < 0 || idx >= sequence.length - 1) return null
  return sequence[idx + 1]
}

export function getFaseAtualFromSequence(
  fasesAtuais: Record<string, unknown>,
  disciplina: Disciplina,
  sequence: readonly Fase[],
): Fase {
  const fase = fasesAtuais[disciplina]
  if (typeof fase === 'string' && sequence.includes(fase as Fase)) {
    return fase as Fase
  }
  return sequence[0] ?? 'PRE_INFO'
}

export function getFasesComChecklist(disciplina: Disciplina): Fase[] {
  return getPhaseSequence(disciplina).filter((f) => f !== 'PRE_INFO')
}

export function parseEstruturaFasesFromSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
): EstruturaFasesSnapshot | null {
  const raw = snapshot?.estrutura_fases
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as EstruturaFasesSnapshot
}

export function shouldUseFrozenEstruturaFases(
  status: ProjetoStatus,
  snapshot: Record<string, unknown> | null | undefined,
): boolean {
  if (status !== 'concluido' && status !== 'cancelado') return false
  return parseEstruturaFasesFromSnapshot(snapshot) != null
}

export async function buildEstruturaFasesSnapshot(
  projetoId: string,
  disciplinas: Disciplina[],
): Promise<EstruturaFasesSnapshot> {
  await fetchAllFasesConfig()
  const overrides = await fetchProjetoFases(projetoId)
  const overrideMap = buildProjetoFaseOverrideMap(overrides)
  const result: EstruturaFasesSnapshot = {}

  for (const disciplina of disciplinas) {
    const active = getActivePhasesForProjeto(disciplina, overrideMap)
    result[disciplina] = active.map((f) => ({
      codigo: f.codigo,
      label: f.label,
      ordem: f.ordem,
    }))
  }

  return result
}

export function getFrozenPhasesForDisciplina(
  disciplina: Disciplina,
  estrutura: EstruturaFasesSnapshot,
): FaseConfig[] {
  const rows = estrutura[disciplina] ?? []
  return [...rows]
    .sort((a, b) => a.ordem - b.ordem)
    .map((f) => ({
      id: `snapshot-${disciplina}-${f.codigo}`,
      disciplina,
      codigo: f.codigo,
      label: f.label,
      ordem: f.ordem,
      obrigatoria: f.codigo === 'PRE_INFO' || f.codigo === 'ENTREGA',
      sistema: true,
      ativo: true,
    }))
}

export function getFrozenPhaseSequence(
  disciplina: Disciplina,
  estrutura: EstruturaFasesSnapshot,
): Fase[] {
  return getFrozenPhasesForDisciplina(disciplina, estrutura).map((f) => f.codigo)
}

export function getPhaseLabelFromEstrutura(
  codigo: Fase,
  disciplina: Disciplina,
  estrutura: EstruturaFasesSnapshot | null | undefined,
): string | null {
  if (!estrutura) return null
  const found = estrutura[disciplina]?.find((f) => f.codigo === codigo)
  return found?.label ?? null
}

export function resolvePhaseLabelForProjeto(
  codigo: Fase,
  disciplina: Disciplina,
  opts: {
    status: ProjetoStatus
    snapshotFechamento?: Record<string, unknown> | null
  },
): string {
  if (shouldUseFrozenEstruturaFases(opts.status, opts.snapshotFechamento)) {
    const estrutura = parseEstruturaFasesFromSnapshot(opts.snapshotFechamento)
    const frozen = getPhaseLabelFromEstrutura(codigo, disciplina, estrutura)
    if (frozen) return frozen
  }
  return getPhaseLabel(codigo, disciplina)
}

export function getPhaseSequenceForProjetoView(
  disciplina: Disciplina,
  opts: {
    estruturaFases?: EstruturaFasesSnapshot | null
    projetoFaseOverrides?: ProjetoFaseOverride[]
  },
): Fase[] {
  if (opts.estruturaFases) {
    return getFrozenPhaseSequence(disciplina, opts.estruturaFases)
  }
  const overrideMap = buildProjetoFaseOverrideMap(opts.projetoFaseOverrides ?? [])
  return getActivePhaseSequenceForProjeto(disciplina, overrideMap)
}
