import {
  getFaseAtual,
  getFaseIndex,
  PHASE_SEQUENCES,
} from './constants'
import type { Disciplina, Fase, ProjetoStatus, TarefaStatus, FasesAtuais } from '../types'
import type { ProjetoListItem } from '../types/project-create'

export type PhaseDotStatus = 'done' | 'current' | 'future'

export interface DisciplineProgress {
  percent: number
  faseAtual: Fase
  phaseDots: { fase: Fase; status: PhaseDotStatus }[]
}

const DONE_TASK_STATUSES: TarefaStatus[] = ['concluido', 'nao_aplica']

export function calcDisciplineProgress(
  projetoId: string,
  disciplina: Disciplina,
  fasesAtuais: FasesAtuais,
  tarefas: { projeto_id: string; disciplina: string; fase: string; status: string }[],
): number {
  const faseAtual = getFaseAtual(fasesAtuais as Record<string, unknown>, disciplina)
  const fases = PHASE_SEQUENCES[disciplina]
  const idx = getFaseIndex(disciplina, faseAtual)
  if (idx < 0) return 0

  let total = 0
  let done = 0

  for (let i = 0; i <= idx; i++) {
    const fase = fases[i]
    const phaseTasks = tarefas.filter(
      (t) => t.projeto_id === projetoId && t.disciplina === disciplina && t.fase === fase,
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
): { fase: Fase; status: PhaseDotStatus }[] {
  const faseAtual = getFaseAtual(fasesAtuais as Record<string, unknown>, disciplina)
  const fases = PHASE_SEQUENCES[disciplina]
  const currentIdx = getFaseIndex(disciplina, faseAtual)

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
): Record<Disciplina, DisciplineProgress> {
  const result = {} as Record<Disciplina, DisciplineProgress>

  for (const disciplina of projeto.disciplinas) {
    result[disciplina] = {
      percent: calcDisciplineProgress(projeto.id, disciplina, projeto.fases_atuais, tarefas),
      faseAtual: getFaseAtual(projeto.fases_atuais as Record<string, unknown>, disciplina),
      phaseDots: getPhaseDots(disciplina, projeto.fases_atuais),
    }
  }

  return result
}

export function statusBadgeClass(status: ProjetoStatus): string {
  return `proj-badge proj-badge--${status.replace(/_/g, '')}`
}
