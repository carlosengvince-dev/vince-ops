import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getFaseAtual, PHASE_SEQUENCES } from '../lib/constants'
import type { ProjectMainTab } from '../components/projects/ProjectDetailTabs'
import type { Disciplina, Fase, Projeto } from '../types'

const VALID_TABS = new Set<ProjectMainTab>([
  'home',
  'checklist',
  'pendencias',
  'revisoes',
  'atividade',
])

const VALID_DISCIPLINAS = new Set<Disciplina>(['HID', 'PPCI', 'SPK'])

function parseTab(value: string | null): ProjectMainTab {
  if (value && VALID_TABS.has(value as ProjectMainTab)) {
    return value as ProjectMainTab
  }
  return 'home'
}

function parseDisciplina(
  value: string | null,
  disciplinas: Disciplina[],
): Disciplina | null {
  if (!disciplinas.length) return null
  if (value && VALID_DISCIPLINAS.has(value as Disciplina) && disciplinas.includes(value as Disciplina)) {
    return value as Disciplina
  }
  return disciplinas[0] ?? null
}

function parseFase(
  value: string | null,
  disciplina: Disciplina,
  projeto: Projeto,
): Fase {
  const fases = PHASE_SEQUENCES[disciplina] as readonly Fase[]
  if (value && fases.includes(value as Fase)) {
    return value as Fase
  }
  return getFaseAtual(projeto.fases_atuais as Record<string, unknown>, disciplina)
}

export function useProjectDetailNavigation(projeto: Projeto | undefined) {
  const [searchParams, setSearchParams] = useSearchParams()

  const mainTab = parseTab(searchParams.get('aba'))

  const disciplinaAtiva = useMemo(() => {
    if (!projeto) return null
    return parseDisciplina(searchParams.get('disc'), projeto.disciplinas)
  }, [projeto, searchParams])

  const faseAtiva = useMemo(() => {
    if (!projeto || !disciplinaAtiva) return null
    return parseFase(searchParams.get('fase'), disciplinaAtiva, projeto)
  }, [projeto, disciplinaAtiva, searchParams])

  const expandedRevisaoId = searchParams.get('rev')
  const expandedPendenciaId = searchParams.get('pend')
  const expandedTarefaId = searchParams.get('tarefa')

  const patchParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === '') {
              next.delete(key)
            } else {
              next.set(key, value)
            }
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setMainTab = useCallback(
    (tab: ProjectMainTab) => {
      patchParams({ aba: tab })
    },
    [patchParams],
  )

  const setDisciplinaAtiva = useCallback(
    (disciplina: Disciplina) => {
      if (!projeto) return
      const fase = getFaseAtual(
        projeto.fases_atuais as Record<string, unknown>,
        disciplina,
      )
      patchParams({ disc: disciplina, fase, aba: 'checklist' })
    },
    [patchParams, projeto],
  )

  const setFaseAtiva = useCallback(
    (fase: Fase) => {
      patchParams({ fase, aba: 'checklist' })
    },
    [patchParams],
  )

  const setExpandedRevisaoId = useCallback(
    (id: string | null) => {
      patchParams({ rev: id })
    },
    [patchParams],
  )

  const setExpandedPendenciaId = useCallback(
    (id: string | null) => {
      patchParams({ pend: id })
    },
    [patchParams],
  )

  const navigateToRevisoes = useCallback(
    (opts?: { expandRevisaoId?: string }) => {
      patchParams({
        aba: 'revisoes',
        rev: opts?.expandRevisaoId ?? null,
      })
    },
    [patchParams],
  )

  const navigateToChecklist = useCallback(
    (disciplina: Disciplina, fase: Fase, opts?: { tarefaId?: string }) => {
      patchParams({
        aba: 'checklist',
        disc: disciplina,
        fase,
        tarefa: opts?.tarefaId ?? null,
        pend: null,
        rev: null,
      })
    },
    [patchParams],
  )

  const navigateToHome = useCallback(() => {
    patchParams({ aba: null })
  }, [patchParams])

  return {
    mainTab,
    disciplinaAtiva,
    faseAtiva,
    expandedRevisaoId,
    expandedPendenciaId,
    expandedTarefaId,
    setMainTab,
    setDisciplinaAtiva,
    setFaseAtiva,
    setExpandedRevisaoId,
    setExpandedPendenciaId,
    navigateToRevisoes,
    navigateToChecklist,
    navigateToHome,
  }
}
