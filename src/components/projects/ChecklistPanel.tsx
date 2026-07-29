import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { TAREFA_STATUS_LABELS, hasPermissao } from '../../lib/constants'
import {
  createCategoria,
  fetchCategoriasConfig,
  type CategoriaConfig,
} from '../../lib/categoriaConfig'
import {
  getChecklistCategoriaOrdemForPhase,
  orderCategoriaNames,
} from '../../lib/checklistCategoriaOrdem'
import {
  buildChecklistView,
  filterChecklistTarefas,
  isStructuralChecklistView,
  type ChecklistGroupBy,
  type ChecklistSortBy,
} from '../../lib/checklistView'
import { getPhaseLabel } from '../../lib/faseConfig'
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
import { SortableCategoryList } from './SortableCategoryList'
import { SortableTaskList } from './SortableTaskList'
import { TaskFormModal } from './TaskFormModal'
import './ChecklistPanel.css'

const STATUS_OPTIONS = Object.entries(TAREFA_STATUS_LABELS) as [TarefaStatus, string][]

function statusChipMod(status: TarefaStatus): string {
  return status.replace('_', '')
}

function collapseStorageKey(projetoId: string, disciplina: Disciplina, fase: Fase): string {
  return `checklist_cat_collapse_${projetoId}_${disciplina}_${fase}`
}

function readCollapsedMap(key: string): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean') result[k] = v
    }
    return result
  } catch {
    return {}
  }
}

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
  projetoMetadata?: Record<string, unknown>
  onSaveCategoriaOrdem?: (orderedNames: string[]) => Promise<void>
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
  resolvePhaseLabel?: (codigo: Fase, disciplina: Disciplina) => string
}

