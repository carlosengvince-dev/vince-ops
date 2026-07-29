import type { Disciplina, Fase } from '../types'
import { patchProjetoRpc } from './projetoRpc'

export const CHECKLIST_CATEGORIA_ORDEM_KEY = 'checklist_categoria_ordem'

export function checklistCategoriaOrdemSlot(
  disciplina: Disciplina,
  fase: Fase,
): string {
  return `${disciplina}|${fase}`
}

export function parseChecklistCategoriaOrdem(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, string[]> {
  const raw = metadata?.[CHECKLIST_CATEGORIA_ORDEM_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const result: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue
    const names = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    if (names.length > 0) result[key] = names
  }
  return result
}

export function getChecklistCategoriaOrdemForPhase(
  metadata: Record<string, unknown> | null | undefined,
  disciplina: Disciplina,
  fase: Fase,
): string[] | null {
  const map = parseChecklistCategoriaOrdem(metadata)
  const list = map[checklistCategoriaOrdemSlot(disciplina, fase)]
  return list && list.length > 0 ? list : null
}

export async function updateChecklistCategoriaOrdem(
  projetoId: string,
  currentMetadata: Record<string, unknown>,
  disciplina: Disciplina,
  fase: Fase,
  orderedNames: string[],
): Promise<Record<string, unknown>> {
  const current = parseChecklistCategoriaOrdem(currentMetadata)
  const slot = checklistCategoriaOrdemSlot(disciplina, fase)
  const nextMap = {
    ...current,
    [slot]: orderedNames,
  }

  const next = {
    ...currentMetadata,
    [CHECKLIST_CATEGORIA_ORDEM_KEY]: nextMap,
  }

  await patchProjetoRpc(projetoId, { metadata: next })
  return next
}

/** Ordena nomes de categoria: override do projeto → ordem config → ordem de aparição. */
export function orderCategoriaNames(
  presentNames: string[],
  projectOverride: string[] | null | undefined,
  configOrdem: ReadonlyArray<{ nome: string; ordem: number }>,
): string[] {
  if (presentNames.length <= 1) return [...presentNames]

  const present = new Set(presentNames)

  if (projectOverride && projectOverride.length > 0) {
    const ordered: string[] = []
    const seen = new Set<string>()
    for (const name of projectOverride) {
      if (present.has(name) && !seen.has(name)) {
        ordered.push(name)
        seen.add(name)
      }
    }
    for (const name of presentNames) {
      if (!seen.has(name)) ordered.push(name)
    }
    return ordered
  }

  const configIndex = new Map(configOrdem.map((c) => [c.nome, c.ordem]))
  const hasConfig = presentNames.some((n) => configIndex.has(n))
  if (!hasConfig) return [...presentNames]

  return [...presentNames].sort((a, b) => {
    const oa = configIndex.get(a)
    const ob = configIndex.get(b)
    if (oa != null && ob != null && oa !== ob) return oa - ob
    if (oa != null && ob == null) return -1
    if (oa == null && ob != null) return 1
    return a.localeCompare(b, 'pt-BR')
  })
}
