import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
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
  return (
    getFaseIndex(template.disciplina, template.fase as Fase) >=
    getFaseIndex(template.disciplina, faseEntrada)
  )
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

function faseKey(disciplina: Disciplina, fase: Fase): string {
  return `${disciplina}|${fase}`
}

function catKey(disciplina: Disciplina, fase: Fase, categoria: string): string {
  return `${disciplina}|${fase}|${categoria}`
}

export function validateChecklistStep(
  modo: ModoCriacao,
  checklist: ChecklistSelectionState,
  templates: TemplateChecklist[],
  form: ProjectFormData,
): string | null {
  if (modo === 'novo') {
    // 0 tarefas do template é válido (projeto sem checklist padrão)
    return null
  }

  if (modo === 'em_andamento') {
    const filtered = filterTemplatesForForm(templates, form)
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
  const filtered = filterTemplatesForForm(templates, form).filter(
    (t) => !checklist.disabledFaseKeys.has(faseKey(t.disciplina, t.fase as Fase)),
  )

  if (modo === 'novo') {
    return filtered.filter((t) => !checklist.disabledTemplateIds.has(t.id)).length
  }

  return filtered.filter((t) => checklist.selectedTemplateIds.has(t.id)).length
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: (checked: boolean) => void
  'aria-label': string
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
    />
  )
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
  const [faseToggleWarning, setFaseToggleWarning] = useState<string | null>(null)
  /** true = recolhida; ausente = recolhida por padrão; false = expandida */
  const [faseCollapsed, setFaseCollapsed] = useState<Record<string, boolean>>({})
  /** true = recolhida; ausente = recolhida por padrão; false = expandida */
  const [catCollapsed, setCatCollapsed] = useState<Record<string, boolean>>({})

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

  const visible = useMemo(() => {
    if (modo !== 'em_andamento') return filtered
    return filtered.filter((t) => {
      const entrada = checklist.faseEntrada[t.disciplina] ?? 'INFO_GERAL'
      return isVisibleInEmAndamento(t, entrada)
    })
  }, [filtered, modo, checklist.faseEntrada])

  const grouped = useMemo(() => groupTemplates(filtered), [filtered])

  const taskCount = countTasksToCreate(modo, checklist, templates, form)
  const disabledFaseCount = checklist.disabledFaseKeys.size

  function isFaseIncluded(disciplina: Disciplina, fase: Fase): boolean {
    return !checklist.disabledFaseKeys.has(faseKey(disciplina, fase))
  }

  function isTaskEnabled(template: TemplateChecklist): boolean {
    if (!isFaseIncluded(template.disciplina, template.fase as Fase)) return false
    if (modo === 'novo') {
      return !checklist.disabledTemplateIds.has(template.id)
    }
    return checklist.selectedTemplateIds.has(template.id)
  }

  function setTasksEnabled(items: TemplateChecklist[], enabled: boolean) {
    if (items.length === 0) return

    if (modo === 'novo') {
      const disabledTemplateIds = new Set(checklist.disabledTemplateIds)
      for (const template of items) {
        if (enabled) disabledTemplateIds.delete(template.id)
        else disabledTemplateIds.add(template.id)
      }
      onChange({ ...checklist, disabledTemplateIds })
      return
    }

    const selectedTemplateIds = new Set(checklist.selectedTemplateIds)
    for (const template of items) {
      if (enabled) selectedTemplateIds.add(template.id)
      else selectedTemplateIds.delete(template.id)
    }
    onChange({ ...checklist, selectedTemplateIds })
  }

  function setTaskEnabled(template: TemplateChecklist, enabled: boolean) {
    if (!isFaseIncluded(template.disciplina, template.fase as Fase)) return
    setTasksEnabled([template], enabled)
  }

  function setCategoryEnabled(templatesInCategory: TemplateChecklist[], enabled: boolean) {
    setTasksEnabled(templatesInCategory, enabled)
  }

  function getVisibleFasesForDisciplina(
    disciplina: Disciplina,
    fasesOrdenadas: Fase[],
  ): Fase[] {
    if (modo !== 'em_andamento') return fasesOrdenadas
    const entrada = checklist.faseEntrada[disciplina] ?? 'INFO_GERAL'
    return fasesOrdenadas.filter(
      (fase) => getFaseIndex(disciplina, fase) >= getFaseIndex(disciplina, entrada),
    )
  }

  function setFaseIncluded(disciplina: Disciplina, fase: Fase, included: boolean) {
    const key = faseKey(disciplina, fase)
    const discGroup = grouped[disciplina]
    const categorias = discGroup?.[fase]
    const faseItems = categorias ? Object.values(categorias).flat() : []

    if (!included) {
      if (modo === 'em_andamento' && (checklist.faseEntrada[disciplina] ?? 'INFO_GERAL') === fase) {
        setFaseToggleWarning(
          'Não é possível desligar a fase de entrada. Altere a fase de entrada antes.',
        )
        return
      }

      const fasesOrdenadas = getPhaseSequence(disciplina).filter(
        (f) => discGroup?.[f as Fase],
      ) as Fase[]
      const visible = getVisibleFasesForDisciplina(disciplina, fasesOrdenadas)
      const remaining = visible.filter(
        (f) => f !== fase && !checklist.disabledFaseKeys.has(faseKey(disciplina, f)),
      )
      if (remaining.length === 0) {
        setFaseToggleWarning(
          `Mantenha ao menos uma fase ativa em ${getDisciplinaLabel(disciplina)}.`,
        )
        return
      }

      setFaseToggleWarning(null)

      const stashIds = faseItems.filter((t) => {
        if (modo === 'novo') return !checklist.disabledTemplateIds.has(t.id)
        return checklist.selectedTemplateIds.has(t.id)
      }).map((t) => t.id)

      const disabledFaseKeys = new Set(checklist.disabledFaseKeys)
      disabledFaseKeys.add(key)
      const faseSelectionStash = { ...checklist.faseSelectionStash, [key]: stashIds }

      if (modo === 'novo') {
        const disabledTemplateIds = new Set(checklist.disabledTemplateIds)
        for (const template of faseItems) disabledTemplateIds.add(template.id)
        onChange({ ...checklist, disabledFaseKeys, faseSelectionStash, disabledTemplateIds })
        return
      }

      const selectedTemplateIds = new Set(checklist.selectedTemplateIds)
      for (const template of faseItems) selectedTemplateIds.delete(template.id)
      onChange({ ...checklist, disabledFaseKeys, faseSelectionStash, selectedTemplateIds })
      return
    }

    setFaseToggleWarning(null)
    const disabledFaseKeys = new Set(checklist.disabledFaseKeys)
    disabledFaseKeys.delete(key)
    const stashed = checklist.faseSelectionStash[key]
    const restoreIds = stashed
      ? new Set(stashed)
      : new Set(faseItems.map((t) => t.id))

    if (modo === 'novo') {
      const disabledTemplateIds = new Set(checklist.disabledTemplateIds)
      for (const template of faseItems) {
        if (restoreIds.has(template.id)) disabledTemplateIds.delete(template.id)
        else disabledTemplateIds.add(template.id)
      }
      onChange({ ...checklist, disabledFaseKeys, disabledTemplateIds })
      return
    }

    const selectedTemplateIds = new Set(checklist.selectedTemplateIds)
    for (const template of faseItems) {
      if (restoreIds.has(template.id)) selectedTemplateIds.add(template.id)
      else selectedTemplateIds.delete(template.id)
    }
    onChange({ ...checklist, disabledFaseKeys, selectedTemplateIds })
  }

  function isCategoryFullyEnabled(items: TemplateChecklist[]): boolean {
    return items.length > 0 && items.every((t) => isTaskEnabled(t))
  }

  function isCategoryPartiallyEnabled(items: TemplateChecklist[]): boolean {
    const n = items.filter((t) => isTaskEnabled(t)).length
    return n > 0 && n < items.length
  }

  function markAllVisible(enabled: boolean) {
    const actionable = visible.filter((t) =>
      isFaseIncluded(t.disciplina, t.fase as Fase),
    )
    setTasksEnabled(actionable, enabled)
  }

  function handleFaseEntradaChange(disciplina: Disciplina, fase: Fase) {
    const faseEntrada = { ...checklist.faseEntrada, [disciplina]: fase }
    const selectedTemplateIds = buildDefaultEmAndamentoSelection(templates, form, faseEntrada)
    onChange({ ...checklist, faseEntrada, selectedTemplateIds })
  }

  function getSelectablePhases(disciplina: Disciplina): Fase[] {
    return getPhaseSequence(disciplina).filter((f) => getFasesComChecklist(disciplina).includes(f))
  }

  function isFaseCollapsed(disciplina: Disciplina, fase: Fase): boolean {
    return faseCollapsed[faseKey(disciplina, fase)] !== false
  }

  function isCatCollapsed(disciplina: Disciplina, fase: Fase, categoria: string): boolean {
    return catCollapsed[catKey(disciplina, fase, categoria)] !== false
  }

  function toggleFase(disciplina: Disciplina, fase: Fase) {
    const key = faseKey(disciplina, fase)
    const currentlyCollapsed = faseCollapsed[key] !== false
    setFaseCollapsed((prev) => ({ ...prev, [key]: !currentlyCollapsed }))
  }

  function toggleCat(disciplina: Disciplina, fase: Fase, categoria: string) {
    const key = catKey(disciplina, fase, categoria)
    const currentlyCollapsed = catCollapsed[key] !== false
    setCatCollapsed((prev) => ({ ...prev, [key]: !currentlyCollapsed }))
  }

  function collectCollapseKeys(): { fases: string[]; cats: string[] } {
    const fases: string[] = []
    const cats: string[] = []
    for (const disciplina of form.disciplinas) {
      const discGroup = grouped[disciplina]
      if (!discGroup) continue
      const fasesOrdenadas = getPhaseSequence(disciplina).filter(
        (f) => discGroup[f as Fase],
      ) as Fase[]
      for (const fase of fasesOrdenadas) {
        if (
          modo === 'em_andamento' &&
          getFaseIndex(disciplina, fase) <
            getFaseIndex(disciplina, checklist.faseEntrada[disciplina] ?? 'INFO_GERAL')
        ) {
          continue
        }
        fases.push(faseKey(disciplina, fase))
        const categorias = discGroup[fase]
        if (!categorias) continue
        for (const categoria of Object.keys(categorias)) {
          cats.push(catKey(disciplina, fase, categoria))
        }
      }
    }
    return { fases, cats }
  }

  function expandAll() {
    const { fases, cats } = collectCollapseKeys()
    setFaseCollapsed((prev) => {
      const next = { ...prev }
      for (const k of fases) next[k] = false
      return next
    })
    setCatCollapsed((prev) => {
      const next = { ...prev }
      for (const k of cats) next[k] = false
      return next
    })
  }

  function collapseAll() {
    const { fases, cats } = collectCollapseKeys()
    setFaseCollapsed((prev) => {
      const next = { ...prev }
      for (const k of fases) next[k] = true
      return next
    })
    setCatCollapsed((prev) => {
      const next = { ...prev }
      for (const k of cats) next[k] = true
      return next
    })
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
          ? 'O que estiver marcado será criado no projeto. Desmarque tarefas ou desligue fases inteiras que não se aplicam.'
          : 'Informe a fase de entrada de cada disciplina e selecione as tarefas a importar. Fases desligadas não serão criadas no projeto.'}
      </p>

      {error ? (
        <p className="step-checklist__error" role="alert">
          {error}
        </p>
      ) : null}

      {faseToggleWarning ? (
        <p className="step-checklist__error" role="alert">
          {faseToggleWarning}
        </p>
      ) : null}

      <div
        className={`step-checklist__toolbar${taskCount === 0 ? ' step-checklist__toolbar--empty' : ''}`}
      >
        <div className="step-checklist__toolbar-summary">
          {taskCount === 0 ? (
            <>
              <strong>Nenhuma tarefa</strong>
              <span> do template será criada</span>
            </>
          ) : (
            <>
              <strong>{taskCount}</strong>
              <span>
                {' '}
                {taskCount === 1 ? 'tarefa será criada' : 'tarefas serão criadas'}
              </span>
            </>
          )}
          {disabledFaseCount > 0 ? (
            <span className="step-checklist__toolbar-fases-off">
              {' '}
              · {disabledFaseCount}{' '}
              {disabledFaseCount === 1 ? 'fase fora do projeto' : 'fases fora do projeto'}
            </span>
          ) : null}
        </div>
        <div className="step-checklist__toolbar-actions">
          <button type="button" className="step-checklist__tool-btn" onClick={() => markAllVisible(true)}>
            Marcar todas
          </button>
          <button type="button" className="step-checklist__tool-btn" onClick={() => markAllVisible(false)}>
            Desmarcar todas
          </button>
          <span className="step-checklist__tool-sep" aria-hidden />
          <button type="button" className="step-checklist__tool-btn" onClick={expandAll}>
            Expandir tudo
          </button>
          <button type="button" className="step-checklist__tool-btn" onClick={collapseAll}>
            Recolher tudo
          </button>
        </div>
      </div>

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

              const faseItems = Object.values(categorias).flat()
              const faseIncluded = isFaseIncluded(disciplina, fase)
              const faseSelected = faseItems.filter((t) => isTaskEnabled(t)).length
              const faseCollapsedNow = isFaseCollapsed(disciplina, fase)
              const isEntrada =
                modo === 'em_andamento' &&
                (checklist.faseEntrada[disciplina] ?? 'INFO_GERAL') === fase

              return (
                <div
                  key={fase}
                  className={`step-checklist__fase${faseCollapsedNow ? ' step-checklist__fase--collapsed' : ''}${!faseIncluded ? ' step-checklist__fase--off' : ''}`}
                >
                  <div className="step-checklist__fase-head">
                    <button
                      type="button"
                      className="step-checklist__fase-toggle"
                      aria-expanded={!faseCollapsedNow}
                      onClick={() => toggleFase(disciplina, fase)}
                    >
                      <span className="step-checklist__chevron" aria-hidden>
                        {faseCollapsedNow ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </span>
                      <h3 className="step-checklist__fase-title">
                        {getPhaseLabel(fase, disciplina)}
                      </h3>
                      <span className="step-checklist__fase-count">
                        {faseIncluded ? `${faseSelected}/${faseItems.length}` : '—'}
                      </span>
                    </button>
                    <label
                      className={`step-checklist__fase-include${isEntrada ? ' step-checklist__fase-include--locked' : ''}`}
                      title={
                        isEntrada
                          ? 'Fase de entrada — não pode ser desligada'
                          : undefined
                      }
                    >
                      <input
                        type="checkbox"
                        checked={faseIncluded}
                        disabled={isEntrada}
                        onChange={(e) =>
                          setFaseIncluded(disciplina, fase, e.target.checked)
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span>Incluir fase</span>
                    </label>
                    {!faseIncluded ? (
                      <span className="step-checklist__fase-off-label">
                        Esta fase não será criada neste projeto
                      </span>
                    ) : (
                      <div className="step-checklist__fase-actions">
                        <button
                          type="button"
                          className="step-checklist__text-action"
                          onClick={() => setTasksEnabled(faseItems, true)}
                        >
                          Marcar
                        </button>
                        <button
                          type="button"
                          className="step-checklist__text-action"
                          onClick={() => setTasksEnabled(faseItems, false)}
                        >
                          Desmarcar
                        </button>
                      </div>
                    )}
                  </div>

                  {!faseCollapsedNow && faseIncluded
                    ? Object.entries(categorias).map(([categoria, items]) => {
                        const sorted = [...items].sort((a, b) => a.ordem - b.ordem)
                        const enabledCount = sorted.filter((t) => isTaskEnabled(t)).length
                        const fully = isCategoryFullyEnabled(sorted)
                        const partial = isCategoryPartiallyEnabled(sorted)
                        const catCollapsedNow = isCatCollapsed(disciplina, fase, categoria)

                        return (
                          <div
                            key={categoria}
                            className={`step-checklist__categoria${catCollapsedNow ? ' step-checklist__categoria--collapsed' : ''}`}
                          >
                            <div className="step-checklist__categoria-head">
                              <button
                                type="button"
                                className="step-checklist__cat-toggle"
                                aria-expanded={!catCollapsedNow}
                                aria-label={`${catCollapsedNow ? 'Expandir' : 'Recolher'} ${categoria}`}
                                onClick={() => toggleCat(disciplina, fase, categoria)}
                              >
                                <span className="step-checklist__chevron" aria-hidden>
                                  {catCollapsedNow ? (
                                    <ChevronRight size={15} />
                                  ) : (
                                    <ChevronDown size={15} />
                                  )}
                                </span>
                              </button>
                              <IndeterminateCheckbox
                                checked={fully}
                                indeterminate={partial}
                                aria-label={`Selecionar categoria ${categoria}`}
                                onChange={(checked) => setCategoryEnabled(sorted, checked)}
                              />
                              <button
                                type="button"
                                className="step-checklist__categoria-name-btn"
                                onClick={() => toggleCat(disciplina, fase, categoria)}
                              >
                                <span className="step-checklist__categoria-name">{categoria}</span>
                              </button>
                              <span className="step-checklist__categoria-count">
                                {enabledCount}/{sorted.length}
                              </span>
                            </div>

                            {!catCollapsedNow ? (
                              <ul className="step-checklist__tasks">
                                {sorted.map((template) => (
                                  <li key={template.id}>
                                    <label className="step-checklist__task">
                                      <input
                                        type="checkbox"
                                        checked={isTaskEnabled(template)}
                                        onChange={(e) =>
                                          setTaskEnabled(template, e.target.checked)
                                        }
                                      />
                                      <span className="step-checklist__task-body">
                                        <span className="step-checklist__task-name">
                                          {template.nome}
                                        </span>
                                        {template.criticidade === 'critico' ? (
                                          <span className="step-checklist__badge step-checklist__badge--critico">
                                            Crítico
                                          </span>
                                        ) : null}
                                        {template.origem !== 'interno' ? (
                                          <span
                                            className={`step-checklist__badge step-checklist__badge--origem-${template.origem.toLowerCase()}`}
                                          >
                                            {template.origem}
                                          </span>
                                        ) : null}
                                      </span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        )
                      })
                    : null}
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
