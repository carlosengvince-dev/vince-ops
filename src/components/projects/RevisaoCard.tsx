import { ChevronDown, ChevronRight } from 'lucide-react'
import { DISCIPLINA_LABELS } from '../../lib/constants'
import { discToneClasses } from '../../lib/disciplinaTokens'
import { groupTarefasByCategoria } from '../../lib/projectTasks'
import {
  canCompleteRevisao,
  calcRevisaoTaskStats,
  REVISAO_STATUS_LABELS,
} from '../../lib/revisoes'
import type { Papel, Revisao, Tarefa, TarefaStatus } from '../../types'
import { Button } from '../ui/Button'
import { TaskRow } from './TaskRow'
import './RevisaoCard.css'

interface RevisaoCardProps {
  revisao: Revisao
  tarefas: Tarefa[]
  papel: Papel
  canManage: boolean
  expanded: boolean
  taskTimerTotals: Record<string, number>
  completing?: boolean
  onToggle: () => void
  onComplete: (id: string) => void
  onStatusChange: (tarefaId: string, status: TarefaStatus, motivo?: string) => Promise<void>
  onAssigneeChange: (tarefaId: string, responsavelId: string | null) => Promise<void>
}

function origemModifier(origem: string): string {
  return origem
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
}

export function RevisaoCard({
  revisao,
  tarefas,
  papel,
  canManage,
  expanded,
  taskTimerTotals,
  completing = false,
  onToggle,
  onComplete,
  onStatusChange,
  onAssigneeChange,
}: RevisaoCardProps) {
  const revisionTasks = tarefas.filter(
    (t) => t.revisao_id === revisao.id && t.deleted_at === null,
  )
  const { total, concluidas } = calcRevisaoTaskStats(revisao.id, tarefas)
  const grouped = groupTarefasByCategoria(revisionTasks)
  const showComplete =
    canManage && revisao.status === 'aberta' && canCompleteRevisao(revisao.id, tarefas)

  const abertura = new Date(revisao.data_abertura + 'T00:00:00').toLocaleDateString('pt-BR')

  return (
    <article className={`revisao-card revisao-card--${revisao.status}`}>
      <button type="button" className="revisao-card__header" onClick={onToggle}>
        <span className="revisao-card__expand" aria-hidden>
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>

        <div className="revisao-card__main">
          <div className="revisao-card__top">
            <span className="revisao-card__numero">{revisao.numero}</span>
            <span className={`revisao-card__disc ${discToneClasses(revisao.disciplina)}`}>
              {DISCIPLINA_LABELS[revisao.disciplina]}
            </span>
            <span
              className={`revisao-card__origem revisao-card__origem--${origemModifier(revisao.origem)}`}
            >
              {revisao.origem}
            </span>
            <span className={`revisao-card__status revisao-card__status--${revisao.status}`}>
              {REVISAO_STATUS_LABELS[revisao.status]}
            </span>
          </div>

          {revisao.descricao ? (
            <p className="revisao-card__descricao">{revisao.descricao}</p>
          ) : null}

          <div className="revisao-card__meta">
            <span>
              Abertura: {abertura}
              {revisao.criado_por_nome ? ` · ${revisao.criado_por_nome}` : ''}
            </span>
            <span className="revisao-card__counter">
              {concluidas}/{total} tarefas concluídas
            </span>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="revisao-card__body">
          {revisionTasks.length === 0 ? (
            <p className="revisao-card__empty">Nenhuma tarefa nesta revisão.</p>
          ) : (
            Array.from(grouped.entries()).map(([categoria, items]) => (
              <section key={categoria} className="revisao-card__section">
                <h3 className="revisao-card__section-title">{categoria}</h3>
                <div className="revisao-card__tasks">
                  {items.map((t) => (
                    <TaskRow
                      key={t.id}
                      tarefa={t}
                      papel={papel}
                      taskTimerSeconds={taskTimerTotals[t.id] ?? 0}
                      onStatusChange={onStatusChange}
                      onAssigneeChange={onAssigneeChange}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          {showComplete ? (
            <div className="revisao-card__actions">
              <Button variant="primary" loading={completing} onClick={() => onComplete(revisao.id)}>
                Concluir revisão
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
