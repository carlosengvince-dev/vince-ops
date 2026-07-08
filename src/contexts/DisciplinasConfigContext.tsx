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
  fetchDisciplinasConfig,
  getDisciplinaLabel,
  getCachedDisciplinas,
  injectDisciplinaCssVars,
  type DisciplinaConfig,
} from '../lib/disciplinaConfig'
import type { Disciplina } from '../types'

interface DisciplinasConfigContextValue {
  loading: boolean
  disciplinas: DisciplinaConfig[]
  refresh: () => Promise<void>
  getLabel: (codigo: Disciplina | string) => string
  getActiveCodigos: () => Disciplina[]
  getDisciplina: (codigo: Disciplina | string) => DisciplinaConfig | undefined
}

const DisciplinasConfigContext = createContext<DisciplinasConfigContextValue | null>(null)

export function DisciplinasConfigProvider({ children }: { children: ReactNode }) {
  const [disciplinas, setDisciplinas] = useState<DisciplinaConfig[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const rows = await fetchDisciplinasConfig({ includeInactive: true })
    setDisciplinas(rows)
    injectDisciplinaCssVars(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<DisciplinasConfigContextValue>(
    () => ({
      loading,
      disciplinas,
      refresh,
      getLabel: (codigo) => getDisciplinaLabel(codigo),
      getActiveCodigos: () => getCachedDisciplinas(true).map((d) => d.codigo),
      getDisciplina: (codigo) => disciplinas.find((d) => d.codigo === codigo),
    }),
    [disciplinas, loading, refresh],
  )

  return (
    <DisciplinasConfigContext.Provider value={value}>{children}</DisciplinasConfigContext.Provider>
  )
}

export function useDisciplinasConfig(): DisciplinasConfigContextValue {
  const ctx = useContext(DisciplinasConfigContext)
  if (!ctx) {
    throw new Error('useDisciplinasConfig deve ser usado dentro de DisciplinasConfigProvider')
  }
  return ctx
}

export function useDisciplinaLabel(codigo: Disciplina | string): string {
  const { getLabel } = useDisciplinasConfig()
  return getLabel(codigo)
}
