import { useEffect, useMemo, useState } from 'react'
import { getDisciplinaLabel } from '../../lib/disciplinaConfig'
import { getFaseIndex } from '../../lib/constants'
import { getFasesComChecklist, getPhaseLabel, getPhaseSequence } from '../../lib/faseConfig'
import { fetchActiveTemplates, templateAppliesToMetodologia } from '../../lib/projects'
import type { ModoCriacao } from '../../types'
import type { ChecklistSelectionState, ProjectFormData } from '../../types/project-create'
import type { Disciplina, Fase, TemplateChecklist } from '../../types'
import { disciplinaTabClass } from '../ui/DisciplinaTabs'
import './StepChecklistSelect.css'

type GroupedTemplates = Record<
  Disciplina,
  Record<Fase, Record<string, TemplateChecklist[]>>
>

function filterTemplatesForForm(
  templates: TemplateChecklist[],
  form: ProjectFormData,
): TemplateChecklist[] {
  return templates.filter((t) => {
    if (!form.disciplinas.includes(t.disciplina)) return false
    if (!getFasesComChecklist(t.disciplina).includes(t.fase as Fase)) return false
    const met = form.metodologia[t.disciplina] ?? '2D'
    return templateAppliesToMetodologia(t, met)
  })
}

function groupTemplates(templates: TemplateChecklist[]): GroupedTemplates {
  const grouped = {} as GroupedTemplates

  for (const template of templates) {
    if (!grouped[template.disciplina]) {
      grouped[template.disciplina] = {} as Record<Fase, Record<string, TemplateChecklist[]>>
    }
    const fase = template.fase as Fase
    if (!grouped[template.disciplina][fase]) {
      grouped[template.disciplina][fase] = {}
    }
    if (!grouped[template.disciplina][fase][template.categoria]) {
      grouped[template.disciplina][fase][template.categoria] = []
    }
    grouped[template.disciplina][fase][template.categoria].push(template)
  }

  return grouped
}

function isVisibleInEmAndamento(
  template: TemplateChecklist,
  faseEntrada: Fase,
): boolean {
  return getFaseIndex(template.disciplina, template.fase as Fase) >= getFaseIndex(template.disciplina, faseEntrada)
}

function buildDefaultEmAndamentoSelection(
  templates: TemplateChecklist[],
  form: ProjectFormData,
  faseEntrada: Partial<Record<Disciplina, Fase>>,
): Set<string> {
  const ids = new Set<string>()
  const filtered = filterTemplatesForForm(templates, form)

  for (const template of filtered) {
    const entrada = faseEntrada[template.disciplina] ?? 'INFO_GERAL'
    if (isVisibleInEmAndamento(template, entrada)) {
      ids.add(template.id)
    }
  }

  return ids
}

export function validateChecklistStep(
  modo: ModoCriacao,
  checklist: ChecklistSelectionState,
  templates: TemplateChecklist[],
  form: ProjectFormData,
): string | null {
  const filtered = filterTemplatesForForm(templates, form)

  if (modo === 'novo') {
    const enabled = filtered.filter((t) => !checklist.disabledTemplateIds.has(t.id))
    if (enabled.length === 0) {
      return 'Selecione ao menos uma tarefa do checklist.'
    }
    return null
  }

  if (modo === 'em_andamento') {
    for (const disciplina of form.disciplinas) {
      if (!checklist.faseEntrada[disciplina]) {
        return `Defina a fase de entrada para ${getDisciplinaLabel(disciplina)}.`
      }
    }
    const selected = filtered.filter((t) => checklist.selectedTemplateIds.has(t.id))
    if (selected.length === 0) {
      return 'Selecione ao menos uma tarefa para importar.'
    }
  }

  return null
}

export function countTasksToCreate(
  modo: ModoCriacao,
  checklist: ChecklistSelectionState,
  templates: TemplateChecklist[],
  form: ProjectFormData,
): number {
  const filtered = filterTemplatesForForm(templates, form)

  if (modo === 'novo') {
    return filtered.filter((t) => !checklist.disabledTemplateIds.has(t.id)).length
  }

  return filtered.filter((t) => checklist.selectedTemplateIds.has(t.id)).length
}

interface StepChecklistSelectProps {
  modo: ModoCriacao
  form: ProjectFormData
  checklist: ChecklistSelectionState
  onChange: (checklist: ChecklistSelectionState) => void
  error?: string | null
}