export function ChecklistPanel({
  projetoId,
  usuarioId,
  usuarioNome,
  nome: _nome,
  clienteNome: _clienteNome,
  status: _status,
  disciplina,
  fase,
  faseOficial,
  tarefas,
  allTarefas,
  papel,
  taskTimerTotals = {},
  projetoMetadata = {},
  onSaveCategoriaOrdem,
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
  resolvePhaseLabel = getPhaseLabel,
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

  const [configCategorias, setConfigCategorias] = useState<CategoriaConfig[]>([])
  const [filterNome, setFilterNome] = useState('')
  const [filterStatus, setFilterStatus] = useState<TarefaStatus | ''>('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [groupBy, setGroupBy] = useState<ChecklistGroupBy>('categoria')
  const [sortBy, setSortBy] = useState<ChecklistSortBy>('padrao')
  const [soMeus, setSoMeus] = useState(false)
  const [ocultarConcluidos, setOcultarConcluidos] = useState(false)
  const [criticosNoTopo, setCriticosNoTopo] = useState(false)
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({})
  const [viewbarOpen, setViewbarOpen] = useState(true)
  const [tasksExpandSignal, setTasksExpandSignal] = useState<{
    version: number
    open: boolean
  } | null>(null)

  const resetView = useCallback(() => {
    setFilterNome('')
    setFilterStatus('')
    setFilterCategoria('')
    setGroupBy('categoria')
    setSortBy('padrao')
    setSoMeus(false)
    setOcultarConcluidos(false)
    setCriticosNoTopo(false)
  }, [])

  useEffect(() => {
    resetView()
  }, [fase, disciplina, resetView])

  useEffect(() => {
    setCollapsedMap(readCollapsedMap(collapseStorageKey(projetoId, disciplina, fase)))
  }, [projetoId, disciplina, fase])

  useEffect(() => {
    let cancelled = false
    void fetchCategoriasConfig(disciplina)
      .then((rows) => {
        if (!cancelled) setConfigCategorias(rows)
      })
      .catch(() => {
        if (!cancelled) setConfigCategorias([])
      })
    return () => {
      cancelled = true
    }
  }, [disciplina])

  const configCategoriaNomes = useMemo(
    () => configCategorias.map((c) => c.nome),
    [configCategorias],
  )

  const categorias = useMemo(() => {
    const phaseCats = getCategoriasForPhase(allTarefas, disciplina, fase)
    const merged = new Set([...configCategoriaNomes, ...phaseCats])
    return Array.from(merged).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [allTarefas, configCategoriaNomes, disciplina, fase])

  const phaseCategorias = useMemo(() => {
    const names = Array.from(new Set(phaseTarefas.map((t) => t.categoria)))
    return names.sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [phaseTarefas])

  const structuralView = isStructuralChecklistView({
    groupBy,
    sortBy,
    filterNome,
    filterStatus,
    filterCategoria,
    soMeus,
    ocultarConcluidos,
    criticosNoTopo,
  })

  const canReorderTarefas = canManage && structuralView
  const canReorderCategorias =
    canManage && structuralView && groupBy === 'categoria' && Boolean(onSaveCategoriaOrdem)

  const filteredTarefas = useMemo(
    () =>
      filterChecklistTarefas(phaseTarefas, {
        nome: filterNome,
        status: filterStatus,
        categoria: filterCategoria,
        soMeus,
        usuarioId,
        ocultarConcluidos,
      }),
    [
      phaseTarefas,
      filterNome,
      filterStatus,
      filterCategoria,
      soMeus,
      usuarioId,
      ocultarConcluidos,
    ],
  )

  const projectCatOrder = useMemo(
    () => getChecklistCategoriaOrdemForPhase(projetoMetadata, disciplina, fase),
    [projetoMetadata, disciplina, fase],
  )

  const orderedCategoriaNames = useMemo(() => {
    const present = Array.from(new Set(filteredTarefas.map((t) => t.categoria)))
    return orderCategoriaNames(present, projectCatOrder, configCategorias)
  }, [filteredTarefas, projectCatOrder, configCategorias])

  const viewSections = useMemo(
    () =>
      buildChecklistView(filteredTarefas, {
        groupBy,
        sortBy,
        orderedCategoriaNames,
        taskTimerTotals,
        criticosNoTopo,
      }),
    [
      filteredTarefas,
      groupBy,
      sortBy,
      orderedCategoriaNames,
      taskTimerTotals,
      criticosNoTopo,
    ],
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

  const editCategorias = useMemo(() => {
    if (!editingTarefa) return categorias
    if (categorias.includes(editingTarefa.categoria)) return categorias
    return [...categorias, editingTarefa.categoria].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [categorias, editingTarefa])

  const ensureCategoriaConfig = useCallback(
    async (catNome: string) => {
      if (!configCategoriaNomes.includes(catNome)) {
        await createCategoria(disciplina, catNome)
        setConfigCategorias((prev) => {
          if (prev.some((c) => c.nome === catNome)) return prev
          const nextOrdem = prev.length > 0 ? Math.max(...prev.map((c) => c.ordem)) + 1 : 0
          return [
            ...prev,
            { id: '', disciplina, nome: catNome, ordem: nextOrdem, sistema: false, ativo: true },
          ]
        })
      }
    },
    [configCategoriaNomes, disciplina],
  )

  const persistCollapse = useCallback(
    (next: Record<string, boolean>) => {
      setCollapsedMap(next)
      try {
        sessionStorage.setItem(
          collapseStorageKey(projetoId, disciplina, fase),
          JSON.stringify(next),
        )
      } catch {
        /* ignore quota */
      }
    },
    [projetoId, disciplina, fase],
  )

  const toggleCollapse = useCallback(
    (sectionId: string) => {
      persistCollapse({
        ...collapsedMap,
        [sectionId]: !collapsedMap[sectionId],
      })
    },
    [collapsedMap, persistCollapse],
  )

  const collapseAllCategories = useCallback(() => {
    const next: Record<string, boolean> = { ...collapsedMap }
    for (const section of viewSections) {
      next[section.id] = true
    }
    persistCollapse(next)
  }, [collapsedMap, viewSections, persistCollapse])

  const expandAllCategories = useCallback(() => {
    const next: Record<string, boolean> = { ...collapsedMap }
    for (const section of viewSections) {
      next[section.id] = false
    }
    persistCollapse(next)
  }, [collapsedMap, viewSections, persistCollapse])

  const collapseAllTasks = useCallback(() => {
    setTasksExpandSignal((prev) => ({ version: (prev?.version ?? 0) + 1, open: false }))
  }, [])

  const expandAllTasks = useCallback(() => {
    setTasksExpandSignal((prev) => ({ version: (prev?.version ?? 0) + 1, open: true }))
  }, [])

  const handleCategoriaReorder = useCallback(
    (orderedIds: string[]) => {
      if (!onSaveCategoriaOrdem || !canReorderCategorias) return
      void onSaveCategoriaOrdem(orderedIds).catch((err) => {
        setFormError(err instanceof Error ? err.message : 'Erro ao reordenar categorias')
      })
    },
    [onSaveCategoriaOrdem, canReorderCategorias],
  )

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
      await ensureCategoriaConfig(values.categoriaFinal)
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
          descricao: `${usuarioNome} adicionou tarefa '${created.nome}' em ${disciplina} — ${resolvePhaseLabel(fase, disciplina)}`,
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
      await ensureCategoriaConfig(categoriaDestino)
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
        descricao: `${usuarioNome} moveu '${updated.nome}' de ${resolvePhaseLabel(moveTarefa.fase, disciplina)} para ${resolvePhaseLabel(faseDestino, disciplina)}`,
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
        descricao: `${usuarioNome} excluiu tarefa '${deleteTarefa.nome}' em ${disciplina} — ${resolvePhaseLabel(deleteTarefa.fase, disciplina)}`,
        metadata: { tarefa_id: deleteTarefa.id, acao: 'tarefa_excluida' },
      })
      onActivityLogged?.()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir tarefa')
    } finally {
      setSaving(false)
    }
  }

  async function handleReorder(_sectionId: string, orderedIds: string[]) {
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

  const criticosAguardando = useMemo(
    () => (fase === 'AP' ? countCriticosAguardando(documentos) : 0),
    [documentos, fase],
  )

  const renderTaskList = useCallback(
    (sectionId: string, items: Tarefa[]) => (
      <SortableTaskList
        items={items}
        canReorder={canReorderTarefas && groupBy === 'categoria'}
        canManage={canManage}
        papel={papel}
        taskTimerTotals={taskTimerTotals}
        onStatusChange={onStatusChange}
        onAssigneeChange={onAssigneeChange}
        onEdit={openEdit}
        onMove={setMoveTarefa}
        onDelete={setDeleteTarefa}
        onReorder={(ids) => void handleReorder(sectionId, ids)}
        expandedTarefaId={expandedTarefaId}
        expandSignal={tasksExpandSignal}
        readOnly={readOnly}
      />
    ),
    [
      canReorderTarefas,
      groupBy,
      canManage,
      papel,
      taskTimerTotals,
      onStatusChange,
      onAssigneeChange,
      openEdit,
      expandedTarefaId,
      tasksExpandSignal,
      readOnly,
    ],
  )

  const categorySections = useMemo(
    () =>
      viewSections.map((section) => ({
        id: section.id,
        title: section.title,
        count: section.items.length,
        collapsed: Boolean(collapsedMap[section.id]),
        content: renderTaskList(section.id, section.items),
      })),
    [viewSections, collapsedMap, renderTaskList],
  )

  const viewDirty = !structuralView

  return (
    <div className="checklist-panel">
      <div className="checklist-panel__phase-bar">
        <p className="checklist-panel__phase-label">{resolvePhaseLabel(fase, disciplina)}</p>
      </div>

      <div className="checklist-panel__body">
        {viewingOther && !readOnly ? (
          <div className="checklist-panel__banner" role="status">
            Visualizando <strong>{resolvePhaseLabel(fase, disciplina)}</strong> — fase oficial:{' '}
            <strong>{resolvePhaseLabel(faseOficial, disciplina)}</strong>. Itens de qualquer fase podem ser
            editados.
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

        {phaseTarefas.length > 0 ? (
          <div className={`checklist-panel__viewbar${viewbarOpen ? '' : ' checklist-panel__viewbar--collapsed'}`}>
            <div className="checklist-panel__viewbar-top">
              <button
                type="button"
                className="checklist-panel__viewbar-toggle"
                aria-expanded={viewbarOpen}
                onClick={() => setViewbarOpen((v) => !v)}
              >
                <span className="checklist-panel__viewbar-toggle-icon" aria-hidden>
                  {viewbarOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <span className="checklist-panel__viewbar-toggle-title">Filtros e organização</span>
                <span className="checklist-panel__filter-count">
                  {filteredTarefas.length} de {phaseTarefas.length}
                </span>
              </button>
            </div>

            {viewbarOpen ? (
              <>
            <div className="checklist-panel__viewbar-row">
              <div className="checklist-panel__view-group">
                <span className="checklist-panel__view-label">Buscar</span>
                <input
                  type="search"
                  className="checklist-panel__filter-input"
                  placeholder="Nome…"
                  value={filterNome}
                  onChange={(e) => setFilterNome(e.target.value)}
                  aria-label="Filtrar tarefas por nome"
                />
              </div>

              <div className="checklist-panel__view-group checklist-panel__view-group--grow">
                <span className="checklist-panel__view-label">Status</span>
                <div className="checklist-panel__status-chips" role="group" aria-label="Filtrar por status">
                  <button
                    type="button"
                    className={`checklist-panel__status-chip${!filterStatus ? ' checklist-panel__status-chip--active' : ''}`}
                    onClick={() => setFilterStatus('')}
                  >
                    Todos
                  </button>
                  {STATUS_OPTIONS.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={[
                        'checklist-panel__status-chip',
                        `checklist-panel__status-chip--${statusChipMod(value)}`,
                        filterStatus === value ? 'checklist-panel__status-chip--selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setFilterStatus(filterStatus === value ? '' : value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="checklist-panel__view-group">
                <span className="checklist-panel__view-label">Categoria</span>
                <select
                  className="checklist-panel__filter-select"
                  value={filterCategoria}
                  onChange={(e) => setFilterCategoria(e.target.value)}
                  aria-label="Filtrar por categoria"
                >
                  <option value="">Todas</option>
                  {phaseCategorias.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="checklist-panel__viewbar-row checklist-panel__viewbar-row--org">
              <div className="checklist-panel__view-group">
                <span className="checklist-panel__view-label">Agrupar</span>
                <select
                  className="checklist-panel__filter-select"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as ChecklistGroupBy)}
                  aria-label="Agrupar tarefas"
                >
                  <option value="categoria">Categoria</option>
                  <option value="status">Status</option>
                  <option value="responsavel">Responsável</option>
                  <option value="criticidade">Criticidade</option>
                  <option value="nenhum">Lista plana</option>
                </select>
              </div>

              <div className="checklist-panel__view-group">
                <span className="checklist-panel__view-label">Ordenar</span>
                <select
                  className="checklist-panel__filter-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ChecklistSortBy)}
                  aria-label="Ordenar tarefas"
                >
                  <option value="padrao">Padrão</option>
                  <option value="nome_asc">Nome A–Z</option>
                  <option value="nome_desc">Nome Z–A</option>
                  <option value="status">Status</option>
                  <option value="criticidade">Criticidade</option>
                  <option value="responsavel">Responsável</option>
                  <option value="horas_desc">Mais horas</option>
                </select>
              </div>

              <div className="checklist-panel__view-toggles" role="group" aria-label="Atalhos de visualização">
                <button
                  type="button"
                  className={`checklist-panel__toggle${soMeus ? ' checklist-panel__toggle--on' : ''}`}
                  aria-pressed={soMeus}
                  onClick={() => setSoMeus((v) => !v)}
                >
                  Só meus
                </button>
                <button
                  type="button"
                  className={`checklist-panel__toggle${ocultarConcluidos ? ' checklist-panel__toggle--on' : ''}`}
                  aria-pressed={ocultarConcluidos}
                  onClick={() => setOcultarConcluidos((v) => !v)}
                >
                  Ocultar concluídos
                </button>
                <button
                  type="button"
                  className={`checklist-panel__toggle${criticosNoTopo ? ' checklist-panel__toggle--on' : ''}`}
                  aria-pressed={criticosNoTopo}
                  onClick={() => setCriticosNoTopo((v) => !v)}
                >
                  Críticos no topo
                </button>
              </div>

              {viewDirty ? (
                <button type="button" className="checklist-panel__clear-view" onClick={resetView}>
                  Limpar visão
                </button>
              ) : null}
            </div>

            <div className="checklist-panel__viewbar-row checklist-panel__viewbar-row--actions">
              <span className="checklist-panel__view-label">Expandir / recolher</span>
              <div className="checklist-panel__view-toggles" role="group" aria-label="Expandir e recolher">
                {groupBy !== 'nenhum' ? (
                  <>
                    <button type="button" className="checklist-panel__toggle" onClick={expandAllCategories}>
                      Expandir categorias
                    </button>
                    <button type="button" className="checklist-panel__toggle" onClick={collapseAllCategories}>
                      Recolher categorias
                    </button>
                  </>
                ) : null}
                <button type="button" className="checklist-panel__toggle" onClick={expandAllTasks}>
                  Expandir tarefas
                </button>
                <button type="button" className="checklist-panel__toggle" onClick={collapseAllTasks}>
                  Recolher tarefas
                </button>
              </div>
            </div>

            {viewDirty ? (
              <p className="checklist-panel__view-hint">
                Só na visualização — a ordem salva do projeto não muda.
              </p>
            ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {phaseTarefas.length === 0 ? (
          <p className="checklist-panel__empty">Nenhuma tarefa nesta fase.</p>
        ) : filteredTarefas.length === 0 ? (
          <p className="checklist-panel__empty">Nenhuma tarefa corresponde à visão atual.</p>
        ) : groupBy === 'nenhum' ? (
          renderTaskList('__flat__', viewSections[0]?.items ?? [])
        ) : (
          <SortableCategoryList
            items={categorySections}
            canReorder={canReorderCategorias}
            onReorder={handleCategoriaReorder}
            onToggleCollapse={toggleCollapse}
          />
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
