import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ClipboardList, Send, Trash2 } from 'lucide-react'
import { discToneClasses } from '../../lib/disciplinaTokens'
import {
  chatDraftKey,
  type ProjectChatFeedItem,
} from '../../lib/projectChat'
import {
  clearModalState,
  debouncedSaveModalState,
  flushModalState,
  loadModalState,
} from '../../lib/modalStorage'
import { formatRelativeTime, getInitials } from '../../lib/utils'
import { useAuth } from '../../hooks/useAuth'
import { useProjectChat } from '../../hooks/useProjectChat'
import type { Disciplina, Fase, Papel } from '../../types'
import { ConfirmModal } from '../ui/ConfirmModal'
import './ProjectChat.css'

interface ChatDraft {
  text: string
}

interface ProjectChatProps {
  projetoId: string
  usuarioId: string
  usuarioPapel: Papel
  enabled: boolean
  readOnly?: boolean
  onNavigateToTask: (disciplina: Disciplina, fase: Fase, tarefaId: string) => void
}

function avatarClass(papel: string): string {
  if (papel === 'gestor') return 'project-chat__avatar project-chat__avatar--gestor'
  if (papel === 'projetista') return 'project-chat__avatar project-chat__avatar--projetista'
  return 'project-chat__avatar'
}

export function ProjectChat({
  projetoId,
  usuarioId,
  usuarioPapel: _usuarioPapel,
  enabled,
  readOnly = false,
  onNavigateToTask,
}: ProjectChatProps) {
  const { profile } = useAuth()
  const {
    items,
    loading,
    loadingOlder,
    hasMore,
    sending,
    error,
    loadOlder,
    send,
    deleteMensagem,
  } = useProjectChat(projetoId, enabled)

  const draftKey = chatDraftKey(projetoId)
  const [draft, setDraft] = useState(() => loadModalState<ChatDraft>(draftKey)?.text ?? '')
  const [now, setNow] = useState(Date.now())
  const [deleteTarget, setDeleteTarget] = useState<ProjectChatFeedItem | null>(null)

  const feedRef = useRef<HTMLDivElement>(null)
  const initialScrollDone = useRef(false)
  const prevScrollHeightRef = useRef(0)
  const loadingOlderRef = useRef(false)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    return () => {
      flushModalState(draftKey, { text: draft })
    }
  }, [draft, draftKey])

  useEffect(() => {
    if (!loading && items.length > 0 && !initialScrollDone.current && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
      initialScrollDone.current = true
    }
  }, [loading, items.length])

  useEffect(() => {
    if (!loadingOlderRef.current || !feedRef.current) return
    const el = feedRef.current
    const diff = el.scrollHeight - prevScrollHeightRef.current
    if (diff > 0) el.scrollTop += diff
    loadingOlderRef.current = false
  }, [items, loadingOlder])

  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value)
      debouncedSaveModalState(draftKey, { text: value })
    },
    [draftKey],
  )

  const scrollToBottom = useCallback(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return
    try {
      await send(text, usuarioId)
      setDraft('')
      clearModalState(draftKey)
      requestAnimationFrame(scrollToBottom)
    } catch {
      // hook sets error
    }
  }, [draft, draftKey, scrollToBottom, send, sending, usuarioId])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        void handleSend()
      }
    },
    [handleSend],
  )

  const handleFeedScroll = useCallback(() => {
    const el = feedRef.current
    if (!el || loadingOlder || !hasMore) return
    if (el.scrollTop > 48) return

    prevScrollHeightRef.current = el.scrollHeight
    loadingOlderRef.current = true
    void loadOlder()
  }, [hasMore, loadOlder, loadingOlder])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget || deleteTarget.tipo !== 'mensagem') return
    const mensagem = deleteTarget
    setDeleteTarget(null)

    await deleteMensagem(mensagem.id)
  }, [deleteMensagem, deleteTarget])

  const canDeleteItem = useCallback(
    (item: ProjectChatFeedItem) =>
      !readOnly &&
      item.tipo === 'mensagem' &&
      Boolean(profile) &&
      (item.autor_id === profile!.id || profile!.papel === 'gestor'),
    [profile, readOnly],
  )

  return (
    <div className="project-chat">
      <header className="project-chat__header">
        <h3 className="project-chat__title">Chat da equipe</h3>
      </header>

      <div
        ref={feedRef}
        className="project-chat__feed"
        onScroll={handleFeedScroll}
        aria-live="polite"
        aria-busy={loading || loadingOlder}
      >
        {loadingOlder ? (
          <p className="project-chat__loading-older">Carregando mensagens anteriores…</p>
        ) : null}

        {error ? (
          <p className="project-chat__error" role="alert">
            {error}
          </p>
        ) : null}

        {loading && items.length === 0 ? (
          <p className="project-chat__empty">Carregando conversa…</p>
        ) : items.length === 0 ? (
          <p className="project-chat__empty">Nenhuma mensagem ainda. Inicie a conversa.</p>
        ) : (
          <ul className="project-chat__list">
            {items.map((item) => {
              const isOwn = item.tipo === 'mensagem' && item.autor_id === usuarioId
              const showDelete = canDeleteItem(item)

              if (item.tipo === 'comentario') {
                return (
                  <li key={`comentario-${item.id}`} className="project-chat__item project-chat__item--comentario">
                    <span className={avatarClass(item.autor_papel)} aria-hidden>
                      {getInitials(item.autor_nome)}
                    </span>
                    <div className="project-chat__bubble project-chat__bubble--comentario">
                      <div className="project-chat__meta">
                        <span className="project-chat__author">{item.autor_nome}</span>
                        <span className="project-chat__time">
                          {formatRelativeTime(item.created_at, now)}
                        </span>
                      </div>
                      {item.tarefa_disciplina && item.tarefa_fase && item.tarefa_id ? (
                        <button
                          type="button"
                          className={`project-chat__task-badge ${discToneClasses(item.tarefa_disciplina)}`}
                          onClick={() =>
                            onNavigateToTask(
                              item.tarefa_disciplina as Disciplina,
                              item.tarefa_fase as Fase,
                              item.tarefa_id!,
                            )
                          }
                        >
                          <ClipboardList size={12} aria-hidden />
                          [{item.tarefa_disciplina} — {item.tarefa_fase}] {item.tarefa_nome}
                        </button>
                      ) : null}
                      <p className="project-chat__text project-chat__text--comentario">{item.texto}</p>
                    </div>
                  </li>
                )
              }

              return (
                <li
                  key={`mensagem-${item.id}`}
                  className={`project-chat__item project-chat__item--mensagem${isOwn ? ' project-chat__item--own' : ''}${showDelete ? ' project-chat__item--can-delete' : ''}`}
                >
                  {!isOwn ? (
                    <span className={avatarClass(item.autor_papel)} aria-hidden>
                      {getInitials(item.autor_nome)}
                    </span>
                  ) : null}
                  <div
                    className={`project-chat__bubble project-chat__bubble--mensagem${isOwn ? ' project-chat__bubble--own' : ''}`}
                  >
                    <div className="project-chat__meta">
                      <span className="project-chat__author">{item.autor_nome}</span>
                      <span className="project-chat__time">
                        {formatRelativeTime(item.created_at, now)}
                      </span>
                      {showDelete ? (
                        <button
                          type="button"
                          className="project-chat__delete"
                          aria-label="Excluir mensagem"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                    <p className="project-chat__text">{item.texto}</p>
                  </div>
                  {isOwn ? (
                    <span className={avatarClass(item.autor_papel)} aria-hidden>
                      {getInitials(item.autor_nome)}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <footer className="project-chat__composer">
        <textarea
          className="project-chat__input"
          rows={2}
          placeholder={readOnly ? 'Chat desabilitado em modo leitura.' : 'Mensagem para a equipe...'}
          value={draft}
          disabled={readOnly || sending}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="project-chat__send"
          disabled={readOnly || sending || !draft.trim()}
          onClick={() => void handleSend()}
          aria-label="Enviar mensagem"
        >
          <Send size={18} />
        </button>
      </footer>

      {!readOnly ? (
        <ConfirmModal
          isOpen={deleteTarget != null}
          title="Excluir mensagem"
          message="Esta mensagem será removida do chat da equipe."
          confirmLabel="Excluir"
          variant="danger"
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  )
}
