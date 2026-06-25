import { useCallback, useEffect, useState } from 'react'
import { fetchProjectActivity, type ActivityFeedItem } from '../lib/activityLog'

export function useProjectActivity(projetoId: string | undefined, enabled: boolean) {
  const [items, setItems] = useState<ActivityFeedItem[]>([])
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
      const rows = await fetchProjectActivity(projetoId)
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar atividade')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  return { items, loading, error, refresh: load }
}
