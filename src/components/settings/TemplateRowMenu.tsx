import { useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { PortalDropdown } from '../ui/PortalDropdown'
import '../projects/TaskRowMenu.css'

interface TemplateRowMenuProps {
  ativo: boolean
  onEdit: () => void
  onToggleAtivo: () => void
  onDelete: () => void
}

export function TemplateRowMenu({ ativo, onEdit, onToggleAtivo, onDelete }: TemplateRowMenuProps) {
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
        <MoreHorizontal size={16} />
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
            Editar
          </button>
          {ativo ? (
            <button type="button" role="menuitem" onClick={() => run(onToggleAtivo)}>
              Desativar
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={() => run(onToggleAtivo)}>
              Reativar
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="task-row-menu__item--danger"
            onClick={() => run(onDelete)}
          >
            Excluir
          </button>
        </div>
      </PortalDropdown>
    </div>
  )
}
