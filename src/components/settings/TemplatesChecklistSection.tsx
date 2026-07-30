import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Ellipsis, Plus } from 'lucide-react'
import { useFasesConfig } from '../../contexts/FasesConfigContext'
import { useToast } from '../../hooks/useToast'
import {
  createCategoria,
  deleteCategoriaPorNome,
  fetchCategoriasConfig,
  fetchCategoriaNomes,
  invalidateCategoriasCache,
  renameCategoria,
  type CategoriaConfig,
  type RenameCategoriaEscopo,
} from '../../lib/categoriaConfig'
import {
  createTemplate,
  countTarefasAtivasInCategoria,
  countTemplatesInCategoria,
  deleteTemplate,
  fetchAllTemplates,
  fetchTemplateUsageCounts,
  groupTemplatesByFaseCategoria,
  previewApplyTemplateToProjetos,
  applyTemplateToProjetos,
  reorderTemplates,
  toggleTemplateAtivo,
  updateTemplate,
  type ApplyTemplateEscopo,
  type ApplyTemplatePreview,
  type TemplateChecklistInput,
} from '../../lib/templatesChecklist'
import { getActiveDisciplinaCodigos } from '../../lib/disciplinaConfig'
import { CRITICIDADE_OPTIONS, TAREFA_ORIGEM_OPTIONS } from '../../lib/tarefaManagement'
import type { Criticidade, Disciplina, Fase, OrigemNormativa, TemplateChecklist } from '../../types'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { DisciplinaTabs } from '../ui/DisciplinaTabs'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { SortableTemplateList } from './SortableTemplateList'
import { TemplateFormModal, type TemplateFormValues } from './TemplateFormModal'
import { CategoriaManagementModals } from './CategoriaManagementModals'
import { RestoreScopeAction } from './RestoreScopeAction'
import './TemplatesChecklistSection.css'
import './SettingsSubsection.css'

type ChecklistViewMode = 'lista' | 'arvore'
type ListSortKey = 'nome' | 'fase' | 'categoria' | 'ordem' | 'status' | 'uso'

