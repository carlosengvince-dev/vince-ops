import { useCallback, useEffect, useState } from 'react'
import { fetchProjectPendencias } from '../lib/pendencias'
import type { PendenciaExterna } from '../types'

export function useProjectPendencias(projetoId: string | undefined, enabled: boolean) {
  const [items, setItems] = useState<PendenciaExterna[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projetoId) {
      setItems([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const rows = await fetchProjectPendencias(projetoId)
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pendências')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  const patchItem = useCallback((id: string, patch: Partial<PendenciaExterna>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const prependItem = useCallback((item: PendenciaExterna) => {
    setItems((prev) => [item, ...prev])
  }, [])

  return { items, loading, error, refresh: load, patchItem, prependItem }
}
