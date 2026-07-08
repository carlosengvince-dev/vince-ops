import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useProjectRevisoes } from '../../hooks/useProjectRevisoes'
import { logActivity } from '../../lib/activityLog'
import { getDisciplinaLabel } from '../../lib/disciplinaConfig'
import { getFaseAtual, hasPermissao } from '../../lib/constants'
import { fetchProjectPendencias } from '../../lib/pendencias'
import { hasNovaRevisaoDraft } from '../../lib/modalNovaRevisaoStorage'
import { completeRevisao, REVISAO_DISCIPLINAS, type RevisaoPrefill } from '../../lib/revisoes'
import type { Disciplina, Fase, Metodologia, Papel, PendenciaExterna, Revisao, Tarefa, TarefaStatus } from '../../types'
import { Button } from '../ui/Button'
import { CreateRevisaoModal } from './CreateRevisaoModal'
import { RevisaoCard } from './RevisaoCard'
import './RevisoesPanel.css'

interface RevisoesPanelProps {
  projetoId: string
  nome: string
  clienteNome: string | null
  disciplinaAtiva: Disciplina
  metodologia: Partial<Record<Disciplina, Metodologia>>
  fasesAtuais: Record<string, unknown>
  papel: Papel
  usuarioId: string
  usuarioNome: string
  tarefas: Tarefa[]
  taskTimerTotals: Record<string, number>
  enabled: boolean
  refreshToken?: number
  expandedRevisaoId: string | null
  onExpandedRevisaoChange: (id: string | null) => void
  revisaoPrefill?: RevisaoPrefill | null
  onPrefillConsumed?: () => void
  onRevisaoCreated: (revisao: Revisao, newTarefas: Tarefa[]) => void
  onRevisaoCompleted: (revisaoId: string) => void
  onActivityLogged?: () => void
  onStatusChange: (tarefaId: string, status: TarefaStatus, motivo?: string) => Promise<void>
  onAssigneeChange: (tarefaId: string, responsavelId: string | null) => Promise<void>
}

export function RevisoesPanel({
  projetoId,
  nome,
  clienteNome,
  disciplinaAtiva,
  metodologia,
  fasesAtuais,
  papel,
  usuarioId,
  usuarioNome,
  tarefas,
  taskTimerTotals,
  enabled,
  refreshToken = 0,
  expandedRevisaoId,
  onExpandedRevisaoChange,
  revisaoPrefill,
  onPrefillConsumed,
  onRevisaoCreated,
  onRevisaoCompleted,
  onActivityLogged,
  onStatusChange,
  onAssigneeChange,
}: RevisoesPanelProps) {
  const canManage = hasPermissao(papel, 'criar_revisao')
  const revisionDisciplina = REVISAO_DISCIPLINAS.includes(disciplinaAtiva)
    ? disciplinaAtiva
    : null

  const { items, loading, error, refresh, prependItem, patchItem } = useProjectRevisoes(
    projetoId,
    enabled,
    revisionDisciplina,
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [openPendencias, setOpenPendencias] = useState<PendenciaExterna[]>([])
  const [completingId, setCompletingId] = useState<string | null>(null)

  const activeExpandedId = useMemo(() => {
    if (!expandedRevisaoId) return null
    return items.some((r) => r.id === expandedRevisaoId) ? expandedRevisaoId : null
  }, [expandedRevisaoId, items])

  const defaultFase = useMemo(() => {
    if (!revisionDisciplina) return 'EX' as Fase
    return getFaseAtual(fasesAtuais, revisionDisciplina)
  }, [revisionDisciplina, fasesAtuais])

  useEffect(() => {
    if (!enabled) return
    void refresh()
  }, [enabled, refresh, refreshToken])

  useEffect(() => {
    if (!enabled || !createOpen) return
    void fetchProjectPendencias(projetoId).then((rows) => {
      setOpenPendencias(rows.filter((p) => p.status === 'aberta' && !p.revisao_gerada_id))
    })
  }, [enabled, createOpen, projetoId])

  useEffect(() => {
    if (!enabled || !revisaoPrefill) return
    setCreateOpen(true)
    onPrefillConsumed?.()
  }, [enabled, revisaoPrefill, onPrefillConsumed])

  useEffect(() => {
    if (!enabled || revisaoPrefill) return
    if (hasNovaRevisaoDraft(projetoId)) {
      setCreateOpen(true)
    }
  }, [enabled, projetoId, revisaoPrefill])

  function handleCreated(result: { revisao: Revisao; tarefas: Tarefa[] }) {
    prependItem(result.revisao)
    onExpandedRevisaoChange(result.revisao.id)
    onRevisaoCreated(result.revisao, result.tarefas)

    void logActivity({
      projetoId,
      usuarioId,
      tipo: 'revisao_criada',
      descricao: `${usuarioNome} criou revisão ${result.revisao.numero} — ${getDisciplinaLabel(result.revisao.disciplina)}`,
      metadata: {
        revisao_id: result.revisao.id,
        numero: result.revisao.numero,
        disciplina: result.revisao.disciplina,
      },
    })
    onActivityLogged?.()
  }

  async function handleComplete(revisaoId: string) {
    setCompletingId(revisaoId)
    try {
      await completeRevisao(revisaoId)
      const today = new Date().toISOString().slice(0, 10)
      patchItem(revisaoId, { status: 'concluida', data_conclusao: today })
      onRevisaoCompleted(revisaoId)
    } finally {
      setCompletingId(null)
    }
  }

  return (
    <div className="revisoes-panel">
      <header className="revisoes-panel__header">
        <div>
          <h1 className="revisoes-panel__title">{nome}</h1>
          <p className="revisoes-panel__subtitle">{clienteNome ?? 'Sem cliente'} · Revisões</p>
        </div>
        {canManage && revisionDisciplina ? (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden />
            Nova revisão
          </Button>
        ) : null}
      </header>

      <div className="revisoes-panel__body">
        {error ? (
          <p className="revisoes-panel__error" role="alert">
            {error}
          </p>
        ) : null}

        {!revisionDisciplina ? (
          <p className="revisoes-panel__status">
            Revisões disponíveis apenas para disciplinas HID ou PPCI. Selecione uma delas na sidebar.
          </p>
        ) : loading && items.length === 0 ? (
          <p className="revisoes-panel__status">Carregando revisões…</p>
        ) : items.length === 0 ? (
          <p className="revisoes-panel__status">
            Nenhuma revisão registrada para {getDisciplinaLabel(revisionDisciplina)}.
          </p>
        ) : (
          <ul className="revisoes-panel__list">
            {items.map((revisao) => (
              <li key={revisao.id}>
                <RevisaoCard
                  revisao={revisao}
                  tarefas={tarefas}
                  papel={papel}
                  canManage={canManage}
                  expanded={activeExpandedId === revisao.id}
                  taskTimerTotals={taskTimerTotals}
                  completing={completingId === revisao.id}
                  onToggle={() =>
                    onExpandedRevisaoChange(
                      activeExpandedId === revisao.id ? null : revisao.id,
                    )
                  }
                  onComplete={(id) => void handleComplete(id)}
                  onStatusChange={onStatusChange}
                  onAssigneeChange={onAssigneeChange}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateRevisaoModal
        open={createOpen && revisionDisciplina != null}
        projetoId={projetoId}
        disciplinaAtiva={revisionDisciplina ?? 'HID'}
        metodologia={metodologia}
        defaultFase={defaultFase}
        existingRevisoes={items}
        openPendencias={openPendencias}
        prefill={revisaoPrefill}
        usuarioId={usuarioId}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreated}
      />
    </div>
  )
}
