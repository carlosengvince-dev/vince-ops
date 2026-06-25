import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { hasPermissao } from '../../lib/constants'
import { ORIGEM_DISCIPLINA_TONE, discToneClasses } from '../../lib/disciplinaTokens'
import { useTimer } from '../../hooks/useTimer'
import type { Tarefa, TarefaStatus } from '../../types'
import type { Papel } from '../../types'
import { TimerButton } from '../timer/TimerButton'
import { ManualHorasButton } from '../timer/ManualHorasButton'
import { TaskAssigneeDropdown } from './TaskAssigneeDropdown'
import { TaskCommentsPanel } from './TaskCommentsPanel'
import { TaskTimeRecordsPanel } from './TaskTimeRecordsPanel'
import { TaskRowMenu } from './TaskRowMenu'
import { TaskStatusDropdown } from './TaskStatusDropdown'
import { formatTaskDuration } from '../../lib/timerUtils'
import { useActiveProfiles } from '../../hooks/useActiveProfiles'
import './TaskRow.css'

function statusModifier(status: TarefaStatus): string {
  return status.replace('_', '')
}

interface TaskRowProps {
  tarefa: Tarefa
  papel: Papel
  canManage?: boolean
  taskTimerSeconds?: number
  onStatusChange: (tarefaId: string, status: TarefaStatus, motivo?: string) => Promise<void>
  onAssigneeChange: (tarefaId: string, responsavelId: string | null) => Promise<void>
  onEdit?: () => void
  onMove?: () => void
  onDelete?: () => void
  initialExpanded?: boolean
  readOnly?: boolean
}

export function TaskRow({
  tarefa,
  papel,
  canManage = false,
  taskTimerSeconds = 0,
  onStatusChange,
  onAssigneeChange,
  onEdit,
  onMove,
  onDelete,
  initialExpanded = false,
  readOnly = false,
}: TaskRowProps) {
  const [saving, setSaving] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [expanded, setExpanded] = useState(initialExpanded)
  const { isTimerActiveOnTarefa } = useTimer()
  const isTimerActive = isTimerActiveOnTarefa(tarefa.id)
  const canEdit = !readOnly && hasPermissao(papel, 'editar_tarefas')
  const canAssign = !readOnly && hasPermissao(papel, 'editar_projeto')
  const { profiles, loading: profilesLoading } = useActiveProfiles(canAssign)
  const showMenu = canManage && onEdit && onMove && onDelete

  useEffect(() => {
    if (initialExpanded) setExpanded(true)
  }, [initialExpanded, tarefa.id])

  async function handleStatusChange(next: TarefaStatus) {
    if (!canEdit || next === tarefa.status) return

    if (next === 'bloqueado') {
      const motivo = window.prompt('Motivo do bloqueio:')
      if (!motivo?.trim()) return
      setSaving(true)
      try {
        await onStatusChange(tarefa.id, next, motivo.trim())
      } finally {
        setSaving(false)
      }
      return
    }

    setSaving(true)
    try {
      await onStatusChange(tarefa.id, next)
    } finally {
      setSaving(false)
    }
  }

  async function handleAssigneeChange(responsavelId: string | null) {
    if (!canAssign || assigning) return
    if (responsavelId === tarefa.responsavel_id) return

    setAssigning(true)
    try {
      await onAssigneeChange(tarefa.id, responsavelId)
    } finally {
      setAssigning(false)
    }
  }

  const timerLabel = formatTaskDuration(taskTimerSeconds)

  return (
    <article
      className={`task-row task-row--${statusModifier(tarefa.status)}${expanded ? ' task-row--expanded' : ''}`}
    >
      <div className="task-row__body">
        <div className="task-row__main-wrap">
          <button
            type="button"
            className="task-row__main"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <span className="task-row__expand-icon" aria-hidden>
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
            <div className="task-row__main-content">
              <p className="task-row__nome">{tarefa.nome}</p>
              {tarefa.descricao ? (
                <p className="task-row__descricao">{tarefa.descricao}</p>
              ) : null}
              <div className="task-row__badges">
                <span className={`task-row__badge task-row__badge--${tarefa.criticidade}`}>
                  {tarefa.criticidade === 'critico' ? 'Crítico' : 'Normal'}
                </span>
                <span
                  className={[
                    'task-row__badge',
                    'task-row__badge--origem',
                    `task-row__badge--${tarefa.origem.toLowerCase()}`,
                    ORIGEM_DISCIPLINA_TONE[tarefa.origem.toLowerCase()]
                      ? discToneClasses(ORIGEM_DISCIPLINA_TONE[tarefa.origem.toLowerCase()]!)
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {tarefa.origem === 'interno' ? 'Interno' : tarefa.origem}
                </span>
                {tarefa.referencia_normativa ? (
                  <span className="task-row__ref">{tarefa.referencia_normativa}</span>
                ) : null}
              </div>
              {tarefa.motivo_bloqueio ? (
                <p className="task-row__bloqueio">Bloqueio: {tarefa.motivo_bloqueio}</p>
              ) : null}
            </div>
          </button>
          {showMenu ? (
            <TaskRowMenu onEdit={onEdit} onMove={onMove} onDelete={onDelete} />
          ) : null}
        </div>

        <div className="task-row__controls">
          <div className="task-row__timer-row">
            <div className="task-row__timer-actions">
              <TimerButton tarefa={tarefa} papel={papel} readOnly={readOnly} />
              <ManualHorasButton tarefa={tarefa} papel={papel} readOnly={readOnly} />
            </div>
            {timerLabel ? (
              <span
                className={`task-row__timer-total${isTimerActive ? ' task-row__timer-total--active' : ''}`}
              >
                {timerLabel}
              </span>
            ) : null}
          </div>
          <div className="task-row__meta-row">
            <TaskAssigneeDropdown
              responsavelId={tarefa.responsavel_id}
              responsavelNome={tarefa.responsavel_nome ?? null}
              responsavelPapel={tarefa.responsavel_papel ?? null}
              canAssign={canAssign}
              users={profiles}
              usersLoading={profilesLoading}
              disabled={assigning || saving}
              label={`Responsável de ${tarefa.nome}`}
              onAssign={(id) => void handleAssigneeChange(id)}
            />
            <TaskStatusDropdown
              value={tarefa.status}
              disabled={!canEdit || saving || assigning}
              label={`Status de ${tarefa.nome}`}
              onChange={(status) => void handleStatusChange(status)}
            />
          </div>
          {tarefa.data_conclusao ? (
            <time className="task-row__data" dateTime={tarefa.data_conclusao}>
              {new Date(tarefa.data_conclusao).toLocaleDateString('pt-BR')}
            </time>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <>
          <TaskCommentsPanel
            tarefaId={tarefa.id}
            projetoId={tarefa.projeto_id}
            tarefaNome={tarefa.nome}
            papel={papel}
            readOnly={readOnly}
          />
          <TaskTimeRecordsPanel tarefaId={tarefa.id} papel={papel} readOnly={readOnly} />
        </>
      ) : null}
    </article>
  )
}
