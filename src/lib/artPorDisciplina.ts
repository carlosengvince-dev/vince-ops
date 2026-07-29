import type { Disciplina } from '../types'
import { patchProjetoRpc } from './projetoRpc'

export type ArtPorDisciplina = Partial<Record<Disciplina, string>>

export function parseArtPorDisciplina(
  metadata: Record<string, unknown> | null | undefined,
): ArtPorDisciplina {
  const raw = metadata?.art_por_disciplina
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const result: ArtPorDisciplina = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) {
      result[key as Disciplina] = value.trim()
    }
  }
  return result
}

export async function updateArtPorDisciplina(
  projetoId: string,
  currentMetadata: Record<string, unknown>,
  disciplina: Disciplina,
  value: string,
): Promise<Record<string, unknown>> {
  const current = parseArtPorDisciplina(currentMetadata)
  const trimmed = value.trim()
  const nextMap: ArtPorDisciplina = { ...current }

  if (trimmed) {
    nextMap[disciplina] = trimmed
  } else {
    delete nextMap[disciplina]
  }

  const next = {
    ...currentMetadata,
    art_por_disciplina: nextMap,
  }

  await patchProjetoRpc(projetoId, { metadata: next })
  return next
}