export function StepChecklistSelect({
  modo,
  form,
  checklist,
  onChange,
  error,
}: StepChecklistSelectProps) {
  const [templates, setTemplates] = useState<TemplateChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await fetchActiveTemplates(form.disciplinas)
        if (!mounted) return
        setTemplates(data)

        if (modo === 'em_andamento' && checklist.selectedTemplateIds.size === 0) {
          const faseEntrada: Partial<Record<Disciplina, Fase>> = { ...checklist.faseEntrada }
          for (const d of form.disciplinas) {
            if (!faseEntrada[d]) faseEntrada[d] = 'INFO_GERAL'
          }
          onChange({
            ...checklist,
            faseEntrada,
            selectedTemplateIds: buildDefaultEmAndamentoSelection(data, form, faseEntrada),
          })
        }
      } catch (err) {
        if (!mounted) return
        setLoadError(err instanceof Error ? err.message : 'Erro ao carregar templates.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init selection once on mount
  }, [form.disciplinas.join(','), modo])

  const filtered = useMemo(
    () => filterTemplatesForForm(templates, form),
    [templates, form],
  )

  const grouped = useMemo(() => groupTemplates(filtered), [filtered])

  const taskCount = countTasksToCreate(modo, checklist, templates, form)

  function isTaskEnabled(template: TemplateChecklist): boolean {
    if (modo === 'novo') {
      return !checklist.disabledTemplateIds.has(template.id)
    }
    return checklist.selectedTemplateIds.has(template.id)
  }

  function setTaskEnabled(template: TemplateChecklist, enabled: boolean) {
    if (modo === 'novo') {
      const disabledTemplateIds = new Set(checklist.disabledTemplateIds)
      if (enabled) {
        disabledTemplateIds.delete(template.id)
      } else {
        disabledTemplateIds.add(template.id)
      }
      onChange({ ...checklist, disabledTemplateIds })
      return
    }

    const selectedTemplateIds = new Set(checklist.selectedTemplateIds)
    if (enabled) {
      selectedTemplateIds.add(template.id)
    } else {
      selectedTemplateIds.delete(template.id)
    }
    onChange({ ...checklist, selectedTemplateIds })
  }

  function setCategoryEnabled(templatesInCategory: TemplateChecklist[], enabled: boolean) {
    for (const template of templatesInCategory) {
      setTaskEnabled(template, enabled)
    }
  }

  function isCategoryFullyEnabled(templatesInCategory: TemplateChecklist[]): boolean {
    return templatesInCategory.every((t) => isTaskEnabled(t))
  }

  function handleFaseEntradaChange(disciplina: Disciplina, fase: Fase) {
    const faseEntrada = { ...checklist.faseEntrada, [disciplina]: fase }
    const selectedTemplateIds = buildDefaultEmAndamentoSelection(templates, form, faseEntrada)
    onChange({ ...checklist, faseEntrada, selectedTemplateIds })
  }

  function getSelectablePhases(disciplina: Disciplina): Fase[] {
    return getPhaseSequence(disciplina).filter((f) => getFasesComChecklist(disciplina).includes(f))
  }

  if (loading) {
    return <p className="step-checklist__status">Carregando templates do checklist…</p>
  }

  if (loadError) {
    return <p className="step-checklist__error">{loadError}</p>
  }

  if (filtered.length === 0) {
    return (
      <p className="step-checklist__status">
        Nenhum template encontrado para as disciplinas e metodologias selecionadas.
      </p>
    )
  }

  return (
    <div className="step-checklist">
      <p className="step-checklist__intro">
        {modo === 'novo'
          ? 'Todas as tarefas do template estão ativas por padrão. Desmarque categorias ou itens que não se aplicam a este projeto.'
          : 'Informe a fase de entrada de cada disciplina e selecione as tarefas que deseja importar.'}
      </p>

      {error ? (
        <p className="step-checklist__error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="step-checklist__summary">
        <strong>{taskCount}</strong>{' '}
        {taskCount === 1 ? 'tarefa será criada' : 'tarefas serão criadas'}
      </p>

      {form.disciplinas.map((disciplina) => {
        const discGroup = grouped[disciplina]
        if (!discGroup) return null

        const fasesOrdenadas = getPhaseSequence(disciplina).filter(
          (f) => discGroup[f as Fase],
        ) as Fase[]

        return (
          <section key={disciplina} className="step-checklist__disc">
            <header className="step-checklist__disc-header">
              <span className={`step-checklist__disc-badge ${disciplinaTabClass(disciplina, true)}`}>
                {getDisciplinaLabel(disciplina)}
              </span>
              {modo === 'em_andamento' ? (
                <label className="step-checklist__fase-entrada">
                  <span>Fase de entrada</span>
                  <select
                    value={checklist.faseEntrada[disciplina] ?? 'INFO_GERAL'}
                    onChange={(e) =>
                      handleFaseEntradaChange(disciplina, e.target.value as Fase)
                    }
                  >
                    {getSelectablePhases(disciplina).map((fase) => (
                      <option key={fase} value={fase}>
                        {getPhaseLabel(fase, disciplina)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </header>

            {fasesOrdenadas.map((fase) => {
              const categorias = discGroup[fase]
              if (!categorias) return null

              const faseEntrada = checklist.faseEntrada[disciplina] ?? 'INFO_GERAL'
              if (
                modo === 'em_andamento' &&
                getFaseIndex(disciplina, fase) < getFaseIndex(disciplina, faseEntrada)
              ) {
                return null
              }

              return (
                <div key={fase} className="step-checklist__fase">
                  <h3 className="step-checklist__fase-title">{getPhaseLabel(fase, disciplina)}</h3>

                  {Object.entries(categorias).map(([categoria, items]) => {
                    const sorted = [...items].sort((a, b) => a.ordem - b.ordem)
                    const categoryEnabled = isCategoryFullyEnabled(sorted)

                    return (
                      <div key={categoria} className="step-checklist__categoria">
                        <label className="step-checklist__categoria-head">
                          <input
                            type="checkbox"
                            checked={categoryEnabled}
                            onChange={(e) => setCategoryEnabled(sorted, e.target.checked)}
                          />
                          <span className="step-checklist__categoria-name">{categoria}</span>
                          <span className="step-checklist__categoria-count">
                            {sorted.filter((t) => isTaskEnabled(t)).length}/{sorted.length}
                          </span>
                        </label>

                        <ul className="step-checklist__tasks">
                          {sorted.map((template) => (
                            <li key={template.id}>
                              <label className="step-checklist__task">
                                <input
                                  type="checkbox"
                                  checked={isTaskEnabled(template)}
                                  onChange={(e) => setTaskEnabled(template, e.target.checked)}
                                />
                                <span className="step-checklist__task-body">
                                  <span className="step-checklist__task-name">{template.nome}</span>
                                  {template.criticidade === 'critico' ? (
                                    <span className="step-checklist__badge step-checklist__badge--critico">
                                      Crítico
                                    </span>
                                  ) : null}
                                  {template.origem !== 'interno' ? (
                                    <span className="step-checklist__badge">{template.origem}</span>
                                  ) : null}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
