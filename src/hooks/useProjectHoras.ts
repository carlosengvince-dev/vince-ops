import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getHorasChartVersion,
  subscribeHorasChartVersion,
} from '../lib/horasChartVersion'
import { fetchProjetoHoras, type ProjetoHorasResumo } from '../lib/projectHoras'

export function useProjectHoras(projetoId: string) {
  const [horas, setHoras] = useState<ProjetoHorasResumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [horasChartVersion, setHorasChartVersion] = useState(getHorasChartVersion)
  const skipRef = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchProjetoHoras(projetoId)
      setHoras(data)
    } catch {
      setHoras({ totalSegundos: 0, porDisciplina: {} })
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return subscribeHorasChartVersion(() => {
      setHorasChartVersion(getHorasChartVersion())
    })
  }, [])

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false
      return
    }
    void load()
  }, [horasChartVersion, load])

  return { horas, loading }
}
