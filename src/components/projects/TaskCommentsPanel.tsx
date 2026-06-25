import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTaskComments } from '../../hooks/useTaskComments'
import { hasPermissao } from '../../lib/constants'
import { formatRelativeTime, getInitials } from '../../lib/utils'
import type { Papel } from '../../types'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import './TaskCommentsPanel.css'

interface TaskCommentsPanelProps {
  tarefaId: string
  projetoId: string
  tarefaNome: string
  papel: Papel
  readOnly?: boolean
}

export function TaskCommentsPanel({
  tarefaId,
  projetoId,
  tarefaNome,
  papel,
  readOnly = false,
}: TaskCommentsPanelProps) {
  const { profile } = useAuth()
  const { comentarios, loading, sending, error, send, remove } = useTaskComments(
    tarefaId,
    projetoId,
    tarefaNome,
    true,
  )
  const [draft, setDraft] = useState('')
  const [now, setNow] = useState(Date.now())
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const canDeleteComment = (autorId: string) =>
    !readOnly &&
    Boolean(
      profile &&
        (profile.id === autorId ||
          hasPermissao(profile.papel, 'editar_projeto') ||
          hasPermissao(papel, 'editar_projeto')),
    )

  async function handleSend() {
    if (!profile || !draft.trim() || sending) return
    try {
      await send(draft, profile.id, profile.nome)
      setDraft('')
    } catch {
      /* error state set in hook */
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTargetId || deleting) return
    const id = deleteTargetId
    setDeleteTargetId(null)
    setDeleting(true)
    try {
      await remove(id)
    } catch {
      /* mensagem exibida via error do hook */
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="task-comments">
      {loading && comentarios.length === 0 ? (
        <p className="task-comments__status">Carregando comentários…</p>
      ) : comentarios.length === 0 ? (
        <p className="task-comments__status">Nenhum comentário ainda.</p>
      ) : (
        <ul className="task-comments__list">
          {comentarios.map((comment) => {
            const canDelete = canDeleteComment(comment.autor_id)

            return (
              <li
                key={comment.id}
                className={`task-comments__item${canDelete ? ' task-comments__item--can-delete' : ''}`}
              >
                <span className="task-comments__avatar" aria-hidden>
                  {getInitials(comment.autor_nome)}
                </span>
                <div className="task-comments__body">
                  <div className="task-comments__meta">
                    <span className="task-comments__author">{comment.autor_nome}</span>
                    <time
                      className="task-comments__time"
                      dateTime={comment.created_at}
                      title={new Date(comment.created_at).toLocaleString('pt-BR')}
                    >
                      {formatRelativeTime(comment.created_at, now)}
                    </time>
                    {canDelete ? (
                      <button
                        type="button"
                        className="task-comments__delete"
                        aria-label="Excluir comentário"
                        disabled={deleting && deleteTargetId === comment.id}
                        onClick={() => setDeleteTargetId(comment.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                  <p className="task-comments__text">{comment.texto}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {error ? (
        <p className="task-comments__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="task-comments__composer">
        <textarea
          className="task-comments__input"
          rows={2}
          placeholder={readOnly ? 'Comentários desabilitados em modo leitura.' : 'Escreva um comentário…'}
          value={draft}
          disabled={readOnly || !profile || sending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="button"
          variant="primary"
          loading={sending}
          disabled={readOnly || !profile || !draft.trim()}
          onClick={() => void handleSend()}
        >
          Enviar
        </Button>
      </div>

      {!readOnly ? (
        <ConfirmModal
          isOpen={deleteTargetId !== null}
          title="Excluir comentário"
          message="Tem certeza que deseja excluir este comentário? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          variant="danger"
          loading={deleting}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => {
            if (!deleting) setDeleteTargetId(null)
          }}
        />
      ) : null}
    </div>
  )
}
