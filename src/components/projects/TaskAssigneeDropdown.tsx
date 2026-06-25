import { useRef, useState } from 'react'
import { User } from 'lucide-react'
import { PAPEL_LABELS } from '../../lib/constants'
import type { ActiveProfile } from '../../lib/profiles'
import type { Papel } from '../../types'
import { getInitials } from '../../lib/utils'
import { PortalDropdown } from '../ui/PortalDropdown'
import './TaskAssigneeDropdown.css'

function avatarClass(papel: Papel | null | undefined, unassigned: boolean): string {
  if (unassigned) return 'task-assignee__avatar task-assignee__avatar--empty'
  if (papel === 'gestor') return 'task-assignee__avatar task-assignee__avatar--gestor'
  if (papel === 'projetista') return 'task-assignee__avatar task-assignee__avatar--projetista'
  return 'task-assignee__avatar'
}

interface TaskAssigneeDropdownProps {
  responsavelId: string | null
  responsavelNome: string | null
  responsavelPapel: Papel | null
  canAssign: boolean
  users: ActiveProfile[]
  usersLoading?: boolean
  disabled?: boolean
  label: string
  onAssign: (responsavelId: string | null) => void
}

export function TaskAssigneeDropdown({
  responsavelId,
  responsavelNome,
  responsavelPapel,
  canAssign,
  users,
  usersLoading = false,
  disabled = false,
  label,
  onAssign,
}: TaskAssigneeDropdownProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function handleSelect(userId: string | null) {
    setOpen(false)
    if (userId === responsavelId) return
    onAssign(userId)
  }

  const triggerDisabled = disabled || !canAssign

  return (
    <div className="task-assignee">
      <button
        ref={triggerRef}
        type="button"
        className={`task-assignee__trigger${triggerDisabled ? ' task-assignee__trigger--readonly' : ''}`}
        disabled={triggerDisabled}
        aria-haspopup={canAssign ? 'listbox' : undefined}
        aria-expanded={open}
        aria-label={label}
        title={
          !responsavelId
            ? 'Sem responsável'
            : `${responsavelNome ?? 'Responsável'}${canAssign ? ' — clique para alterar' : ''}`
        }
        onClick={() => canAssign && !disabled && setOpen((prev) => !prev)}
      >
        <span className={avatarClass(responsavelPapel, !responsavelId)} aria-hidden>
          {!responsavelId ? <User size={14} /> : getInitials(responsavelNome ?? '?')}
        </span>
      </button>

      <PortalDropdown
        open={open && canAssign}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        className="task-assignee__menu"
        align="end"
      >
        <ul role="listbox" aria-label={label}>
          {usersLoading ? (
            <li className="task-assignee__status">Carregando…</li>
          ) : (
            users.map((user) => (
              <li key={user.id} role="option" aria-selected={user.id === responsavelId}>
                <button
                  type="button"
                  className={`task-assignee__option${user.id === responsavelId ? ' task-assignee__option--selected' : ''}`}
                  onClick={() => handleSelect(user.id)}
                >
                  <span className={avatarClass(user.papel, false)} aria-hidden>
                    {getInitials(user.nome)}
                  </span>
                  <span className="task-assignee__option-text">
                    <span className="task-assignee__option-name">{user.nome}</span>
                    <span className="task-assignee__option-role">{PAPEL_LABELS[user.papel]}</span>
                  </span>
                </button>
              </li>
            ))
          )}
          {responsavelId ? (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                className="task-assignee__option task-assignee__option--remove"
                onClick={() => handleSelect(null)}
              >
                Remover responsável
              </button>
            </li>
          ) : null}
        </ul>
      </PortalDropdown>
    </div>
  )
}
