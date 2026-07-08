import { useEffect } from 'react'
import { getDisciplinaLabel } from '../../lib/disciplinaConfig'
import type { Disciplina } from '../../types'
import './RemoveDisciplinaModal.css'

interface RemoveDisciplinaModalProps {
  open: boolean
  disciplina: Disciplina
  tarefaCount: number
  openRevisoesCount: number
  loading?: boolean
  onArchive: () => void
  onCancel: () => void
}

export function RemoveDisciplinaModal({
  open,
  disciplina,
  tarefaCount,
  openRevisoesCount,
  loading = false,
  onArchive,
  onCancel,
}: RemoveDisciplinaModalProps) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loading) onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, loading, onCancel])

  if (!open) return null

  const label = getDisciplinaLabel(disciplina)

  return (
    <div
      className="remove-disc-modal"
      role="presentation"
      onClick={() => {
        if (!loading) onCancel()
      }}
    >
      <div
        className="remove-disc-modal__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-disc-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="remove-disc-modal-title" className="remove-disc-modal__title">
          Remover {label} do projeto
        </h2>

        <div className="remove-disc-modal__body">
          {tarefaCount === 0 ? (
            <p>Esta disciplina será removida do projeto.</p>
          ) : (
            <>
              <p>
                Esta disciplina tem <strong>{tarefaCount}</strong>{' '}
                {tarefaCount === 1 ? 'tarefa' : 'tarefas'}. O que deseja fazer com elas?
              </p>
              <p className="remove-disc-modal__hint">
                As tarefas serão arquivadas (soft delete) ao remover a disciplina.
              </p>
            </>
          )}

          {openRevisoesCount > 0 ? (
            <p className="remove-disc-modal__warning" role="status">
              Esta disciplina tem {openRevisoesCount}{' '}
              {openRevisoesCount === 1 ? 'revisão em aberto' : 'revisões em aberto'}.
            </p>
          ) : null}
        </div>

        <div className="remove-disc-modal__actions">
          <button
            type="button"
            className="remove-disc-modal__btn remove-disc-modal__btn--cancel"
            disabled={loading}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="remove-disc-modal__btn remove-disc-modal__btn--danger"
            disabled={loading}
            onClick={onArchive}
          >
            {loading
              ? 'Removendo…'
              : tarefaCount > 0
                ? 'Arquivar tarefas'
                : 'Remover disciplina'}
          </button>
        </div>
      </div>
    </div>
  )
}
