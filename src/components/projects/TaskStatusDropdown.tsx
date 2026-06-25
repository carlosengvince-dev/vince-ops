import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { TAREFA_STATUS_LABELS } from '../../lib/constants'
import { PortalDropdown } from '../ui/PortalDropdown'
import type { TarefaStatus } from '../../types'
import './TaskStatusDropdown.css'

const STATUS_OPTIONS: TarefaStatus[] = [
  'pendente',
  'em_elaboracao',
  'em_revisao',
  'bloqueado',
  'concluido',
  'nao_aplica',
]

function statusModifier(status: TarefaStatus): string {
  return status.replace('_', '')
}

interface TaskStatusDropdownProps {
  value: TarefaStatus
  disabled?: boolean
  onChange: (status: TarefaStatus) => void
  label: string
}

export function TaskStatusDropdown({
  value,
  disabled = false,
  onChange,
  label,
}: TaskStatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function handleSelect(status: TarefaStatus) {
    setOpen(false)
    if (status !== value) {
      onChange(status)
    }
  }

  return (
    <div className="task-status-dropdown">
      <button
        ref={triggerRef}
        type="button"
        className={`task-status-dropdown__trigger task-status-dropdown__trigger--${statusModifier(value)}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => !disabled && setOpen((prev) => !prev)}
      >
        <span>{TAREFA_STATUS_LABELS[value]}</span>
        <ChevronDown size={14} className={open ? 'task-status-dropdown__chevron--open' : ''} />
      </button>

      <PortalDropdown
        open={open}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        className="task-status-dropdown__menu"
        align="end"
        size="status"
      >
        <ul role="listbox" aria-label={label}>
          {STATUS_OPTIONS.map((status) => (
            <li key={status} role="option" aria-selected={status === value}>
              <button
                type="button"
                className={`task-status-dropdown__option task-status-dropdown__option--${statusModifier(status)}${
                  status === value ? ' task-status-dropdown__option--selected' : ''
                }`}
                onClick={() => handleSelect(status)}
              >
                {TAREFA_STATUS_LABELS[status]}
              </button>
            </li>
          ))}
        </ul>
      </PortalDropdown>
    </div>
  )
}
