import { invalidateCategoriasCache } from './categoriaConfig'
import { invalidateDisciplinasCache } from './disciplinaConfig'
import { invalidateFasesCache } from './faseConfig'
import { supabase } from './supabase'
import type { Papel } from '../types'

export type ConfigSnapshotEscopo =
  | 'tudo'
  | 'disciplinas'
  | 'fases'
  | 'categorias'
  | 'templates'
  | 'configuracoes'

export type ConfigSnapshotTabEscopo = Exclude<ConfigSnapshotEscopo, 'tudo' | 'configuracoes'>

export const CONFIG_SNAPSHOT_ESCOPO_LABELS: Record<ConfigSnapshotEscopo, string> = {
  tudo: 'tudo',
  disciplinas: 'disciplinas',
  fases: 'fases',
  categorias: 'categorias',
  templates: 'templates',
  configuracoes: 'configurações',
}

export interface ConfigSnapshotRow {
  id: string
  nome: string
  automatico: boolean
  created_at: string
  created_by: string | null
  autor_nome: string | null
}

export interface RestaurarConfigSnapshotResult {
  disciplinas_removidas: number
  fases_removidas: number
  categorias_removidas: number
  templates_removidos: number
}

export function canManageConfigSnapshots(papel: Papel): boolean {
  return papel === 'gestor' || papel === 'diretor_executivo'
}

export function formatSnapshotDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mapSnapshotRow(row: Record<string, unknown>): ConfigSnapshotRow {
  const profile = row.profiles as { nome?: string } | null | undefined
  return {
    id: row.id as string,
    nome: row.nome as string,
    automatico: Boolean(row.automatico),
    created_at: row.created_at as string,
    created_by: (row.created_by as string | null) ?? null,
    autor_nome: profile?.nome ?? null,
  }
}

function mapRestaurarResult(data: Record<string, unknown>): RestaurarConfigSnapshotResult {
  return {
    disciplinas_removidas: Number(data.disciplinas_removidas ?? 0),
    fases_removidas: Number(data.fases_removidas ?? 0),
    categorias_removidas: Number(data.categorias_removidas ?? 0),
    templates_removidos: Number(data.templates_removidos ?? 0),
  }
}

export async function fetchConfigSnapshots(): Promise<ConfigSnapshotRow[]> {
  const { data, error } = await supabase
    .from('config_snapshots')
    .select('id, nome, automatico, created_at, created_by, profiles!created_by(nome)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSnapshotRow(row as Record<string, unknown>))
}

export async function salvarConfigSnapshot(
  nome: string,
  automatico = false,
): Promise<string> {
  const { data, error } = await supabase.rpc('salvar_config_snapshot', {
    p_nome: nome.trim(),
    p_automatico: automatico,
  })

  if (error) throw new Error(error.message)
  return data as string
}

export async function renameConfigSnapshot(id: string, novoNome: string): Promise<void> {
  const { error } = await supabase.rpc('rename_config_snapshot', {
    p_id: id,
    p_novo_nome: novoNome.trim(),
  })

  if (error) throw new Error(error.message)
}

export async function deleteConfigSnapshot(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_config_snapshot', {
    p_id: id,
  })

  if (error) throw new Error(error.message)
}

export async function restaurarConfigSnapshot(
  id: string,
  escopo: ConfigSnapshotEscopo = 'tudo',
): Promise<RestaurarConfigSnapshotResult> {
  const { data, error } = await supabase.rpc('restaurar_config_snapshot', {
    p_id: id,
    p_escopo: escopo,
  })

  if (error) throw new Error(error.message)
  return mapRestaurarResult(data as Record<string, unknown>)
}

export function invalidateConfigCacheForEscopo(escopo: ConfigSnapshotEscopo): void {
  if (escopo === 'tudo' || escopo === 'disciplinas') invalidateDisciplinasCache()
  if (escopo === 'tudo' || escopo === 'fases') invalidateFasesCache()
  if (escopo === 'tudo' || escopo === 'categorias' || escopo === 'templates') {
    invalidateCategoriasCache()
  }
}

export function invalidateAllConfigCaches(): void {
  invalidateConfigCacheForEscopo('tudo')
}

function formatCountList(parts: string[]): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
}

export function formatRestaurarSnapshotToast(
  result: RestaurarConfigSnapshotResult,
  escopo: ConfigSnapshotEscopo = 'tudo',
): string {
  const parts: string[] = []
  const showDisciplinas = escopo === 'tudo' || escopo === 'disciplinas'
  const showFases = escopo === 'tudo' || escopo === 'fases'
  const showCategorias = escopo === 'tudo' || escopo === 'categorias'
  const showTemplates = escopo === 'tudo' || escopo === 'templates'

  if (showDisciplinas && result.disciplinas_removidas > 0) {
    parts.push(`${result.disciplinas_removidas} disciplinas`)
  }
  if (showFases && result.fases_removidas > 0) {
    parts.push(`${result.fases_removidas} fases`)
  }
  if (showCategorias && result.categorias_removidas > 0) {
    parts.push(`${result.categorias_removidas} categorias`)
  }
  if (showTemplates && result.templates_removidos > 0) {
    parts.push(`${result.templates_removidos} templates`)
  }

  if (parts.length === 0) return 'Restaurado com sucesso.'
  return `Restaurado. ${formatCountList(parts)} removidos.`
}
