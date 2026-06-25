import { useCallback, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { PHASE_LABELS, PROJETO_STATUS_LABELS, hasPermissao } from '../../lib/constants'
import { groupTarefasByCategoria } from '../../lib/projectTasks'
import {
  createManualTarefa,
  getCategoriasForPhase,
  getNextOrdemInCategoria,
  moveTarefaToPhase,
  reorderTarefasOrdem,
  softDeleteTarefa,
  tarefaToFormValues,
  updateTarefaDetails,
} from '../../lib/tarefaManagement'
import { logActivity } from '../../lib/activityLog'
import { formatTimerHours } from '../../lib/timerUtils'
import { countCriticosAguardando } from '../../lib/documentosProjeto'
import type { Disciplina, DocumentoProjeto, Fase, Papel, Tarefa, TarefaStatus } from '../../types'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { MoveTarefaModal } from './MoveTarefaModal'
import { SortableTaskList } from './SortableTaskList'
import { TaskFormModal } from './TaskFormModal'
import './ChecklistPanel.css'

interface ChecklistPanelProps {
  projetoId: string
  usuarioId: string
  usuarioNome: string
  nome: string
  clienteNome: string | null
  status: string
  disciplina: Disciplina
  fase: Fase
  faseOficial: Fase
  tarefas: Tarefa[]
  allTarefas: Tarefa[]
  papel: Papel
  taskTimerTotals?: Record<string, number>
  onStatusChange: (tarefaId: string, status: TarefaStatus, motivo?: string) => Promise<void>
  onAssigneeChange: (tarefaId: string, responsavelId: string | null) => Promise<void>
  onTarefaCreated: (tarefa: Tarefa) => void
  onTarefaUpdated: (tarefa: Tarefa) => void
  onTarefaMoved: (tarefa: Tarefa) => void
  onTarefaDeleted: (tarefaId: string) => void
  onTarefasReordered: (updates: { id: string; ordem: number }[]) => void
  onActivityLogged?: () => void
  expandedTarefaId?: string | null
  readOnly?: boolean
  documentos?: DocumentoProjeto[]
  onNavigateToPreInfo?: () => void
}

export function ChecklistPanel({
  projetoId,
  usuarioId,
  usuarioNome,
  nome,
  clienteNome,
  status,
  disciplina,
  fase,
  faseOficial,
  tarefas,
  allTarefas,
  papel,
  taskTimerTotals = {},
  onStatusChange,
  onAssigneeChange,
  onTarefaCreated,
  onTarefaUpdated,
  onTarefaMoved,
  onTarefaDeleted,
  onTarefasReordered,
  onActivityLogged,
  expandedTarefaId = null,
  readOnly = false,
  documentos = [],
  onNavigateToPreInfo,
}: ChecklistPanelProps) {
  const canManage = hasPermissao(papel, 'editar_projeto') && !readOnly
  const viewingOther = fase !== faseOficial

  const phaseTarefas = useMemo(
    () =>
      tarefas.filter(
        (t) =>
          t.disciplina === disciplina &&
          t.fase === fase &&
          t.revisao_id == null &&
          t.deleted_at === null,
      ),
    [tarefas, disciplina, fase],
  )

  const grouped = useMemo(() => groupTarefasByCategoria(phaseTarefas), [phaseTarefas])
  const categorias = useMemo(
    () => getCategoriasForPhase(allTarefas, disciplina, fase),
    [allTarefas, disciplina, fase],
  )

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null)
  const [moveTarefa, setMoveTarefa] = useState<Tarefa | null>(null)
  const [deleteTarefa, setDeleteTarefa] = useState<Tarefa | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const openCreate = useCallback(() => {
    setFormMode('create')
    setEditingTarefa(null)
    setFormError(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((tarefa: Tarefa) => {
    setFormMode('edit')
    setEditingTarefa(tarefa)
    setFormError(null)
    setFormOpen(true)
  }, [])

  async function handleFormSubmit(values: {
    nome: string
    descricao: string
    criticidade: Tarefa['criticidade']
    origem: Tarefa['origem']
    referencia_normativa: string
    responsavelId: string
    categoriaFinal: string
  }) {
    setSaving(true)
    setFormError(null)
    try {
      if (formMode === 'create') {
        const ordem = getNextOrdemInCategoria(allTarefas, disciplina, fase, values.categoriaFinal)
        const created = await createManualTarefa({
          projetoId,
          disciplina,
          fase,
          categoria: values.categoriaFinal,
          nome: values.nome,
          descricao: values.descricao || null,
          criticidade: values.criticidade,
          origem: values.origem,
          referencia_normativa: values.referencia_normativa || null,
          responsavelId: values.responsavelId || null,
          ordem,
          userId: usuarioId,
        })
        onTarefaCreated(created)
        setFormOpen(false)

        void logActivity({
          projetoId,
          usuarioId,
          tipo: 'tarefa_status_alterado',
          descricao: `${usuarioNome} adicionou tarefa '${created.nome}' em ${disciplina} — ${PHASE_LABELS[fase]}`,
          metadata: { tarefa_id: created.id, acao: 'tarefa_criada' },
        })
        onActivityLogged?.()
      } else if (editingTarefa) {
        const updated = await updateTarefaDetails({
          tarefaId: editingTarefa.id,
          nome: values.nome,
          descricao: values.descricao || null,
          categoria: values.categoriaFinal,
          criticidade: values.criticidade,
          origem: values.origem,
          referencia_normativa: values.referencia_normativa || null,
          responsavelId: values.responsavelId || null,
          userId: usuarioId,
        })
        onTarefaUpdated(updated)
        setFormOpen(false)

        void logActivity({
          projetoId,
          usuarioId,
          tipo: 'tarefa_status_alterado',
          descricao: `${usuarioNome} editou tarefa '${updated.nome}'`,
          metadata: { tarefa_id: updated.id, acao: 'tarefa_editada' },
        })
        onActivityLogged?.()
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar tarefa')
    } finally {
      setSaving(false)
    }
  }

  async function handleMoveConfirm(faseDestino: Fase, categoriaDestino: string) {
    if (!moveTarefa) return
    setSaving(true)
    setMoveError(null)
    try {
      const ordem = getNextOrdemInCategoria(allTarefas, disciplina, faseDestino, categoriaDestino)
      const updated = await moveTarefaToPhase({
        tarefaId: moveTarefa.id,
        fase: faseDestino,
        categoria: categoriaDestino,
        ordem,
        userId: usuarioId,
      })
      onTarefaMoved(updated)
      setMoveTarefa(null)

      void logActivity({
        projetoId,
        usuarioId,
        tipo: 'tarefa_status_alterado',
        descricao: `${usuarioNome} moveu '${updated.nome}' de ${PHASE_LABELS[moveTarefa.fase]} para ${PHASE_LABELS[faseDestino]}`,
        metadata: {
          tarefa_id: updated.id,
          fase_origem: moveTarefa.fase,
          fase_destino: faseDestino,
          acao: 'tarefa_movida',
        },
      })
      onActivityLogged?.()
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : 'Erro ao mover tarefa')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarefa) return
    setSaving(true)
    setDeleteError(null)
    try {
      await softDeleteTarefa(deleteTarefa.id, usuarioId)
      onTarefaDeleted(deleteTarefa.id)
      setDeleteTarefa(null)

      void logActivity({
        projetoId,
        usuarioId,
        tipo: 'tarefa_status_alterado',
        descricao: `${usuarioNome} excluiu tarefa '${deleteTarefa.nome}' em ${disciplina} — ${PHASE_LABELS[deleteTarefa.fase]}`,
        metadata: { tarefa_id: deleteTarefa.id, acao: 'tarefa_excluida' },
      })
      onActivityLogged?.()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir tarefa')
    } finally {
      setSaving(false)
    }
  }

  async function handleReorder(_categoria: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, index) => ({ id, ordem: index }))
    try {
      await reorderTarefasOrdem(updates, usuarioId)
      onTarefasReordered(updates)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao reordenar tarefas')
    }
  }

  const deleteTimerHours = deleteTarefa ? taskTimerTotals[deleteTarefa.id] ?? 0 : 0
  const deleteMessage =
    deleteTarefa &&
    `'${deleteTarefa.nome}' será excluída permanentemente deste projeto. Esta ação não pode ser desfeita.` +
      (deleteTimerHours > 0
        ? ` Esta tarefa tem ${formatTimerHours(deleteTimerHours)}h registradas. Os registros de tempo serão mantidos no histórico mas não serão exibidos no projeto.`
        : '')

  const editCategorias = useMemo(() => {
    if (!editingTarefa) return categorias
    const set = new Set(categorias)
    set.add(editingTarefa.categoria)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [categorias, editingTarefa])

  const criticosAguardando = useMemo(
    () => (fase === 'AP' ? countCriticosAguardando(documentos) : 0),
    [documentos, fase],
  )

  return (
    <div className="checklist-panel">
      <header className="checklist-panel__header">
        <div>
          <h1 className="checklist-panel__title">{nome}</h1>
          <p className="checklist-panel__subtitle">
            {clienteNome ?? 'Sem cliente'} · {PHASE_LABELS[fase]}
          </p>
        </div>
        <span className={`checklist-panel__status checklist-panel__status--${status.replace('_', '')}`}>
          {PROJETO_STATUS_LABELS[status as keyof typeof PROJETO_STATUS_LABELS] ?? status}
        </span>
      </header>

      <div className="checklist-panel__body">
        {viewingOther && !readOnly ? (
          <div className="checklist-panel__banner" role="status">
            Visualizando <strong>{PHASE_LABELS[fase]}</strong> — fase oficial:{' '}
            <strong>{PHASE_LABELS[faseOficial]}</strong>. Itens de qualquer fase podem ser editados.
          </div>
        ) : null}

        {criticosAguardando > 0 ? (
          <div className="checklist-panel__banner checklist-panel__banner--warning" role="status">
            {criticosAguardando} documento(s) crítico(s) ainda não recebidos.{' '}
            {onNavigateToPreInfo ? (
              <button type="button" className="checklist-panel__banner-link" onClick={onNavigateToPreInfo}>
                Ver documentos
              </button>
            ) : null}
          </div>
        ) : null}

        {phaseTarefas.length === 0 ? (
          <p className="checklist-panel__empty">Nenhuma tarefa nesta fase.</p>
        ) : (
          Array.from(grouped.entries()).map(([categoria, items]) => (
            <section key={categoria} className="checklist-panel__section">
              <h2 className="checklist-panel__section-title">{categoria}</h2>
              <SortableTaskList
                items={items}
                canReorder={canManage}
                canManage={canManage}
                papel={papel}
                taskTimerTotals={taskTimerTotals}
                onStatusChange={onStatusChange}
                onAssigneeChange={onAssigneeChange}
                onEdit={openEdit}
                onMove={setMoveTarefa}
                onDelete={setDeleteTarefa}
                onReorder={(ids) => void handleReorder(categoria, ids)}
                expandedTarefaId={expandedTarefaId}
                readOnly={readOnly}
              />
            </section>
          ))
        )}

        {canManage ? (
          <div className="checklist-panel__add">
            <Button variant="secondary" onClick={openCreate}>
              <Plus size={16} aria-hidden />
              Adicionar tarefa
            </Button>
          </div>
        ) : null}
      </div>

      <TaskFormModal
        open={formOpen}
        mode={formMode}
        loading={saving}
        error={formError}
        categorias={formMode === 'edit' ? editCategorias : categorias}
        storageKey={`modal_tarefa_${projetoId}_${fase}`}
        initial={editingTarefa ? tarefaToFormValues(editingTarefa) : undefined}
        onClose={() => {
          setFormOpen(false)
          setEditingTarefa(null)
          setFormError(null)
        }}
        onSubmit={(data) => void handleFormSubmit(data)}
      />

      <MoveTarefaModal
        open={moveTarefa != null}
        loading={saving}
        error={moveError}
        tarefa={moveTarefa}
        disciplina={disciplina}
        allTarefas={allTarefas}
        onClose={() => {
          setMoveTarefa(null)
          setMoveError(null)
        }}
        onConfirm={(faseDestino, categoriaDestino) =>
          void handleMoveConfirm(faseDestino, categoriaDestino)
        }
      />

      <ConfirmModal
        isOpen={deleteTarefa != null}
        title="Excluir tarefa"
        message={
          deleteError && deleteMessage
            ? `${deleteMessage}\n\n${deleteError}`
            : (deleteMessage ?? deleteError ?? '')
        }
        confirmLabel="Excluir tarefa"
        cancelLabel="Cancelar"
        variant="danger"
        loading={saving}
        onCancel={() => {
          setDeleteTarefa(null)
          setDeleteError(null)
        }}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  )
}
