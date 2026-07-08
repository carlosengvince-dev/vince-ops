import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchAllFasesConfig,
  getPhaseLabel,
  getPhaseSequence,
  type FaseConfig,
} from '../lib/faseConfig'
import type { Disciplina, Fase } from '../types'

interface FasesConfigContextValue {
  loading: boolean
  fases: FaseConfig[]
  refresh: () => Promise<void>
  getSequence: (disciplina: Disciplina) => Fase[]
  getLabel: (codigo: Fase, disciplina?: Disciplina) => string
  getFases: (disciplina: Disciplina) => FaseConfig[]
}

const FasesConfigContext = createContext<FasesConfigContextValue | null>(null)

export function FasesConfigProvider({ children }: { children: ReactNode }) {
  const [fases, setFases] = useState<FaseConfig[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const rows = await fetchAllFasesConfig({ includeInactive: true })
    setFases(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<FasesConfigContextValue>(
    () => ({
      loading,
      fases,
      refresh,
      getSequence: (disciplina) => getPhaseSequence(disciplina),
      getLabel: (codigo, disciplina) => getPhaseLabel(codigo, disciplina),
      getFases: (disciplina) =>
        fases
          .filter((f) => f.disciplina === disciplina)
          .sort((a, b) => a.ordem - b.ordem),
    }),
    [fases, loading, refresh],
  )

  return <FasesConfigContext.Provider value={value}>{children}</FasesConfigContext.Provider>
}

export function useFasesConfig(): FasesConfigContextValue {
  const ctx = useContext(FasesConfigContext)
  if (!ctx) {
    throw new Error('useFasesConfig deve ser usado dentro de FasesConfigProvider')
  }
  return ctx
}

export function usePhaseLabel(codigo: Fase, disciplina?: Disciplina): string {
  const { getLabel } = useFasesConfig()
  return getLabel(codigo, disciplina)
}
