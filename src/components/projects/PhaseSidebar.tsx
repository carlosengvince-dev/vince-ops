import {
  DISCIPLINA_LABELS,
  getFaseAtual,
  PHASE_LABELS,
  PHASE_SEQUENCES,
} from '../../lib/constants'
import { calcPhaseProgress } from '../../lib/projectTasks'
import type { Disciplina, Fase, FasesAtuais, Tarefa } from '../../types'
import { disciplinaTabClass } from '../ui/DisciplinaTabs'
import './PhaseSidebar.css'

interface PhaseSidebarProps {
  disciplinas: Disciplina[]
  disciplinaAtiva: Disciplina
  faseAtiva: Fase
  fasesAtuais: FasesAtuais
  tarefas: Tarefa[]
  onDisciplinaChange: (d: Disciplina) => void
  onFaseChange: (f: Fase) => void
}

export function PhaseSidebar({
  disciplinas,
  disciplinaAtiva,
  faseAtiva,
  fasesAtuais,
  tarefas,
  onDisciplinaChange,
  onFaseChange,
}: PhaseSidebarProps) {
  const faseOficial = getFaseAtual(fasesAtuais as Record<string, unknown>, disciplinaAtiva)
  const fases = PHASE_SEQUENCES[disciplinaAtiva]

  return (
    <nav className="phase-sidebar" aria-label="Navegação de fases">
      {disciplinas.length > 1 ? (
        <div className="phase-sidebar__disc-tabs" role="tablist">
          {disciplinas.map((d) => {
            const isActive = d === disciplinaAtiva
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={disciplinaTabClass(d, isActive)}
                onClick={() => onDisciplinaChange(d)}
              >
                {DISCIPLINA_LABELS[d]}
              </button>
            )
          })}
        </div>
      ) : null}

      <p className="phase-sidebar__title">
        {DISCIPLINA_LABELS[disciplinaAtiva]} — Fases
      </p>

      <ul className="phase-sidebar__list">
        {fases.map((fase) => {
          const isActive = fase === faseAtiva
          const isOfficial = fase === faseOficial
          const progress = calcPhaseProgress(tarefas, disciplinaAtiva, fase)

          return (
            <li key={fase}>
              <button
                type="button"
                className={[
                  'phase-sidebar__item',
                  isActive ? 'phase-sidebar__item--active' : '',
                  isOfficial ? 'phase-sidebar__item--official' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onFaseChange(fase)}
              >
                <span className="phase-sidebar__item-label">{PHASE_LABELS[fase]}</span>
                <span className="phase-sidebar__item-badge">{progress}%</span>
                {isOfficial ? (
                  <span className="phase-sidebar__item-tag">atual</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