export function TemplatesChecklistSection() {
  const { showToast } = useToast()
  const { getSequence, getLabel, loading: fasesLoading } = useFasesConfig()
  const [disciplina, setDisciplina] = useState<Disciplina>(
    () => getActiveDisciplinaCodigos()[0] ?? 'HID',
  )
  const [templates, setTemplates] = useState<TemplateChecklist[]>([])
  const [usageCounts, setUsageCounts] = useState<Map<string, number>>(new Map())
  const [categoriaNomes, setCategoriaNomes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ChecklistViewMode>('lista')
  const [filterNome, setFilterNome] = useState('')
  const [filterFase, setFilterFase] = useState<Fase | ''>('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterAtivo, setFilterAtivo] = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [filterCriticidade, setFilterCriticidade] = useState<Criticidade | ''>('')
  const [filterOrigem, setFilterOrigem] = useState<OrigemNormativa | ''>('')
  const [sortKey, setSortKey] = useState<ListSortKey>('fase')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formContext, setFormContext] = useState<{
    fase: Fase | null
    categoria: string
    pickFase: boolean
    pickCategoria: boolean
  } | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<TemplateChecklist | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [novaCategoriaOpen, setNovaCategoriaOpen] = useState(false)
  const [novaCategoriaFaseHint, setNovaCategoriaFaseHint] = useState<Fase | null>(null)
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('')
  const [creatingCategoria, setCreatingCategoria] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TemplateChecklist | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [formInitialOrdem, setFormInitialOrdem] = useState(1)
  const [categoryMenuKey, setCategoryMenuKey] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<CategoriaConfig | null>(null)
  const [renameNome, setRenameNome] = useState('')
  const [renameEscopo, setRenameEscopo] = useState<RenameCategoriaEscopo>('config_templates')
  const [renamePreview, setRenamePreview] = useState<{ templates: number; tarefas: number } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<CategoriaConfig | null>(null)
  const [deleteTemplateCount, setDeleteTemplateCount] = useState(0)
  const [deleteCascadeTemplates, setDeleteCascadeTemplates] = useState(true)
  const [deletingCategory, setDeletingCategory] = useState(false)
  const [applyTarget, setApplyTarget] = useState<TemplateChecklist | null>(null)
  const [applyPreview, setApplyPreview] = useState<ApplyTemplatePreview | null>(null)
  const [applyEscopo, setApplyEscopo] = useState<ApplyTemplateEscopo>('conteudo')
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const faseOrder = getSequence(disciplina)

  const refetchTemplates = useCallback(async () => {
    const rows = await fetchAllTemplates(disciplina)
    setTemplates(rows)
  }, [disciplina])

  const refetchCategorias = useCallback(async () => {
    const names = await fetchCategoriaNomes(disciplina)
    setCategoriaNomes(names)
  }, [disciplina])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, names, usage] = await Promise.all([
        fetchAllTemplates(disciplina),
        fetchCategoriaNomes(disciplina),
        fetchTemplateUsageCounts(disciplina),
      ])
      setTemplates(rows)
      setCategoriaNomes(names)
      setUsageCounts(usage)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar templates')
    } finally {
      setLoading(false)
    }
  }, [disciplina])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setFilterNome('')
    setFilterFase('')
    setFilterCategoria('')
    setFilterAtivo('todos')
    setFilterCriticidade('')
    setFilterOrigem('')
  }, [disciplina])

  const grouped = useMemo(() => groupTemplatesByFaseCategoria(templates), [templates])

  const categoriasEmUso = useMemo(() => {
    const set = new Set<string>()
    for (const t of templates) {
      if (t.categoria) set.add(t.categoria)
    }
    return set
  }, [templates])

  const categoriasSemTarefas = useMemo(
    () => categoriaNomes.filter((nome) => !categoriasEmUso.has(nome)),
    [categoriaNomes, categoriasEmUso],
  )

  const groupedByFase = useMemo(() => {
    const map = new Map(grouped.map((g) => [g.fase, g]))
    return faseOrder.map((fase) => ({
      fase,
      label: getLabel(fase, disciplina),
      categorias: map.get(fase)?.categorias ?? [],
    }))
  }, [disciplina, faseOrder, getLabel, grouped])

  const fasesComChecklist = useMemo(
    () => faseOrder.filter((f) => f !== 'PRE_INFO'),
    [faseOrder],
  )

  const categoriasParaFiltro = useMemo(() => {
    const set = new Set<string>(categoriaNomes)
    for (const t of templates) {
      if (t.categoria) set.add(t.categoria)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [categoriaNomes, templates])

  const filteredTemplates = useMemo(() => {
    const q = filterNome.trim().toLowerCase()
    const filtered = templates.filter((t) => {
      if (filterFase && t.fase !== filterFase) return false
      if (filterCategoria && t.categoria !== filterCategoria) return false
      if (filterAtivo === 'ativos' && !t.ativo) return false
      if (filterAtivo === 'inativos' && t.ativo) return false
      if (filterCriticidade && t.criticidade !== filterCriticidade) return false
      if (filterOrigem && t.origem !== filterOrigem) return false
      if (q && !t.nome.toLowerCase().includes(q)) return false
      return true
    })

    const dir = sortDir === 'asc' ? 1 : -1
    const faseIndex = (fase: Fase) => {
      const idx = fasesComChecklist.findIndex((f) => f === fase)
      return idx < 0 ? 999 : idx
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'nome':
          cmp = a.nome.localeCompare(b.nome, 'pt-BR')
          break
        case 'fase':
          cmp = faseIndex(a.fase) - faseIndex(b.fase) || a.fase.localeCompare(b.fase)
          break
        case 'categoria':
          cmp = a.categoria.localeCompare(b.categoria, 'pt-BR')
          break
        case 'ordem':
          cmp = a.ordem - b.ordem
          break
        case 'status':
          cmp = Number(b.ativo) - Number(a.ativo)
          break
        case 'uso':
          cmp = (usageCounts.get(a.id) ?? 0) - (usageCounts.get(b.id) ?? 0)
          break
      }
      if (cmp !== 0) return cmp * dir
      // Desempate estável
      return (
        faseIndex(a.fase) - faseIndex(b.fase) ||
        a.categoria.localeCompare(b.categoria, 'pt-BR') ||
        a.ordem - b.ordem ||
        a.nome.localeCompare(b.nome, 'pt-BR')
      )
    })
  }, [
    templates,
    filterNome,
    filterFase,
    filterCategoria,
    filterAtivo,
    filterCriticidade,
    filterOrigem,
    fasesComChecklist,
    sortKey,
    sortDir,
    usageCounts,
  ])

  function toggleSort(key: ListSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'status' || key === 'uso' || key === 'ordem' ? 'desc' : 'asc')
  }

  function sortAria(key: ListSortKey): 'none' | 'ascending' | 'descending' {
    if (sortKey !== key) return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  function sortIndicator(key: ListSortKey): string {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  function catKey(fase: Fase, categoria: string) {
    return `${fase}::${categoria}`
  }

  function resetFilters() {
    setFilterNome('')
    setFilterFase('')
    setFilterCategoria('')
    setFilterAtivo('todos')
    setFilterCriticidade('')
    setFilterOrigem('')
  }

  async function openRenameCategoria(categoria: string) {
    const target: CategoriaConfig = {
      id: `${disciplina}::${categoria}`,
      disciplina,
      nome: categoria,
      ordem: 0,
      sistema: false,
      ativo: true,
    }
    setRenameTarget(target)
    setRenameNome(categoria)
    setRenameEscopo('config_templates')
    setRenamePreview(null)
    try {
      const [templates, tarefas] = await Promise.all([
        countTemplatesInCategoria(disciplina, categoria),
        countTarefasAtivasInCategoria(disciplina, categoria),
      ])
      setRenamePreview({ templates, tarefas })
    } catch {
      setRenamePreview({ templates: 0, tarefas: 0 })
    }
  }

  async function handleRenameCategoriaConfirm() {
    if (!renameTarget) return
    const nome = renameNome.trim()
    if (!nome) {
      showToast('Informe o novo nome', 'error')
      return
    }
    if (nome === renameTarget.nome) {
      setRenameTarget(null)
      return
    }
    setRenaming(true)
    try {
      const rows = await fetchCategoriasConfig(disciplina, { skipCache: true, includeInactive: true })
      let found = rows.find((c) => c.nome === renameTarget.nome)
      if (!found) {
        await createCategoria(disciplina, renameTarget.nome)
        const refreshed = await fetchCategoriasConfig(disciplina, { skipCache: true, includeInactive: true })
        found = refreshed.find((c) => c.nome === renameTarget.nome)
      }
      if (!found) throw new Error('Categoria não encontrada para renomear.')
      const result = await renameCategoria(found.id, nome, renameEscopo)
      invalidateCategoriasCache(disciplina)
      setRenameTarget(null)
      await Promise.all([refetchTemplates(), refetchCategorias()])
      showToast(
        `Renomeada. ${result.templates_afetados} templates e ${result.tarefas_afetadas} tarefas atualizados.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao renomear categoria')
      showToast(e instanceof Error ? e.message : 'Erro ao renomear categoria', 'error')
    } finally {
      setRenaming(false)
    }
  }

  async function openDeleteCategoria(categoria: string) {
    setDeleteCategoryTarget({
      id: `${disciplina}::${categoria}`,
      disciplina,
      nome: categoria,
      ordem: 0,
      sistema: false,
      ativo: true,
    })
    setDeleteCascadeTemplates(true)
    try {
      const count = await countTemplatesInCategoria(disciplina, categoria)
      setDeleteTemplateCount(count)
    } catch {
      setDeleteTemplateCount(0)
    }
  }

  async function handleDeleteCategoriaConfirm() {
    if (!deleteCategoryTarget) return
    setDeletingCategory(true)
    try {
      const result = await deleteCategoriaPorNome(
        disciplina,
        deleteCategoryTarget.nome,
        deleteCascadeTemplates,
      )
      invalidateCategoriasCache(disciplina)
      setDeleteCategoryTarget(null)
      await Promise.all([refetchTemplates(), refetchCategorias()])
      if (!result.categoria_removida && result.templates_excluidos === 0) {
        showToast('Nada a remover.')
      } else {
        showToast(`Categoria removida. ${result.templates_excluidos} tarefas de template excluídas.`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir categoria')
      showToast(e instanceof Error ? e.message : 'Erro ao excluir categoria', 'error')
    } finally {
      setDeletingCategory(false)
    }
  }

  function toggleCat(fase: Fase, categoria: string) {
    const key = catKey(fase, categoria)
    setExpandedCats((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function openCreate(fase: Fase, categoria: string) {
    setFormMode('create')
    setFormContext({ fase, categoria, pickFase: false, pickCategoria: false })
    setEditingTemplate(null)
    setFormError(null)
    const catTemplates = templates.filter((t) => t.fase === fase && t.categoria === categoria)
    const maxOrdem = catTemplates.reduce((m, t) => Math.max(m, t.ordem), 0)
    setFormInitialOrdem(maxOrdem + 1)
    setFormOpen(true)
  }

  function openCreateFromEmptyCategoria(categoria: string) {
    setFormMode('create')
    setFormContext({
      fase: null,
      categoria,
      pickFase: true,
      pickCategoria: false,
    })
    setEditingTemplate(null)
    setFormError(null)
    setFormInitialOrdem(1)
    setFormOpen(true)
  }

  function openCreateFromList() {
    setFormMode('create')
    setFormContext({
      fase: filterFase || null,
      categoria: filterCategoria || '',
      pickFase: true,
      pickCategoria: true,
    })
    setEditingTemplate(null)
    setFormError(null)
    setFormInitialOrdem(1)
    setFormOpen(true)
  }

  function openEdit(template: TemplateChecklist) {
    setFormMode('edit')
    setFormContext({
      fase: template.fase,
      categoria: template.categoria,
      pickFase: true,
      pickCategoria: true,
    })
    setEditingTemplate(template)
    setFormError(null)
    setFormOpen(true)
  }

  async function handleFormSubmit(values: TemplateFormValues) {
    if (!formContext) return
    if (!formContext.fase) {
      setFormError('Selecione a fase')
      return
    }
    if (!formContext.categoria.trim()) {
      setFormError('Selecione a categoria')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const input: TemplateChecklistInput = {
        disciplina,
        fase: formContext.fase,
        categoria: formContext.categoria,
        ...values,
      }
      if (formMode === 'create') {
        await createTemplate(input)
        setFormOpen(false)
        await load()
        showToast('Tarefa criada na biblioteca')
      } else if (editingTemplate) {
        await updateTemplate(editingTemplate.id, {
          ...values,
          fase: formContext.fase,
          categoria: formContext.categoria,
        })
        setFormOpen(false)
        await load()
        showToast('Biblioteca atualizada')
        try {
          const preview = await previewApplyTemplateToProjetos(editingTemplate.id)
          if (preview.tarefas > 0) {
            const row =
              (await fetchAllTemplates(disciplina)).find((t) => t.id === editingTemplate.id) ??
              editingTemplate
            setApplyTarget(row)
            setApplyEscopo('conteudo')
            setApplyPreview(preview)
            setApplyError(null)
          }
        } catch {
          // oferta opcional — falha no preview não bloqueia o save
        }
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function openApplyToProjetos(template: TemplateChecklist) {
    setApplyTarget(template)
    setApplyEscopo('conteudo')
    setApplyError(null)
    setApplyPreview(null)
    setApplyLoading(true)
    try {
      const preview = await previewApplyTemplateToProjetos(template.id)
      setApplyPreview(preview)
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Erro ao carregar impacto')
    } finally {
      setApplyLoading(false)
    }
  }

  async function handleConfirmApply() {
    if (!applyTarget) return
    setApplyLoading(true)
    setApplyError(null)
    try {
      const result = await applyTemplateToProjetos(applyTarget.id, applyEscopo)
      setApplyTarget(null)
      setApplyPreview(null)
      showToast(
        `Aplicado em ${result.projetos_afetados} projeto(s) — ${result.tarefas_atualizadas} tarefa(s).`,
      )
      await load()
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Erro ao aplicar')
    } finally {
      setApplyLoading(false)
    }
  }

  async function handleToggleAtivo(template: TemplateChecklist) {
    try {
      await toggleTemplateAtivo(template.id, !template.ativo)
      await refetchTemplates()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar status')
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    try {
      await deleteTemplate(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir tarefa')
    } finally {
      setDeleting(false)
    }
  }

  async function handleReorder(fase: Fase, categoria: string, orderedActiveIds: string[]) {
    const inactiveInCat = templates.filter(
      (t) => t.fase === fase && t.categoria === categoria && !t.ativo,
    )
    const updates = [
      ...orderedActiveIds.map((id, index) => ({ id, ordem: index + 1 })),
      ...inactiveInCat.map((t, index) => ({
        id: t.id,
        ordem: orderedActiveIds.length + index + 1,
      })),
    ]
    try {
      await reorderTemplates(updates)
      await refetchTemplates()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao reordenar')
      await refetchTemplates()
    }
  }

  function handleNovaCategoria() {
    const nome = novaCategoriaNome.trim()
    if (!nome) return
    const faseHint = novaCategoriaFaseHint
    void (async () => {
      setCreatingCategoria(true)
      setError(null)
      try {
        await createCategoria(disciplina, nome)
        setNovaCategoriaOpen(false)
        setNovaCategoriaNome('')
        setNovaCategoriaFaseHint(null)
        await refetchCategorias()
        showToast('Categoria criada', 'success', {
          label: 'Adicionar tarefa',
          onClick: () => {
            if (faseHint) openCreate(faseHint, nome)
            else openCreateFromEmptyCategoria(nome)
          },
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao criar categoria')
      } finally {
        setCreatingCategoria(false)
      }
    })()
  }

  return (
    <section className="settings-subsection">
      <header className="settings-subsection__head">
        <div>
          <h2 className="settings-subsection__title">Templates de checklist</h2>
          <p className="settings-subsection__hint">
            Biblioteca do catálogo (snapshot nos projetos). Alterações aqui não afetam projetos em
            andamento automaticamente.
          </p>
        </div>
        <RestoreScopeAction escopo="templates" onRestored={load} />
      </header>

      <DisciplinaTabs
        className="templates-checklist__tabs"
        value={disciplina}
        onChange={setDisciplina}
      />

      {error ? <p className="settings-subsection__error">{error}</p> : null}
      {loading || fasesLoading ? <p className="settings-subsection__status">Carregando…</p> : null}

      {!loading && !fasesLoading ? (
        <>
          <div className="templates-checklist__toolbar">
            <div className="templates-checklist__view-toggle" role="group" aria-label="Modo de visualização">
              <button
                type="button"
                className={`templates-checklist__view-btn${viewMode === 'lista' ? ' templates-checklist__view-btn--active' : ''}`}
                onClick={() => setViewMode('lista')}
              >
                Lista
              </button>
              <button
                type="button"
                className={`templates-checklist__view-btn${viewMode === 'arvore' ? ' templates-checklist__view-btn--active' : ''}`}
                onClick={() => setViewMode('arvore')}
              >
                Por fase
              </button>
            </div>
            <Button variant="primary" onClick={openCreateFromList}>
              <Plus size={14} />
              Nova tarefa
            </Button>
          </div>

          {viewMode === 'lista' ? (
            <div className="templates-checklist__list-panel">
              <div className="templates-checklist__filters">
                <Input
                  label="Buscar nome"
                  value={filterNome}
                  onChange={(e) => setFilterNome(e.target.value)}
                  placeholder="Filtrar por nome…"
                />
                <label className="templates-checklist__filter-field">
                  <span>Fase</span>
                  <select
                    value={filterFase}
                    onChange={(e) => setFilterFase((e.target.value || '') as Fase | '')}
                  >
                    <option value="">Todas</option>
                    {fasesComChecklist.map((f) => (
                      <option key={f} value={f}>
                        {getLabel(f, disciplina)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="templates-checklist__filter-field">
                  <span>Categoria</span>
                  <select
                    value={filterCategoria}
                    onChange={(e) => setFilterCategoria(e.target.value)}
                  >
                    <option value="">Todas</option>
                    {categoriasParaFiltro.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="templates-checklist__filter-field">
                  <span>Status</span>
                  <select
                    value={filterAtivo}
                    onChange={(e) =>
                      setFilterAtivo(e.target.value as 'todos' | 'ativos' | 'inativos')
                    }
                  >
                    <option value="todos">Todos</option>
                    <option value="ativos">Ativos</option>
                    <option value="inativos">Inativos</option>
                  </select>
                </label>
                <label className="templates-checklist__filter-field">
                  <span>Criticidade</span>
                  <select
                    value={filterCriticidade}
                    onChange={(e) =>
                      setFilterCriticidade((e.target.value || '') as Criticidade | '')
                    }
                  >
                    <option value="">Todas</option>
                    {CRITICIDADE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="templates-checklist__filter-field">
                  <span>Origem</span>
                  <select
                    value={filterOrigem}
                    onChange={(e) =>
                      setFilterOrigem((e.target.value || '') as OrigemNormativa | '')
                    }
                  >
                    <option value="">Todas</option>
                    {TAREFA_ORIGEM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="templates-checklist__filters-reset"
                  onClick={resetFilters}
                >
                  Limpar filtros
                </button>
              </div>

              <p className="templates-checklist__list-summary">
                {filteredTemplates.length} de {templates.length} tarefas
              </p>

              {filteredTemplates.length === 0 ? (
                <p className="templates-checklist__empty-cat">Nenhuma tarefa com esses filtros.</p>
              ) : (
                <div className="templates-checklist__table-wrap">
                  <table className="templates-checklist__table">
                    <thead>
                      <tr>
                        <th aria-sort={sortAria('nome')}>
                          <button type="button" className="templates-checklist__th-btn" onClick={() => toggleSort('nome')}>
                            Nome{sortIndicator('nome')}
                          </button>
                        </th>
                        <th aria-sort={sortAria('fase')}>
                          <button type="button" className="templates-checklist__th-btn" onClick={() => toggleSort('fase')}>
                            Fase{sortIndicator('fase')}
                          </button>
                        </th>
                        <th aria-sort={sortAria('categoria')}>
                          <button
                            type="button"
                            className="templates-checklist__th-btn"
                            onClick={() => toggleSort('categoria')}
                          >
                            Categoria{sortIndicator('categoria')}
                          </button>
                        </th>
                        <th aria-sort={sortAria('ordem')}>
                          <button type="button" className="templates-checklist__th-btn" onClick={() => toggleSort('ordem')}>
                            Ordem{sortIndicator('ordem')}
                          </button>
                        </th>
                        <th aria-sort={sortAria('status')}>
                          <button
                            type="button"
                            className="templates-checklist__th-btn"
                            onClick={() => toggleSort('status')}
                          >
                            Status{sortIndicator('status')}
                          </button>
                        </th>
                        <th aria-sort={sortAria('uso')}>
                          <button type="button" className="templates-checklist__th-btn" onClick={() => toggleSort('uso')}>
                            Uso{sortIndicator('uso')}
                          </button>
                        </th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTemplates.map((t) => (
                        <tr key={t.id} className={!t.ativo ? 'templates-checklist__row--off' : undefined}>
                          <td>
                            <button
                              type="button"
                              className="templates-checklist__name-btn"
                              onClick={() => openEdit(t)}
                            >
                              {t.nome}
                            </button>
                            {t.criticidade === 'critico' ? (
                              <span className="templates-checklist__pill templates-checklist__pill--critico">
                                Crítico
                              </span>
                            ) : null}
                            {t.origem !== 'interno' ? (
                              <span className="templates-checklist__pill">{t.origem}</span>
                            ) : null}
                          </td>
                          <td>{getLabel(t.fase, disciplina)}</td>
                          <td>{t.categoria}</td>
                          <td className="templates-checklist__num">{t.ordem}</td>
                          <td>{t.ativo ? 'Ativo' : 'Inativo'}</td>
                          <td className="templates-checklist__num" title="Projetos ativos/em revisão">
                            {usageCounts.get(t.id) ?? 0}
                          </td>
                          <td>
                            <div className="templates-checklist__row-actions">
                              <button type="button" onClick={() => openEdit(t)}>
                                Editar
                              </button>
                              {(usageCounts.get(t.id) ?? 0) > 0 ? (
                                <button type="button" onClick={() => void openApplyToProjetos(t)}>
                                  Aplicar em projetos
                                </button>
                              ) : null}
                              <button type="button" onClick={() => void handleToggleAtivo(t)}>
                                {t.ativo ? 'Desativar' : 'Ativar'}
                              </button>
                              <button
                                type="button"
                                className="templates-checklist__row-danger"
                                onClick={() => setDeleteTarget(t)}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
        <div className="templates-checklist__phases">
          {groupedByFase.map(({ fase, label, categorias }) => (
            <div key={fase} className="templates-checklist__phase">
              <h3 className="templates-checklist__phase-title">{label}</h3>

              {categorias.length === 0 ? (
                <p className="templates-checklist__empty-cat">Nenhuma categoria nesta fase.</p>
              ) : (
                categorias.map(({ categoria, templates: catTemplates }) => {
                  const key = catKey(fase, categoria)
                  const expanded = expandedCats.has(key)
                  const categoriaViva = categoriaNomes.includes(categoria)
                  return (
                    <div key={key} className="templates-checklist__category">
                      <div className="templates-checklist__category-header">
                        <button
                          type="button"
                          className="templates-checklist__category-toggle"
                          onClick={() => toggleCat(fase, categoria)}
                        >
                          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <span>{categoria}</span>
                          {!categoriaViva ? (
                            <span
                              className="templates-checklist__outside-chip"
                              title="Removida da lista de categorias; as tarefas do template permanecem"
                            >
                              fora da lista
                            </span>
                          ) : null}
                          <span className="templates-checklist__cat-count">{catTemplates.length}</span>
                        </button>
                        <button
                          type="button"
                          className="templates-checklist__cat-menu-trigger"
                          aria-label={`Ações da categoria ${categoria}`}
                          onClick={() => setCategoryMenuKey((prev) => (prev === key ? null : key))}
                        >
                          <Ellipsis size={16} />
                        </button>
                        {categoryMenuKey === key ? (
                          <div className="templates-checklist__cat-menu">
                            <button
                              type="button"
                              onClick={() => {
                                setCategoryMenuKey(null)
                                void openRenameCategoria(categoria)
                              }}
                            >
                              Renomear categoria
                            </button>
                            <button
                              type="button"
                              className="templates-checklist__cat-menu-danger"
                              onClick={() => {
                                setCategoryMenuKey(null)
                                void openDeleteCategoria(categoria)
                              }}
                            >
                              Excluir categoria
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {expanded ? (
                        <div className="templates-checklist__category-body">
                          <SortableTemplateList
                            items={catTemplates}
                            onEdit={openEdit}
                            onToggleAtivo={handleToggleAtivo}
                            onDelete={setDeleteTarget}
                            onReorder={(ids) => void handleReorder(fase, categoria, ids)}
                          />
                          <Button
                            variant="secondary"
                            className="templates-checklist__add-task"
                            onClick={() => openCreate(fase, categoria)}
                          >
                            <Plus size={14} />
                            Adicionar tarefa
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}

              <Button
                variant="secondary"
                className="templates-checklist__add-cat"
                onClick={() => {
                  setNovaCategoriaFaseHint(fase)
                  setNovaCategoriaNome('')
                  setNovaCategoriaOpen(true)
                }}
              >
                <Plus size={14} />
                Nova categoria
              </Button>
            </div>
          ))}

          {categoriasSemTarefas.length > 0 ? (
            <div className="templates-checklist__orphan">
              <h3 className="templates-checklist__orphan-title">Categorias sem tarefas</h3>
              <p className="templates-checklist__orphan-hint">
                Categorias da disciplina ainda sem nenhuma tarefa de template.
              </p>
              <div className="templates-checklist__orphan-chips">
                {categoriasSemTarefas.map((nome) => (
                  <div key={nome} className="templates-checklist__orphan-chip">
                    <span>{nome}</span>
                    <button
                      type="button"
                      className="templates-checklist__orphan-add"
                      onClick={() => openCreateFromEmptyCategoria(nome)}
                    >
                      <Plus size={12} />
                      Adicionar tarefa
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
          )}
        </>
      ) : null}

      <TemplateFormModal
        open={formOpen}
        mode={formMode}
        loading={saving}
        error={formError}
        categoriaLabel={
          formContext && !formContext.pickCategoria ? formContext.categoria : null
        }
        faseSelect={
          formContext?.pickFase
            ? {
                options: fasesComChecklist.map((f) => ({
                  value: f,
                  label: getLabel(f, disciplina),
                })),
                value: formContext.fase ?? '',
                onChange: (fase) => {
                  setFormContext((prev) => (prev ? { ...prev, fase } : prev))
                  if (formMode === 'create' && formContext.categoria) {
                    const catTemplates = templates.filter(
                      (t) => t.fase === fase && t.categoria === formContext.categoria,
                    )
                    const maxOrdem = catTemplates.reduce((m, t) => Math.max(m, t.ordem), 0)
                    setFormInitialOrdem(maxOrdem + 1)
                  }
                },
              }
            : null
        }
        categoriaSelect={
          formContext?.pickCategoria
            ? {
                options: categoriasParaFiltro,
                value: formContext.categoria,
                onChange: (categoria) => {
                  setFormContext((prev) => (prev ? { ...prev, categoria } : prev))
                },
              }
            : null
        }
        initial={
          editingTemplate
            ? {
                nome: editingTemplate.nome,
                descricao: editingTemplate.descricao,
                criticidade: editingTemplate.criticidade,
                origem: editingTemplate.origem,
                referencia_normativa: editingTemplate.referencia_normativa,
                executor_padrao: editingTemplate.executor_padrao,
                metodologia_minima: editingTemplate.metodologia_minima,
                ordem: editingTemplate.ordem,
              }
            : formMode === 'create'
              ? { ordem: formInitialOrdem }
              : undefined
        }
        onClose={() => setFormOpen(false)}
        onSubmit={(v) => void handleFormSubmit(v)}
      />

      <Modal
        open={novaCategoriaOpen}
        title="Nova categoria"
        onClose={() => {
          if (!creatingCategoria) setNovaCategoriaOpen(false)
        }}
      >
        <div className="templates-checklist__nova-cat">
          <Input
            label="Nome da categoria"
            value={novaCategoriaNome}
            onChange={(e) => setNovaCategoriaNome(e.target.value)}
          />
          <div className="templates-checklist__nova-cat-actions">
            <Button
              variant="secondary"
              disabled={creatingCategoria}
              onClick={() => setNovaCategoriaOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={!novaCategoriaNome.trim() || creatingCategoria}
              onClick={handleNovaCategoria}
            >
              {creatingCategoria ? 'Criando…' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={applyTarget != null}
        title="Aplicar em projetos ativos?"
        onClose={() => {
          if (!applyLoading) {
            setApplyTarget(null)
            setApplyPreview(null)
            setApplyError(null)
          }
        }}
      >
        <div className="templates-checklist__apply">
          {applyTarget ? (
            <p className="templates-checklist__apply-lead">
              Template: <strong>{applyTarget.nome}</strong>
            </p>
          ) : null}
          {applyLoading && !applyPreview ? (
            <p className="settings-subsection__status">Calculando impacto…</p>
          ) : null}
          {applyPreview ? (
            <p className="templates-checklist__apply-impact">
              Afeta <strong>{applyPreview.tarefas}</strong> tarefa(s) em{' '}
              <strong>{applyPreview.projetos}</strong> projeto(s) ativo/em revisão.
              Projetos concluídos ou cancelados não são alterados. Tarefas sem vínculo com este
              template não são criadas.
            </p>
          ) : null}
          <fieldset className="templates-checklist__apply-escopo">
            <legend>O que aplicar</legend>
            <label>
              <input
                type="radio"
                name="apply-escopo"
                checked={applyEscopo === 'conteudo'}
                onChange={() => setApplyEscopo('conteudo')}
                disabled={applyLoading}
              />
              <span>
                <strong>Só conteúdo</strong> — nome, descrição, criticidade, origem, referência,
                metodologia
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="apply-escopo"
                checked={applyEscopo === 'conteudo_e_colocacao'}
                onChange={() => setApplyEscopo('conteudo_e_colocacao')}
                disabled={applyLoading}
              />
              <span>
                <strong>Conteúdo + colocação</strong> — também fase, categoria e ordem (pode mover
                tarefas de fase no projeto)
              </span>
            </label>
          </fieldset>
          {applyError ? <p className="settings-subsection__error">{applyError}</p> : null}
          <div className="templates-checklist__nova-cat-actions">
            <Button
              variant="secondary"
              disabled={applyLoading}
              onClick={() => {
                setApplyTarget(null)
                setApplyPreview(null)
                setApplyError(null)
              }}
            >
              Não aplicar
            </Button>
            <Button
              variant="primary"
              disabled={applyLoading || !applyPreview || applyPreview.tarefas === 0}
              onClick={() => void handleConfirmApply()}
            >
              {applyLoading ? 'Aplicando…' : 'Aplicar agora'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteTarget != null}
        title="Excluir tarefa do template"
        message={
          deleteTarget
            ? `Excluir "${deleteTarget.nome}" do template? Esta ação não pode ser desfeita.`
            : ''
        }
        variant="danger"
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />

      <CategoriaManagementModals
        renameTarget={renameTarget}
        renameNome={renameNome}
        renameEscopo={renameEscopo}
        renamePreview={renamePreview}
        renaming={renaming}
        onRenameNomeChange={setRenameNome}
        onRenameEscopoChange={setRenameEscopo}
        onCloseRename={() => setRenameTarget(null)}
        onConfirmRename={() => void handleRenameCategoriaConfirm()}
        deleteTarget={deleteCategoryTarget}
        deleteTemplateCount={deleteTemplateCount}
        deleteCascadeTemplates={deleteCascadeTemplates}
        deleting={deletingCategory}
        onDeleteCascadeChange={setDeleteCascadeTemplates}
        onConfirmDelete={() => void handleDeleteCategoriaConfirm()}
        onCloseDelete={() => setDeleteCategoryTarget(null)}
      />
    </section>
  )
}
