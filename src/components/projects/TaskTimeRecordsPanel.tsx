import { useState } from 'react'
import { ChevronDown, ChevronRight, Clock, ClockPlus, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTaskRegistrosTempo } from '../../hooks/useTaskRegistrosTempo'
import { hasPermissao } from '../../lib/constants'
import { bumpHorasChartVersion } from '../../lib/horasChartVersion'
import {
  formatRegistroDate,
  formatRegistroDuration,
  formatRegistroTime,
  softDeleteRegistroTempo,
} from '../../lib/registrosTempo'
import { notifyRegistrosTempoChanged } from '../../lib/timerEvents'
import type { Papel, RegistroTempoOrigem } from '../../types'
import { ConfirmModal } from '../ui/ConfirmModal'
import './TaskTimeRecordsPanel.css'

interface TaskTimeRecordsPanelProps {
  tarefaId: string
  papel: Papel
  readOnly?: boolean
}

function OrigemIcon({ origem }: { origem: RegistroTempoOrigem }) {
  if (origem === 'manual') {
    return <ClockPlus size={14} className="task-time-records__origem-icon" aria-hidden />
  }
  return <Clock size={14} className="task-time-records__origem-icon" aria-hidden />
}

export function TaskTimeRecordsPanel({
  tarefaId,
  papel,
  readOnly = false,
}: TaskTimeRecordsPanelProps) {
  const { profile } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { registros, loading, error } = useTaskRegistrosTempo(tarefaId, expanded)

  function canDeleteRegistro(usuarioId: string): boolean {
    if (readOnly || !profile) return false
    return (
      profile.id === usuarioId ||
      hasPermissao(profile.papel, 'editar_projeto') ||
      hasPermissao(papel, 'editar_projeto')
    )
  }

  async function handleConfirmDelete() {
    if (!deleteTargetId) return
    setDeleting(true)
    try {
      await softDeleteRegistroTempo(deleteTargetId)
      notifyRegistrosTempoChanged()
      bumpHorasChartVersion()
      setDeleteTargetId(null)
    } catch {
      // keep modal open; user can retry
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="task-time-records">
      <button
        type="button"
        className="task-time-records__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="task-time-records__toggle-icon" aria-hidden>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span>Registros de tempo</span>
      </button>

      {expanded ? (
        <div className="task-time-records__body">
          {loading ? (
            <p className="task-time-records__status">Carregando…</p>
          ) : error ? (
            <p className="task-time-records__status task-time-records__status--error" role="alert">
              {error}
            </p>
          ) : registros.length === 0 ? (
            <p className="task-time-records__status">Nenhum registro de tempo.</p>
          ) : (
            <ul className="task-time-records__list">
              {registros.map((reg) => (
                <li key={reg.id} className="task-time-records__item">
                  <OrigemIcon origem={reg.origem} />
                  <div className="task-time-records__content">
                    <span className="task-time-records__line">
                      {formatRegistroDate(reg.inicio)} · {formatRegistroTime(reg.inicio)} →{' '}
                      {reg.fim ? formatRegistroTime(reg.fim) : '—'} ·{' '}
                      {formatRegistroDuration(reg.duracao_segundos)} · {reg.usuario_nome}
                    </span>
                    {reg.descricao ? (
                      <span className="task-time-records__desc">{reg.descricao}</span>
                    ) : null}
                  </div>
                  {canDeleteRegistro(reg.usuario_id) ? (
                    <button
                      type="button"
                      className="task-time-records__delete"
                      aria-label="Excluir registro de tempo"
                      onClick={() => setDeleteTargetId(reg.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <ConfirmModal
        isOpen={deleteTargetId != null}
        title="Excluir registro de tempo"
        message="Este registro será removido do histórico da tarefa."
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleting) setDeleteTargetId(null)
        }}
      />
    </section>
  )
}
