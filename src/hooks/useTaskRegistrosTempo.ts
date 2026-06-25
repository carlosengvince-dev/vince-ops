import { useCallback, useEffect, useState } from 'react'
import { fetchRegistrosByTarefa, type RegistroTempoRow } from '../lib/registrosTempo'
import { subscribeRegistrosTempoChanged } from '../lib/timerEvents'

export function useTaskRegistrosTempo(tarefaId: string, enabled: boolean) {
  const [registros, setRegistros] = useState<RegistroTempoRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) {
      setRegistros([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchRegistrosByTarefa(tarefaId)
      setRegistros(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar registros de tempo')
      setRegistros([])
    } finally {
      setLoading(false)
    }
  }, [enabled, tarefaId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!enabled) return
    return subscribeRegistrosTempoChanged(() => void load())
  }, [enabled, load])

  return { registros, loading, error, refresh: load }
}
