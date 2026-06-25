import { useState } from 'react'
import { ClockPlus } from 'lucide-react'
import { hasPermissao } from '../../lib/constants'
import type { Papel, Tarefa } from '../../types'
import { ManualHorasModal } from '../projects/ManualHorasModal'
import './ManualHorasButton.css'

interface ManualHorasButtonProps {
  tarefa: Pick<Tarefa, 'id' | 'projeto_id' | 'disciplina' | 'nome'>
  papel: Papel
  readOnly?: boolean
}

export function ManualHorasButton({ tarefa, papel, readOnly = false }: ManualHorasButtonProps) {
  const [open, setOpen] = useState(false)
  const canUse = hasPermissao(papel, 'iniciar_timer') && !readOnly

  if (!canUse) return null

  return (
    <>
      <button
        type="button"
        className="manual-horas-button"
        aria-label="Registrar horas manualmente"
        title="Registrar horas"
        onClick={() => setOpen(true)}
      >
        <ClockPlus size={16} />
      </button>

      <ManualHorasModal open={open} tarefa={tarefa} onClose={() => setOpen(false)} />
    </>
  )
}
