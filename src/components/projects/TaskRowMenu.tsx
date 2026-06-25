import { useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { PortalDropdown } from '../ui/PortalDropdown'
import './TaskRowMenu.css'

interface TaskRowMenuProps {
  onEdit: () => void
  onMove: () => void
  onDelete: () => void
}

export function TaskRowMenu({ onEdit, onMove, onDelete }: TaskRowMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function run(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div
      className={`task-row-menu${open ? ' task-row-menu--open' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="task-row-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Ações da tarefa"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={16} />
      </button>

      <PortalDropdown
        open={open}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        className="task-row-menu__dropdown"
        align="end"
        size="menu"
      >
        <div role="menu">
          <button type="button" role="menuitem" onClick={() => run(onEdit)}>
            Editar tarefa
          </button>
          <button type="button" role="menuitem" onClick={() => run(onMove)}>
            Mover para outra fase
          </button>
          <button
            type="button"
            role="menuitem"
            className="task-row-menu__item--danger"
            onClick={() => run(onDelete)}
          >
            Excluir tarefa
          </button>
        </div>
      </PortalDropdown>
    </div>
  )
}
