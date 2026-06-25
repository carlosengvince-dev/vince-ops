import { useState } from 'react'
import { PHASE_LABELS } from '../../lib/constants'
import type { Disciplina, Fase, Tarefa } from '../../types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import './PhaseAdvanceModal.css'

interface PhaseAdvanceModalProps {
  open: boolean
  disciplina: Disciplina
  faseAtual: Fase
  nextFase: Fase
  pendentes: Tarefa[]
  mode: 'confirm' | 'liberacao'
  loading?: boolean
  onClose: () => void
  onConfirm: (justificativa?: string) => void
}

export function PhaseAdvanceModal({
  open,
  disciplina,
  faseAtual,
  nextFase,
  pendentes,
  mode,
  loading = false,
  onClose,
  onConfirm,
}: PhaseAdvanceModalProps) {
  const [justificativa, setJustificativa] = useState('')

  function handleClose() {
    setJustificativa('')
    onClose()
  }

  function handleConfirm() {
    if (mode === 'liberacao' && !justificativa.trim()) return
    onConfirm(mode === 'liberacao' ? justificativa.trim() : undefined)
    setJustificativa('')
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={mode === 'liberacao' ? 'Liberação de fase bloqueada' : 'Avançar fase'}
    >
      <div className="phase-advance-modal">
        {mode === 'liberacao' ? (
          <>
            <p className="phase-advance-modal__text">
              Existem <strong>{pendentes.length}</strong> tarefa(s) crítica(s) pendente(s) para avançar de{' '}
              <strong>{PHASE_LABELS[faseAtual]}</strong> para{' '}
              <strong>{PHASE_LABELS[nextFase]}</strong> ({disciplina}).
            </p>
            <ul className="phase-advance-modal__list">
              {pendentes.map((t) => (
                <li key={t.id}>
                  {t.categoria} — {t.nome}
                </li>
              ))}
            </ul>
            <Textarea
              label="Justificativa *"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
              placeholder="Motivo da liberação antecipada"
            />
          </>
        ) : (
          <p className="phase-advance-modal__text">
            Confirmar avanço de <strong>{PHASE_LABELS[faseAtual]}</strong> para{' '}
            <strong>{PHASE_LABELS[nextFase]}</strong> ({disciplina})?
          </p>
        )}

        <div className="phase-advance-modal__actions">
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={mode === 'liberacao' && !justificativa.trim()}
            onClick={handleConfirm}
          >
            {mode === 'liberacao' ? 'Liberar e avançar' : 'Avançar fase'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
