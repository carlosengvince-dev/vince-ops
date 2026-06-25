import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { PHASE_LABELS, PHASE_SEQUENCES } from '../../lib/constants'
import { fetchPhaseLabels, resolvePhaseLabel } from '../../lib/phaseConfig'
import {
  createTemplate,
  deleteTemplate,
  fetchAllTemplates,
  groupTemplatesByFaseCategoria,
  reorderTemplates,
  toggleTemplateAtivo,
  updateTemplate,
  type TemplateChecklistInput,
} from '../../lib/templatesChecklist'
import type { Disciplina, Fase, TemplateChecklist } from '../../types'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { DisciplinaTabs } from '../ui/DisciplinaTabs'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { SortableTemplateList } from './SortableTemplateList'
import { TemplateFormModal, type TemplateFormValues } from './TemplateFormModal'
import './TemplatesChecklistSection.css'
import './SettingsSubsection.css'

export function TemplatesChecklistSection() {
  const [disciplina, setDisciplina] = useState<Disciplina>('HID')
  const [templates, setTemplates] = useState<TemplateChecklist[]>([])
  const [phaseLabels, setPhaseLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formContext, setFormContext] = useState<{ fase: Fase; categoria: string } | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<TemplateChecklist | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [novaCategoriaOpen, setNovaCategoriaOpen] = useState(false)
  const [novaCategoriaFase, setNovaCategoriaFase] = useState<Fase | null>(null)
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<TemplateChecklist | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refetchTemplates = useCallback(async () => {
    const rows = await fetchAllTemplates(disciplina)
    setTemplates(rows)
  }, [disciplina])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, labels] = await Promise.all([
        fetchAllTemplates(disciplina),
        fetchPhaseLabels(),
      ])
      setTemplates(rows)
      setPhaseLabels(labels)
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

  const faseOrder = PHASE_SEQUENCES[disciplina]

  const groupedByFase = useMemo(() => {
    const map = new Map(grouped.map((g) => [g.fase, g]))
    return faseOrder.map((fase) => ({
      fase,
      label: resolvePhaseLabel(fase, phaseLabels),
      categorias: map.get(fase)?.categorias ?? [],
    }))
  }, [grouped, faseOrder, phaseLabels])

  function catKey(fase: Fase, categoria: string) {
    return `${fase}::${categoria}`
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

  const [formInitialOrdem, setFormInitialOrdem] = useState(1)

  function openCreate(fase: Fase, categoria: string) {
    setFormMode('create')
    setFormContext({ fase, categoria })
    setEditingTemplate(null)
    setFormError(null)
    const catTemplates = templates.filter((t) => t.fase === fase && t.categoria === categoria)
    const maxOrdem = catTemplates.reduce((m, t) => Math.max(m, t.ordem), 0)
    setFormInitialOrdem(maxOrdem + 1)
    setFormOpen(true)
  }

  function openEdit(template: TemplateChecklist) {
    setFormMode('edit')
    setFormContext({ fase: template.fase, categoria: template.categoria })
    setEditingTemplate(template)
    setFormError(null)
    setFormOpen(true)
  }

  async function handleFormSubmit(values: TemplateFormValues) {
    if (!formContext) return
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
      await refetchTemplates()
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
      await refetchTemplates()
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
    if (!nome || !novaCategoriaFase) return
    setNovaCategoriaOpen(false)
    setExpandedCats((prev) => new Set(prev).add(catKey(novaCategoriaFase, nome)))
    openCreate(novaCategoriaFase, nome)
    setNovaCategoriaNome('')
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
      </header>

      <DisciplinaTabs
        className="templates-checklist__tabs"
        value={disciplina}
        onChange={setDisciplina}
      />

      {error ? <p className="settings-subsection__error">{error}</p> : null}
      {loading ? <p className="settings-subsection__status">Carregando…</p> : null}

      {!loading ? (
        <div className="templates-checklist__phases">
          {groupedByFase.map(({ fase, label, categorias }) => (
            <div key={fase} className="templates-checklist__phase">
              <h3 className="templates-checklist__phase-title">
                {label}
                <span className="templates-checklist__phase-code">{PHASE_LABELS[fase] !== label ? fase : ''}</span>
              </h3>

              {categorias.length === 0 ? (
                <p className="templates-checklist__empty-cat">Nenhuma categoria nesta fase.</p>
              ) : (
                categorias.map(({ categoria, templates: catTemplates }) => {
                  const key = catKey(fase, categoria)
                  const expanded = expandedCats.has(key)
                  return (
                    <div key={key} className="templates-checklist__category">
                      <button
                        type="button"
                        className="templates-checklist__category-header"
                        onClick={() => toggleCat(fase, categoria)}
                      >
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span>{categoria}</span>
                        <span className="templates-checklist__cat-count">{catTemplates.length}</span>
                      </button>
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
                  setNovaCategoriaFase(fase)
                  setNovaCategoriaNome('')
                  setNovaCategoriaOpen(true)
                }}
              >
                <Plus size={14} />
                Nova categoria
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <TemplateFormModal
        open={formOpen}
        mode={formMode}
        loading={saving}
        error={formError}
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
        onClose={() => setNovaCategoriaOpen(false)}
      >
        <div className="templates-checklist__nova-cat">
          <Input
            label="Nome da categoria"
            value={novaCategoriaNome}
            onChange={(e) => setNovaCategoriaNome(e.target.value)}
          />
          <div className="templates-checklist__nova-cat-actions">
            <Button variant="secondary" onClick={() => setNovaCategoriaOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!novaCategoriaNome.trim()} onClick={handleNovaCategoria}>
              Criar
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
    </section>
  )
}
