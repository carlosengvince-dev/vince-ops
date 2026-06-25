import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, CheckCircle2, ClipboardList, GitBranch, MessageSquare, Unlock } from 'lucide-react'
import { useProjectActivity } from '../../hooks/useProjectActivity'
import type { ActivityLogTipo } from '../../types'
import { formatActivityTime, getInitials } from '../../lib/utils'
import './ActivityFeedPanel.css'

interface ActivityFeedPanelProps {
  projetoId: string
  nome: string
  clienteNome: string | null
  enabled: boolean
  refreshToken?: number
}

const ICON_BY_TYPE: Partial<Record<ActivityLogTipo, LucideIcon>> = {
  comentario_adicionado: MessageSquare,
  tarefa_status_alterado: CheckCircle2,
  fase_avancada: ArrowRight,
  fase_liberada: Unlock,
  pendencia_criada: ClipboardList,
  revisao_criada: GitBranch,
}

function avatarClass(papel: string): string {
  if (papel === 'gestor') return 'activity-feed__avatar activity-feed__avatar--gestor'
  if (papel === 'projetista') return 'activity-feed__avatar activity-feed__avatar--projetista'
  return 'activity-feed__avatar'
}

export function ActivityFeedPanel({
  projetoId,
  nome,
  clienteNome,
  enabled,
  refreshToken = 0,
}: ActivityFeedPanelProps) {
  const { items, loading, error, refresh } = useProjectActivity(projetoId, enabled)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!enabled) return
    void refresh()
  }, [enabled, refresh, refreshToken])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="activity-feed">
      <header className="activity-feed__header">
        <div>
          <h1 className="activity-feed__title">{nome}</h1>
          <p className="activity-feed__subtitle">{clienteNome ?? 'Sem cliente'} · Atividade</p>
        </div>
      </header>

      <div className="activity-feed__body">
        {error ? (
          <p className="activity-feed__error" role="alert">
            {error}
          </p>
        ) : null}

        {loading && items.length === 0 ? (
          <p className="activity-feed__status">Carregando atividade…</p>
        ) : items.length === 0 ? (
          <p className="activity-feed__status">Nenhuma atividade registrada ainda.</p>
        ) : (
          <ul className="activity-feed__list">
            {items.map((item) => {
              const Icon = ICON_BY_TYPE[item.tipo] ?? MessageSquare
              return (
                <li key={item.id} className="activity-feed__item">
                  <span className={avatarClass(item.usuario_papel)} aria-hidden>
                    {getInitials(item.usuario_nome)}
                  </span>
                  <div className="activity-feed__content">
                    <div className="activity-feed__row">
                      <span className="activity-feed__icon" aria-hidden>
                        <Icon size={14} />
                      </span>
                      <span className="activity-feed__user">{item.usuario_nome}</span>
                      <time
                        className="activity-feed__time"
                        dateTime={item.created_at}
                        title={new Date(item.created_at).toLocaleString('pt-BR')}
                      >
                        {formatActivityTime(item.created_at, now)}
                      </time>
                    </div>
                    <p className="activity-feed__desc">{item.descricao}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
