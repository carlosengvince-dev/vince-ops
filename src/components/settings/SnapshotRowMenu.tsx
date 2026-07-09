import { useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { PortalDropdown } from '../ui/PortalDropdown'
import './SnapshotRowMenu.css'

interface SnapshotRowMenuProps {
  onRename: () => void
  onDelete: () => void
}

export function SnapshotRowMenu({ onRename, onDelete }: SnapshotRowMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function run(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div
      className={`snapshot-row-menu${open ? ' snapshot-row-menu--open' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="snapshot-row-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Ações do snapshot"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={16} />
      </button>

      <PortalDropdown
        open={open}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        className="snapshot-row-menu__dropdown"
        align="end"
        size="menu"
      >
        <div role="menu">
          <button type="button" role="menuitem" onClick={() => run(onRename)}>
            Renomear
          </button>
          <button
            type="button"
            role="menuitem"
            className="snapshot-row-menu__item--danger"
            onClick={() => run(onDelete)}
          >
            Excluir
          </button>
        </div>
      </PortalDropdown>
    </div>
  )
}
