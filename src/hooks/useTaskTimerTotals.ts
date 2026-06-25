import { useCallback, useEffect, useMemo, useState } from 'react'
import { subscribeTimerStarted, subscribeTimerStopped, subscribeRegistrosTempoChanged } from '../lib/timerEvents'
import { computeRegistroSeconds } from '../lib/timerUtils'
import { supabase } from '../lib/supabase'

interface RegistroRow {
  tarefa_id: string
  inicio: string
  fim: string | null
  duracao_segundos: number | null
}

async function fetchRegistros(projetoId: string): Promise<RegistroRow[]> {
  const { data, error } = await supabase
    .from('registros_tempo')
    .select('tarefa_id, inicio, fim, duracao_segundos')
    .eq('projeto_id', projetoId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
  return (data ?? []) as RegistroRow[]
}

export function useTaskTimerTotals(projectId: string | undefined) {
  const [registros, setRegistros] = useState<RegistroRow[]>([])
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    if (!projectId) {
      setRegistros([])
      return
    }
    const rows = await fetchRegistros(projectId)
    setRegistros(rows)
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const unsubStop = subscribeTimerStopped(() => void load())
    const unsubStart = subscribeTimerStarted(() => void load())
    const unsubRegistros = subscribeRegistrosTempoChanged(() => void load())
    return () => {
      unsubStop()
      unsubStart()
      unsubRegistros()
    }
  }, [load])

  const hasActive = registros.some((r) => r.fim == null)

  useEffect(() => {
    if (!hasActive) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [hasActive])

  const totals = useMemo(() => {
    const map: Record<string, number> = {}
    for (const row of registros) {
      const seconds = computeRegistroSeconds(row.inicio, row.fim, row.duracao_segundos, now)
      map[row.tarefa_id] = (map[row.tarefa_id] ?? 0) + seconds
    }
    return map
  }, [registros, now])

  return { totals, refreshTotals: load }
}
