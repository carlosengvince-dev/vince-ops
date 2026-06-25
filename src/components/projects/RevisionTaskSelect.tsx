import { useEffect, useMemo, useState } from 'react'
import {
  DISCIPLINA_LABELS,
  FASES_COM_CHECKLIST,
  PHASE_LABELS,
  PHASE_SEQUENCES,
} from '../../lib/constants'
import { fetchActiveTemplates, templateAppliesToMetodologia } from '../../lib/projects'
import { discToneClasses } from '../../lib/disciplinaTokens'
import type { CustomRevisionTask } from '../../lib/revisoes'
import type { Disciplina, Fase, Metodologia, TemplateChecklist } from '../../types'
import './StepChecklistSelect.css'
import './RevisionTaskSelect.css'

interface RevisionTaskSelectProps {
  disciplina: Disciplina
  metodologia: Metodologia
  defaultFase: Fase
  selectedTemplateIds: Set<string>
  customTasks: CustomRevisionTask[]
  onSelectedTemplateIdsChange: (ids: Set<string>) => void
  onCustomTasksChange: (tasks: CustomRevisionTask[]) => void
}

export function RevisionTaskSelect({
  disciplina,
  metodologia,
  defaultFase,
  selectedTemplateIds,
  customTasks,
  onSelectedTemplateIdsChange,
  onCustomTasksChange,
}: RevisionTaskSelectProps) {
  const [templates, setTemplates] = useState<TemplateChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [customNome, setCustomNome] = useState('')

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await fetchActiveTemplates([disciplina])
        if (!mounted) return
        setTemplates(data)
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
  }, [disciplina])

  const filtered = useMemo(
    () =>
      templates.filter(
        (t) =>
          t.disciplina === disciplina &&
          FASES_COM_CHECKLIST.includes(t.fase as Fase) &&
          templateAppliesToMetodologia(t, metodologia),
      ),
    [templates, disciplina, metodologia],
  )

  const grouped = useMemo(() => {
    const map = new Map<Fase, Map<string, TemplateChecklist[]>>()
    for (const template of filtered) {
      const fase = template.fase as Fase
      if (!map.has(fase)) map.set(fase, new Map())
      const catMap = map.get(fase)!
      if (!catMap.has(template.categoria)) catMap.set(template.categoria, [])
      catMap.get(template.categoria)!.push(template)
    }
    return map
  }, [filtered])

  const taskCount = selectedTemplateIds.size + customTasks.length

  function isTaskEnabled(template: TemplateChecklist): boolean {
    return selectedTemplateIds.has(template.id)
  }

  function setTaskEnabled(template: TemplateChecklist, enabled: boolean) {
    const next = new Set(selectedTemplateIds)
    if (enabled) next.add(template.id)
    else next.delete(template.id)
    onSelectedTemplateIdsChange(next)
  }

  function setCategoryEnabled(items: TemplateChecklist[], enabled: boolean) {
    const next = new Set(selectedTemplateIds)
    for (const template of items) {
      if (enabled) next.add(template.id)
      else next.delete(template.id)
    }
    onSelectedTemplateIdsChange(next)
  }

  function isCategoryFullyEnabled(items: TemplateChecklist[]): boolean {
    return items.every((t) => isTaskEnabled(t))
  }

  function addCustomTask() {
    const nome = customNome.trim()
    if (!nome) return
    onCustomTasksChange([
      ...customTasks,
      { nome, fase: defaultFase, categoria: 'Personalizada' },
    ])
    setCustomNome('')
  }

  function removeCustomTask(index: number) {
    onCustomTasksChange(customTasks.filter((_, i) => i !== index))
  }

  if (loading) {
    return <p className="step-checklist__status">Carregando templates do checklist…</p>
  }

  if (loadError) {
    return <p className="step-checklist__error">{loadError}</p>
  }

  const fasesOrdenadas = PHASE_SEQUENCES[disciplina].filter((f) => grouped.has(f)) as Fase[]

  return (
    <div className="revision-task-select">
      <p className="step-checklist__summary">
        <strong>{taskCount}</strong>{' '}
        {taskCount === 1
          ? 'tarefa será criada nesta revisão'
          : 'tarefas serão criadas nesta revisão'}
      </p>

      <section className="step-checklist__disc">
        <header className="step-checklist__disc-header">
          <span
            className={`step-checklist__disc-badge ${discToneClasses(disciplina)}`}
          >
            {DISCIPLINA_LABELS[disciplina]}
          </span>
        </header>

        {fasesOrdenadas.length === 0 ? (
          <p className="step-checklist__status">Nenhum template disponível para esta disciplina.</p>
        ) : (
          fasesOrdenadas.map((fase) => {
            const categorias = grouped.get(fase)
            if (!categorias) return null

            return (
              <div key={fase} className="step-checklist__fase">
                <h3 className="step-checklist__fase-title">{PHASE_LABELS[fase]}</h3>

                {Array.from(categorias.entries()).map(([categoria, items]) => {
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
          })
        )}
      </section>

      <div className="revision-task-select__custom">
        <h4 className="revision-task-select__custom-title">Criar tarefa personalizada</h4>
        <div className="revision-task-select__custom-row">
          <input
            type="text"
            className="revision-task-select__custom-input"
            placeholder="Nome da tarefa"
            value={customNome}
            onChange={(e) => setCustomNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustomTask()
              }
            }}
          />
          <button type="button" className="revision-task-select__custom-add" onClick={addCustomTask}>
            Adicionar
          </button>
        </div>
        {customTasks.length > 0 ? (
          <ul className="revision-task-select__custom-list">
            {customTasks.map((task, index) => (
              <li key={`${task.nome}-${index}`}>
                <span>{task.nome}</span>
                <button
                  type="button"
                  className="revision-task-select__custom-remove"
                  onClick={() => removeCustomTask(index)}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
