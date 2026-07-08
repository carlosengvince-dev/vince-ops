import { supabase } from './supabase'
import type { Disciplina } from '../types'

export interface CategoriaConfig {
  id: string
  disciplina: Disciplina
  nome: string
  ordem: number
  sistema: boolean
  ativo: boolean
}

export type RenameCategoriaEscopo = 'config' | 'config_templates' | 'tudo'

export interface RenameCategoriaResult {
  templates_afetados: number
  tarefas_afetadas: number
}

const categoriasCache = new Map<Disciplina, CategoriaConfig[]>()

function mapCategoriaRow(row: Record<string, unknown>): CategoriaConfig {
  return {
    id: row.id as string,
    disciplina: row.disciplina as Disciplina,
    nome: row.nome as string,
    ordem: row.ordem as number,
    sistema: Boolean(row.sistema),
    ativo: Boolean(row.ativo),
  }
}

export function invalidateCategoriasCache(disciplina?: Disciplina): void {
  if (disciplina) {
    categoriasCache.delete(disciplina)
    return
  }
  categoriasCache.clear()
}

export function getCachedCategorias(disciplina: Disciplina): CategoriaConfig[] {
  return categoriasCache.get(disciplina) ?? []
}

export async function fetchCategoriasConfig(
  disciplina: Disciplina,
  options?: { includeInactive?: boolean; skipCache?: boolean },
): Promise<CategoriaConfig[]> {
  const includeInactive = options?.includeInactive ?? false
  const skipCache = options?.skipCache ?? false

  if (!includeInactive && !skipCache && categoriasCache.has(disciplina)) {
    return categoriasCache.get(disciplina)!
  }

  let query = supabase
    .from('categorias_config')
    .select('*')
    .eq('disciplina', disciplina)
    .is('deleted_at', null)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  if (!includeInactive) {
    query = query.eq('ativo', true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []).map((row) => mapCategoriaRow(row as Record<string, unknown>))

  if (!includeInactive) {
    categoriasCache.set(disciplina, rows)
  }

  return rows
}

export async function fetchCategoriaNomes(disciplina: Disciplina): Promise<string[]> {
  const rows = await fetchCategoriasConfig(disciplina)
  return rows.map((c) => c.nome)
}

export async function createCategoria(
  disciplina: Disciplina,
  nome: string,
  ordem?: number,
): Promise<string> {
  const trimmed = nome.trim()
  if (!trimmed) throw new Error('Nome da categoria é obrigatório')

  const existing = await fetchCategoriasConfig(disciplina, { skipCache: true })
  const nextOrdem =
    ordem ?? (existing.length > 0 ? Math.max(...existing.map((c) => c.ordem)) + 1 : 0)

  const { data, error } = await supabase.rpc('upsert_categoria_config', {
    p_id: null,
    p_disciplina: disciplina,
    p_nome: trimmed,
    p_ordem: nextOrdem,
    p_ativo: true,
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('upsert_categoria_config não retornou id')

  invalidateCategoriasCache(disciplina)
  return data as string
}

export async function upsertCategoriaConfig(params: {
  p_id: string
  p_disciplina: Disciplina
  p_nome: string
  p_ordem: number
  p_ativo?: boolean
}): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_categoria_config', {
    p_id: params.p_id,
    p_disciplina: params.p_disciplina,
    p_nome: params.p_nome,
    p_ordem: params.p_ordem,
    p_ativo: params.p_ativo ?? true,
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('upsert_categoria_config não retornou id')
  invalidateCategoriasCache(params.p_disciplina)
  return data as string
}

export async function renameCategoria(
  id: string,
  novoNome: string,
  escopo: RenameCategoriaEscopo = 'config_templates',
): Promise<RenameCategoriaResult> {
  const trimmed = novoNome.trim()
  if (!trimmed) throw new Error('Nome da categoria é obrigatório')

  const { data, error } = await supabase.rpc('rename_categoria', {
    p_id: id,
    p_novo_nome: trimmed,
    p_escopo: escopo,
  })
  if (error) throw new Error(error.message)

  invalidateCategoriasCache()
  const result = (data ?? {}) as Record<string, unknown>
  return {
    templates_afetados: Number(result.templates_afetados ?? 0),
    tarefas_afetadas: Number(result.tarefas_afetadas ?? 0),
  }
}

export async function deleteCategoria(id: string, disciplina?: Disciplina): Promise<void> {
  const { error } = await supabase.rpc('delete_categoria_config', { p_id: id })
  if (error) throw new Error(error.message)
  if (disciplina) invalidateCategoriasCache(disciplina)
  else invalidateCategoriasCache()
}
