import { DISCIPLINA_LABELS } from '../../lib/constants'
import type { Disciplina } from '../../types'
import './DisciplinaTabs.css'

const DISCIPLINAS: Disciplina[] = ['HID', 'PPCI', 'SPK']

export function disciplinaTabClass(disciplina: Disciplina, selected: boolean): string {
  const slug = disciplina.toLowerCase()
  return [
    'disciplina-tab',
    selected ? `disciplina-tab--selected disciplina-tab--${slug}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

interface DisciplinaTabsProps {
  value: Disciplina
  onChange: (disciplina: Disciplina) => void
  className?: string
  layout?: 'horizontal' | 'vertical'
}

export function DisciplinaTabs({
  value,
  onChange,
  className = '',
  layout = 'horizontal',
}: DisciplinaTabsProps) {
  return (
    <div
      className={`disciplina-tabs disciplina-tabs--${layout}${className ? ` ${className}` : ''}`}
      role="tablist"
    >
      {DISCIPLINAS.map((d) => (
        <button
          key={d}
          type="button"
          role="tab"
          aria-selected={value === d}
          className={disciplinaTabClass(d, value === d)}
          onClick={() => onChange(d)}
        >
          {DISCIPLINA_LABELS[d]}
        </button>
      ))}
    </div>
  )
}
