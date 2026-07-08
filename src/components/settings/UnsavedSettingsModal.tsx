import { useEffect } from 'react'
import '../ui/ConfirmModal.css'
import './UnsavedSettingsModal.css'

interface UnsavedSettingsModalProps {
  open: boolean
  message: string
  saving?: boolean
  onSaveAndLeave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedSettingsModal({
  open,
  message,
  saving = false,
  onSaveAndLeave,
  onDiscard,
  onCancel,
}: UnsavedSettingsModalProps) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, saving, onCancel])

  if (!open) return null

  return (
    <div
      className="confirm-modal"
      role="presentation"
      onClick={() => {
        if (!saving) onCancel()
      }}
    >
      <div
        className="confirm-modal__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-settings-title"
        aria-describedby="unsaved-settings-message"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="unsaved-settings-title" className="confirm-modal__title">
          Alterações não salvas
        </h2>
        <p id="unsaved-settings-message" className="confirm-modal__message">
          {message}
        </p>
        <div className="unsaved-settings-modal__actions">
          <button
            type="button"
            className="unsaved-settings-modal__btn"
            disabled={saving}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="unsaved-settings-modal__btn unsaved-settings-modal__btn--danger"
            disabled={saving}
            onClick={onDiscard}
          >
            Descartar
          </button>
          <button
            type="button"
            className="unsaved-settings-modal__btn unsaved-settings-modal__btn--primary"
            disabled={saving}
            onClick={onSaveAndLeave}
          >
            {saving ? 'Salvando…' : 'Salvar e sair'}
          </button>
        </div>
      </div>
    </div>
  )
}
