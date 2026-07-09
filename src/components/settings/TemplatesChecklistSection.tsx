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
  groupTemplatesByFaseCategoria,
  reorderTemplates,
  toggleTemplateAtivo,
  updateTemplate,
  type TemplateChecklistInput,
} from '../../lib/templatesChecklist'
import { getActiveDisciplinaCodigos } from '../../lib/disciplinaConfig'
import type { Disciplina, Fase, TemplateChecklist } from '../../types'
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

export function TemplatesChecklistSection() {
  const { showToast } = useToast()
  const { getSequence, getLabel, loading: fasesLoading } = useFasesConfig()
  const [disciplina, setDisciplina] = useState<Disciplina>(
    () => getActiveDisciplinaCodigos()[0] ?? 'HID',
  )
  const [templates, setTemplates] = useState<TemplateChecklist[]>([])
  const [categoriaNomes, setCategoriaNomes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formContext, setFormContext] = useState<{
    fase: Fase | null
    categoria: string
    pickFase: boolean
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
      const [rows, names] = await Promise.all([
        fetchAllTemplates(disciplina),
        fetchCategoriaNomes(disciplina),
      ])
      setTemplates(rows)
      setCategoriaNomes(names)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar templates')
    } finally {
      setLoading(false)
    }
  }, [disciplina])

  useEffect(() => {
    void load()
  }, [load])

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

  function catKey(fase: Fase, categoria: string) {
    return `${fase}::${categoria}`
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
    setFormContext({ fase, categoria, pickFase: false })
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
    })
    setEditingTemplate(null)
    setFormError(null)
    setFormInitialOrdem(1)
    setFormOpen(true)
  }

  function openEdit(template: TemplateChecklist) {
    setFormMode('edit')
    setFormContext({ fase: template.fase, categoria: template.categoria, pickFase: false })
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
      } else if (editingTemplate) {
        await updateTemplate(editingTemplate.id, values)
      }
      setFormOpen(false)
      await Promise.all([refetchTemplates(), refetchCategorias()])
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
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
      await Promise.all([refetchTemplates(), refetchCategorias()])
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
            Alterações nos templates não afetam projetos em andamento.
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
      ) : null}

      <TemplateFormModal
        open={formOpen}
        mode={formMode}
        loading={saving}
        error={formError}
        categoriaLabel={formContext?.categoria ?? null}
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
                  const catTemplates = templates.filter(
                    (t) => t.fase === fase && t.categoria === formContext.categoria,
                  )
                  const maxOrdem = catTemplates.reduce((m, t) => Math.max(m, t.ordem), 0)
                  setFormInitialOrdem(maxOrdem + 1)
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
