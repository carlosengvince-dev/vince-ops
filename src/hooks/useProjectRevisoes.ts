import { useCallback, useEffect, useState } from 'react'
import { fetchProjectRevisoes } from '../lib/revisoes'
import type { Disciplina, Revisao } from '../types'

export function useProjectRevisoes(
  projetoId: string | undefined,
  enabled: boolean,
  disciplina?: Disciplina | null,
) {
  const [items, setItems] = useState<Revisao[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projetoId || !disciplina) {
      setItems([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const rows = await fetchProjectRevisoes(projetoId, disciplina)
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar revisões')
    } finally {
      setLoading(false)
    }
  }, [projetoId, disciplina])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  const prependItem = useCallback((item: Revisao) => {
    setItems((prev) => [item, ...prev])
  }, [])

  const patchItem = useCallback((id: string, patch: Partial<Revisao>) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  return { items, loading, error, refresh: load, prependItem, patchItem }
}
