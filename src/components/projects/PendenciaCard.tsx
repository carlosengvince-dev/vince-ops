import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Disciplina, Fase, PendenciaExterna, Tarefa } from '../../types'
import {
  formatPrazoDate,
  getPrazoUrgency,
  PENDENCIA_STATUS_LABELS,
} from '../../lib/pendencias'
import { shortTarefaNome } from '../../lib/tarefaVinculadaUtils'
import { discToneClasses } from '../../lib/disciplinaTokens'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import './PendenciaCard.css'

interface PendenciaCardProps {
  pendencia: PendenciaExterna
  tarefas: Tarefa[]
  canManage: boolean
  expanded: boolean
  actionLoading?: boolean
  onToggle: () => void
  onMarkResponded: (id: string) => void
  onCancel: (id: string) => void
  onEdit: (pendencia: PendenciaExterna) => void
  onGerarRevisao: (pendencia: PendenciaExterna) => void
  onNavigateToTask?: (disciplina: Disciplina, fase: Fase) => void
}

function orgaoModifier(orgao: string): string {
  return orgao.toLowerCase().replace(/\s+/g, '')
}

function tipoModifier(tipo: string): string {
  return tipo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
}

export function PendenciaCard({
  pendencia,
  tarefas,
  canManage,
  expanded,
  actionLoading = false,
  onToggle,
  onMarkResponded,
  onCancel,
  onEdit,
  onGerarRevisao,
  onNavigateToTask,
}: PendenciaCardProps) {
  const [cancelOpen, setCancelOpen] = useState(false)
  const prazoUrgency = getPrazoUrgency(pendencia.prazo)
  const isOpen = pendencia.status === 'aberta' && !pendencia.revisao_gerada_id

  const linkedTarefas = useMemo(() => {
    const ids = pendencia.tarefas_vinculadas ?? []
    if (ids.length === 0) return []
    const map = new Map(tarefas.map((t) => [t.id, t]))
    return ids.map((id) => map.get(id)).filter((t): t is Tarefa => t != null)
  }, [pendencia.tarefas_vinculadas, tarefas])

  const createdAt = new Date(pendencia.created_at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const recebimentoLabel = pendencia.data_recebimento
    ? formatPrazoDate(pendencia.data_recebimento)
    : null

  return (
    <>
      <article
        className={`pendencia-card pendencia-card--${pendencia.status}${expanded ? ' pendencia-card--expanded' : ''}`}
        aria-label={`Pendência ${pendencia.tipo}`}
      >
        <button type="button" className="pendencia-card__header" onClick={onToggle}>
          <span className="pendencia-card__expand" aria-hidden>
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </span>

          <div className="pendencia-card__main">
            <div className="pendencia-card__badges">
              <span
                className={`pendencia-card__badge pendencia-card__badge--orgao-${orgaoModifier(pendencia.orgao)}`}
              >
                {pendencia.orgao}
              </span>
              <span
                className={`pendencia-card__badge pendencia-card__badge--tipo-${tipoModifier(pendencia.tipo)}`}
              >
                {pendencia.tipo}
              </span>
              <span
                className={`pendencia-card__badge pendencia-card__badge--status-${pendencia.status}`}
              >
                {PENDENCIA_STATUS_LABELS[pendencia.status]}
              </span>
            </div>

            <p className="pendencia-card__descricao">{pendencia.descricao}</p>

            {!expanded ? (
              <div className="pendencia-card__meta">
                {pendencia.prazo ? (
                  <span
                    className={`pendencia-card__prazo pendencia-card__prazo--${prazoUrgency ?? 'normal'}`}
                  >
                    Prazo: {formatPrazoDate(pendencia.prazo)}
                  </span>
                ) : null}
                <span className="pendencia-card__created">
                  {createdAt}
                  {pendencia.criado_por_nome ? ` · ${pendencia.criado_por_nome}` : ''}
                </span>
              </div>
            ) : null}
          </div>
        </button>

        {expanded ? (
          <div className="pendencia-card__body">
            <div className="pendencia-card__meta">
              {recebimentoLabel ? (
                <span>Recebimento: {recebimentoLabel}</span>
              ) : null}
              {pendencia.prazo ? (
                <span
                  className={`pendencia-card__prazo pendencia-card__prazo--${prazoUrgency ?? 'normal'}`}
                >
                  Prazo: {formatPrazoDate(pendencia.prazo)}
                </span>
              ) : null}
              <span className="pendencia-card__created">
                {createdAt}
                {pendencia.criado_por_nome ? ` · ${pendencia.criado_por_nome}` : ''}
              </span>
            </div>

            {linkedTarefas.length > 0 ? (
              <div className="pendencia-card__linked">
                <span className="pendencia-card__linked-label">Tarefas relacionadas</span>
                <div className="pendencia-card__linked-chips">
                  {linkedTarefas.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="pendencia-card__task-chip"
                      title={t.nome}
                      onClick={() => onNavigateToTask?.(t.disciplina, t.fase)}
                    >
                      <span className="pendencia-card__task-chip-name">
                        {shortTarefaNome(t.nome)}
                      </span>
                      <span
                        className={`pendencia-card__task-chip-disc ${discToneClasses(t.disciplina)}`}
                      >
                        {t.disciplina}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {isOpen && canManage ? (
              <div className="pendencia-card__actions">
                <Button
                  variant="secondary"
                  disabled={actionLoading}
                  onClick={() => onMarkResponded(pendencia.id)}
                >
                  Marcar como respondida
                </Button>
                <Button
                  variant="ghost"
                  disabled={actionLoading}
                  onClick={() => onEdit(pendencia)}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  disabled={actionLoading}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="ghost"
                  disabled={actionLoading}
                  onClick={() => onGerarRevisao(pendencia)}
                >
                  Gerar revisão
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>

      <ConfirmModal
        isOpen={cancelOpen}
        title="Cancelar pendência"
        message="Tem certeza que deseja cancelar esta pendência? Esta ação não pode ser desfeita."
        confirmLabel="Cancelar pendência"
        cancelLabel="Voltar"
        variant="warning"
        loading={actionLoading}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false)
          onCancel(pendencia.id)
        }}
      />
    </>
  )
}
