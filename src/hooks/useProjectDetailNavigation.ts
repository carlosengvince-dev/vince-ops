import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getFaseAtual } from '../lib/constants'
import {
  buildProjetoFaseOverrideMap,
  getActivePhaseSequenceForProjeto,
  getFrozenPhaseSequence,
  type EstruturaFasesSnapshot,
  type ProjetoFaseOverride,
} from '../lib/faseConfig'
import type { ProjectMainTab } from '../components/projects/ProjectDetailTabs'
import type { Disciplina, Fase, Projeto } from '../types'

const VALID_TABS = new Set<ProjectMainTab>([
  'home',
  'checklist',
  'pendencias',
  'revisoes',
  'atividade',
])

import { getActiveDisciplinaCodigos } from '../lib/disciplinaConfig'

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
  const valid = new Set(getActiveDisciplinaCodigos())
  if (value && valid.has(value) && disciplinas.includes(value)) {
    return value
  }
  return disciplinas[0] ?? null
}

function getPhaseSequenceForNavigation(
  disciplina: Disciplina,
  projetoFaseOverrides: ProjetoFaseOverride[],
  estruturaFases: EstruturaFasesSnapshot | null,
): Fase[] {
  if (estruturaFases) {
    return getFrozenPhaseSequence(disciplina, estruturaFases)
  }
  const overrideMap = buildProjetoFaseOverrideMap(projetoFaseOverrides)
  return getActivePhaseSequenceForProjeto(disciplina, overrideMap)
}

function parseFase(
  value: string | null,
  disciplina: Disciplina,
  projeto: Projeto,
  projetoFaseOverrides: ProjetoFaseOverride[],
  estruturaFases: EstruturaFasesSnapshot | null,
): Fase {
  const fases = getPhaseSequenceForNavigation(disciplina, projetoFaseOverrides, estruturaFases)
  if (value && fases.includes(value as Fase)) {
    return value as Fase
  }
  return getFaseAtual(projeto.fases_atuais as Record<string, unknown>, disciplina, fases)
}

export function useProjectDetailNavigation(
  projeto: Projeto | undefined,
  projetoFaseOverrides: ProjetoFaseOverride[] = [],
  estruturaFases: EstruturaFasesSnapshot | null = null,
) {
  const [searchParams, setSearchParams] = useSearchParams()

  const mainTab = parseTab(searchParams.get('aba'))

  const disciplinaAtiva = useMemo(() => {
    if (!projeto) return null
    return parseDisciplina(searchParams.get('disc'), projeto.disciplinas)
  }, [projeto, searchParams])

  const faseAtiva = useMemo(() => {
    if (!projeto || !disciplinaAtiva) return null
    return parseFase(searchParams.get('fase'), disciplinaAtiva, projeto, projetoFaseOverrides, estruturaFases)
  }, [projeto, disciplinaAtiva, projetoFaseOverrides, estruturaFases, searchParams])

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
      const sequence = getPhaseSequenceForNavigation(disciplina, projetoFaseOverrides, estruturaFases)
      const fase = getFaseAtual(
        projeto.fases_atuais as Record<string, unknown>,
        disciplina,
        sequence,
      )
      patchParams({ disc: disciplina, fase, aba: 'checklist' })
    },
    [patchParams, projeto, projetoFaseOverrides, estruturaFases],
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
