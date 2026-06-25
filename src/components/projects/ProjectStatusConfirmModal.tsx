import { useEffect, useState } from 'react'
import type { ProjectStatusConfirmKind } from '../../lib/projectStatus'
import { Textarea } from '../ui/Textarea'
import './ProjectStatusConfirmModal.css'

const COPY: Record<
  ProjectStatusConfirmKind,
  { title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning' | 'default' }
> = {
  suspender: {
    title: 'Suspender projeto',
    message:
      'O projeto será suspenso e movido para seção de suspensos no dashboard.',
    confirmLabel: 'Suspender',
    variant: 'warning',
  },
  cancelar: {
    title: 'Cancelar projeto',
    message: 'O projeto será cancelado e movido para o histórico.',
    confirmLabel: 'Cancelar projeto',
    variant: 'danger',
  },
  concluir: {
    title: 'Concluir projeto',
    message: 'Isso irá gerar o snapshot de fechamento do projeto.',
    confirmLabel: 'Concluir',
    variant: 'warning',
  },
  reativar: {
    title: 'Reativar projeto',
    message: 'O projeto será reativado.',
    confirmLabel: 'Reativar',
    variant: 'default',
  },
}

interface ProjectStatusConfirmModalProps {
  isOpen: boolean
  kind: ProjectStatusConfirmKind | null
  loading?: boolean
  onConfirm: (justificativa?: string) => void
  onCancel: () => void
}

export function ProjectStatusConfirmModal({
  isOpen,
  kind,
  loading = false,
  onConfirm,
  onCancel,
}: ProjectStatusConfirmModalProps) {
  const [justificativa, setJustificativa] = useState('')

  useEffect(() => {
    if (!isOpen) setJustificativa('')
  }, [isOpen, kind])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loading) onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, loading, onCancel])

  if (!isOpen || !kind) return null

  const copy = COPY[kind]
  const requiresJustificativa = kind === 'cancelar'
  const canConfirm = !requiresJustificativa || justificativa.trim().length > 0

  return (
    <div
      className="project-status-confirm"
      role="presentation"
      onClick={() => {
        if (!loading) onCancel()
      }}
    >
      <div
        className="project-status-confirm__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="project-status-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="project-status-confirm-title" className="project-status-confirm__title">
          {copy.title}
        </h2>
        <p className="project-status-confirm__message">{copy.message}</p>

        {requiresJustificativa ? (
          <Textarea
            label="Justificativa *"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={3}
            placeholder="Motivo do cancelamento"
          />
        ) : null}

        <div className="project-status-confirm__actions">
          <button
            type="button"
            className="project-status-confirm__btn project-status-confirm__btn--cancel"
            disabled={loading}
            onClick={onCancel}
          >
            Voltar
          </button>
          <button
            type="button"
            className={`project-status-confirm__btn project-status-confirm__btn--confirm project-status-confirm__btn--${copy.variant}`}
            disabled={loading || !canConfirm}
            onClick={() => onConfirm(requiresJustificativa ? justificativa.trim() : undefined)}
          >
            {loading ? 'Aguarde…' : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
