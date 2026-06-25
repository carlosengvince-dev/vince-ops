import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PROJETO_STATUS_LABELS } from '../../lib/constants'
import { PROJECT_STATUS_OPTIONS } from '../../lib/projectStatus'
import type { ProjetoStatus } from '../../types'
import { PortalDropdown } from '../ui/PortalDropdown'
import './ProjectStatusDropdown.css'

function statusModifier(status: ProjetoStatus): string {
  return status.replace('_', '')
}

interface ProjectStatusDropdownProps {
  value: ProjetoStatus
  canChange: boolean
  disabled?: boolean
  onChange: (status: ProjetoStatus) => void
}

export function ProjectStatusDropdown({
  value,
  canChange,
  disabled = false,
  onChange,
}: ProjectStatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function handleSelect(status: ProjetoStatus) {
    setOpen(false)
    if (status !== value) {
      onChange(status)
    }
  }

  if (!canChange) {
    return (
      <span
        className={`project-status-dropdown__badge project-status-dropdown__badge--${statusModifier(value)}`}
      >
        {PROJETO_STATUS_LABELS[value]}
      </span>
    )
  }

  return (
    <div className="project-status-dropdown">
      <button
        ref={triggerRef}
        type="button"
        className={`project-status-dropdown__trigger project-status-dropdown__trigger--${statusModifier(value)}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Alterar status do projeto"
        onClick={() => !disabled && setOpen((prev) => !prev)}
      >
        <span>{PROJETO_STATUS_LABELS[value]}</span>
        <ChevronDown size={14} className={open ? 'project-status-dropdown__chevron--open' : ''} />
      </button>

      <PortalDropdown
        open={open}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        className="project-status-dropdown__menu"
        align="start"
        size="status"
      >
        <ul role="listbox" aria-label="Status do projeto">
          {PROJECT_STATUS_OPTIONS.map((status) => (
            <li key={status} role="option" aria-selected={status === value}>
              <button
                type="button"
                className={`project-status-dropdown__option project-status-dropdown__option--${statusModifier(status)}${
                  status === value ? ' project-status-dropdown__option--selected' : ''
                }`}
                onClick={() => handleSelect(status)}
              >
                {PROJETO_STATUS_LABELS[status]}
              </button>
            </li>
          ))}
        </ul>
      </PortalDropdown>
    </div>
  )
}
