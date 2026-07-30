import { useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { PortalDropdown } from '../ui/PortalDropdown'
import './TaskRowMenu.css'

interface TaskRowMenuProps {
  onEdit: () => void
  onMove: () => void
  onDelete: () => void
  /** Manual → biblioteca */
  onPromoteToLibrary?: () => void
  /** Empurrar conteúdo local para o template vinculado */
  onPushToLibrary?: () => void
  /** Desvincular template_id (mantém só no projeto) */
  onUnlinkLibrary?: () => void
}

export function TaskRowMenu({
  onEdit,
  onMove,
  onDelete,
  onPromoteToLibrary,
  onPushToLibrary,
  onUnlinkLibrary,
}: TaskRowMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function run(action: () => void) {
    setOpen(false)
    action()
  }

  const hasLibraryActions = Boolean(onPromoteToLibrary || onPushToLibrary || onUnlinkLibrary)

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
          {hasLibraryActions ? (
            <>
              <div className="task-row-menu__sep" role="separator" />
              {onPromoteToLibrary ? (
                <button type="button" role="menuitem" onClick={() => run(onPromoteToLibrary)}>
                  Adicionar à biblioteca
                </button>
              ) : null}
              {onPushToLibrary ? (
                <button type="button" role="menuitem" onClick={() => run(onPushToLibrary)}>
                  Atualizar na biblioteca
                </button>
              ) : null}
              {onUnlinkLibrary ? (
                <button type="button" role="menuitem" onClick={() => run(onUnlinkLibrary)}>
                  Manter só neste projeto
                </button>
              ) : null}
            </>
          ) : null}
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
