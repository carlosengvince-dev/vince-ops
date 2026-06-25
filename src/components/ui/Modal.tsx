import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import './Modal.css'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, title, onClose, children, footer, width = 'md' }: ModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="ui-modal" role="presentation" onClick={onClose}>
      <div
        className={`ui-modal__panel ui-modal__panel--${width}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ui-modal__header">
          <h2 id="ui-modal-title" className="ui-modal__title">
            {title}
          </h2>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer ? <div className="ui-modal__footer">{footer}</div> : null}
      </div>
    </div>
  )
}
