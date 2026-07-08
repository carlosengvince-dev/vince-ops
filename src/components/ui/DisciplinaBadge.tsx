import type { ReactNode } from 'react'
import { useDisciplinaLabel } from '../../contexts/DisciplinasConfigContext'
import { discToneClasses, discToneStyle } from '../../lib/disciplinaTokens'
import type { Disciplina } from '../../types'

interface DisciplinaBadgeProps {
  codigo: Disciplina | string
  className?: string
  on?: boolean
  children?: ReactNode
}

export function DisciplinaBadge({
  codigo,
  className = '',
  on = true,
  children,
}: DisciplinaBadgeProps) {
  const label = useDisciplinaLabel(codigo)
  return (
    <span
      className={[discToneClasses(codigo, on), className].filter(Boolean).join(' ')}
      style={discToneStyle(codigo)}
    >
      {children ?? label}
    </span>
  )
}
