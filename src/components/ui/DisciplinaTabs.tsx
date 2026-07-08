import { useDisciplinasConfig } from '../../contexts/DisciplinasConfigContext'
import { disciplinaTabStyle } from '../../lib/disciplinaTokens'
import type { Disciplina } from '../../types'
import './DisciplinaTabs.css'

export function disciplinaTabClass(disciplina: Disciplina, selected: boolean): string {
  const slug = disciplina.toLowerCase()
  const isCustom = !['hid', 'ppci', 'spk'].includes(slug)
  return [
    'disciplina-tab',
    selected
      ? [
          'disciplina-tab--selected',
          isCustom ? 'disciplina-tab--custom' : `disciplina-tab--${slug}`,
        ].join(' ')
      : '',
  ]
    .filter(Boolean)
    .join(' ')
}

interface DisciplinaTabsProps {
  value: Disciplina
  onChange: (disciplina: Disciplina) => void
  className?: string
  layout?: 'horizontal' | 'vertical'
  /** Subconjunto de códigos; padrão = todas as disciplinas ativas */
  codigos?: Disciplina[]
  includeInactive?: boolean
}

export function DisciplinaTabs({
  value,
  onChange,
  className = '',
  layout = 'horizontal',
  codigos,
  includeInactive = false,
}: DisciplinaTabsProps) {
  const { disciplinas, getLabel, loading } = useDisciplinasConfig()

  const items = (codigos
    ? disciplinas.filter((d) => codigos.includes(d.codigo))
    : includeInactive
      ? disciplinas
      : disciplinas.filter((d) => d.ativo)
  ).sort((a, b) => a.ordem - b.ordem)

  if (loading && items.length === 0) {
    return <p className="disciplina-tabs__loading">Carregando disciplinas…</p>
  }

  return (
    <div
      className={`disciplina-tabs disciplina-tabs--${layout}${className ? ` ${className}` : ''}`}
      role="tablist"
    >
      {items.map((d) => {
        const selected = value === d.codigo
        return (
          <button
            key={d.codigo}
            type="button"
            role="tab"
            aria-selected={selected}
            className={disciplinaTabClass(d.codigo, selected)}
            style={disciplinaTabStyle(d.codigo, selected)}
            onClick={() => onChange(d.codigo)}
          >
            {getLabel(d.codigo)}
          </button>
        )
      })}
    </div>
  )
}
