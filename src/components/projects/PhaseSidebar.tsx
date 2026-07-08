import {
  getFaseAtual,
} from '../../lib/constants'
import { useDisciplinaLabel } from '../../contexts/DisciplinasConfigContext'
import {
  buildProjetoFaseOverrideMap,
  getActivePhasesForProjeto,
  getFrozenPhasesForDisciplina,
  type EstruturaFasesSnapshot,
  type ProjetoFaseOverride,
} from '../../lib/faseConfig'
import { calcPhaseProgress } from '../../lib/projectTasks'
import type { Disciplina, Fase, FasesAtuais, Tarefa } from '../../types'
import { disciplinaTabClass } from '../ui/DisciplinaTabs'
import { disciplinaTabStyle } from '../../lib/disciplinaTokens'
import './PhaseSidebar.css'

function DisciplinaTabButton({
  codigo,
  isActive,
  onSelect,
}: {
  codigo: Disciplina
  isActive: boolean
  onSelect: (d: Disciplina) => void
}) {
  const label = useDisciplinaLabel(codigo)
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={disciplinaTabClass(codigo, isActive)}
      style={disciplinaTabStyle(codigo, isActive)}
      onClick={() => onSelect(codigo)}
    >
      {label}
    </button>
  )
}

interface PhaseSidebarProps {
  disciplinas: Disciplina[]
  disciplinaAtiva: Disciplina
  faseAtiva: Fase
  fasesAtuais: FasesAtuais
  tarefas: Tarefa[]
  projetoFaseOverrides?: ProjetoFaseOverride[]
  estruturaFases?: EstruturaFasesSnapshot | null
  onDisciplinaChange: (d: Disciplina) => void
  onFaseChange: (f: Fase) => void
}

export function PhaseSidebar({
  disciplinas,
  disciplinaAtiva,
  faseAtiva,
  fasesAtuais,
  tarefas,
  projetoFaseOverrides = [],
  estruturaFases = null,
  onDisciplinaChange,
  onFaseChange,
}: PhaseSidebarProps) {
  const disciplinaAtivaLabel = useDisciplinaLabel(disciplinaAtiva)
  const overrideMap = buildProjetoFaseOverrideMap(projetoFaseOverrides)
  const activePhases = estruturaFases
    ? getFrozenPhasesForDisciplina(disciplinaAtiva, estruturaFases)
    : getActivePhasesForProjeto(disciplinaAtiva, overrideMap)
  const activeSequence = activePhases.map((f) => f.codigo)
  const faseOficial = getFaseAtual(
    fasesAtuais as Record<string, unknown>,
    disciplinaAtiva,
    activeSequence,
  )

  return (
    <nav className="phase-sidebar" aria-label="Navegação de fases">
      {disciplinas.length > 1 ? (
        <div className="phase-sidebar__disc-tabs" role="tablist">
          {disciplinas.map((d) => {
            const isActive = d === disciplinaAtiva
            return (
              <DisciplinaTabButton key={d} codigo={d} isActive={isActive} onSelect={onDisciplinaChange} />
            )
          })}
        </div>
      ) : null}

      <p className="phase-sidebar__title">
        {disciplinaAtivaLabel} — Fases
      </p>

      <ul className="phase-sidebar__list">
        {activePhases.map((faseConfig) => {
          const fase = faseConfig.codigo
          const isActive = fase === faseAtiva
          const isOfficial = fase === faseOficial
          const progress = calcPhaseProgress(tarefas, disciplinaAtiva, fase)

          return (
            <li key={faseConfig.id}>
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
                <span className="phase-sidebar__item-label">
                  {faseConfig.label}
                </span>
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
