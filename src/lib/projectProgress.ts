import {
  getFaseAtual,
  getFaseIndex,
} from './constants'
import {
  buildProjetoFaseOverrideMap,
  getActivePhaseSequenceForProjeto,
  getPhaseSequence,
  type ProjetoFaseOverride,
} from './faseConfig'
import type { Disciplina, Fase, ProjetoStatus, TarefaStatus, FasesAtuais } from '../types'
import type { ProjetoListItem } from '../types/project-create'

export type PhaseDotStatus = 'done' | 'current' | 'future'

export interface DisciplineProgress {
  percent: number
  faseAtual: Fase
  phaseDots: { fase: Fase; status: PhaseDotStatus }[]
}

const DONE_TASK_STATUSES: TarefaStatus[] = ['concluido', 'nao_aplica']

function getSequenceForProgress(
  disciplina: Disciplina,
  projetoFaseOverrides?: ProjetoFaseOverride[],
): readonly Fase[] {
  if (projetoFaseOverrides && projetoFaseOverrides.length > 0) {
    const overrideMap = buildProjetoFaseOverrideMap(projetoFaseOverrides)
    return getActivePhaseSequenceForProjeto(disciplina, overrideMap)
  }
  return getPhaseSequence(disciplina)
}

export function calcDisciplineProgress(
  projetoId: string,
  disciplina: Disciplina,
  fasesAtuais: FasesAtuais,
  tarefas: { projeto_id: string; disciplina: string; fase: string; status: string }[],
  projetoFaseOverrides?: ProjetoFaseOverride[],
): number {
  const fases = getSequenceForProgress(disciplina, projetoFaseOverrides)
  const faseAtual = getFaseAtual(fasesAtuais as Record<string, unknown>, disciplina, fases)
  const idx = getFaseIndex(disciplina, faseAtual, fases)
  if (idx < 0) return 0

  const activePhaseSet = new Set(fases)

  let total = 0
  let done = 0

  for (let i = 0; i <= idx; i++) {
    const fase = fases[i]
    const phaseTasks = tarefas.filter(
      (t) =>
        t.projeto_id === projetoId &&
        t.disciplina === disciplina &&
        t.fase === fase &&
        activePhaseSet.has(fase),
    )
    total += phaseTasks.length
    done += phaseTasks.filter((t) =>
      DONE_TASK_STATUSES.includes(t.status as TarefaStatus),
    ).length
  }

  if (total === 0) return idx > 0 ? 100 : 0
  return Math.round((done / total) * 100)
}

export function getPhaseDots(
  disciplina: Disciplina,
  fasesAtuais: FasesAtuais,
  projetoFaseOverrides?: ProjetoFaseOverride[],
): { fase: Fase; status: PhaseDotStatus }[] {
  const fases = getSequenceForProgress(disciplina, projetoFaseOverrides)
  const faseAtual = getFaseAtual(fasesAtuais as Record<string, unknown>, disciplina, fases)
  const currentIdx = getFaseIndex(disciplina, faseAtual, fases)

  return fases.map((fase, idx) => {
    let status: PhaseDotStatus = 'future'
    if (idx < currentIdx) status = 'done'
    else if (idx === currentIdx) status = 'current'
    return { fase, status }
  })
}

export function getDisciplineProgressMap(
  projeto: ProjetoListItem,
  tarefas: { projeto_id: string; disciplina: string; fase: string; status: string }[],
  projetoFaseOverrides?: ProjetoFaseOverride[],
): Record<Disciplina, DisciplineProgress> {
  const result = {} as Record<Disciplina, DisciplineProgress>

  for (const disciplina of projeto.disciplinas) {
    result[disciplina] = {
      percent: calcDisciplineProgress(
        projeto.id,
        disciplina,
        projeto.fases_atuais,
        tarefas,
        projetoFaseOverrides,
      ),
      faseAtual: getFaseAtual(
        projeto.fases_atuais as Record<string, unknown>,
        disciplina,
        getSequenceForProgress(disciplina, projetoFaseOverrides),
      ),
      phaseDots: getPhaseDots(disciplina, projeto.fases_atuais, projetoFaseOverrides),
    }
  }

  return result
}

export function statusBadgeClass(status: ProjetoStatus): string {
  return `proj-badge proj-badge--${status.replace(/_/g, '')}`
}
