import { useEffect, useMemo, useState } from 'react'
import {
  getFaseIndex,
} from '../../lib/constants'
import { getDisciplinaLabel } from '../../lib/disciplinaConfig'
import { getPhaseLabel, getPhaseSequence } from '../../lib/faseConfig'
import { discToneClasses, discToneStyle } from '../../lib/disciplinaTokens'
import {
  filterTemplatesForDisciplinaMetodologia,
  getSelectablePhases,
} from '../../lib/projetoDisciplinas'
import { fetchActiveTemplates } from '../../lib/projects'
import type { Disciplina, Fase, Metodologia, TemplateChecklist } from '../../types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import '../projects/StepChecklistSelect.css'
import './AddDisciplinaChecklistModal.css'

function groupByFaseCategoria(templates: TemplateChecklist[]) {
  const grouped: Record<Fase, Record<string, TemplateChecklist[]>> = {} as Record<
    Fase,
    Record<string, TemplateChecklist[]>
  >
  for (const template of templates) {
    const fase = template.fase as Fase
    if (!grouped[fase]) grouped[fase] = {}
    if (!grouped[fase][template.categoria]) grouped[fase][template.categoria] = []
    grouped[fase][template.categoria].push(template)
  }
  return grouped
}

function buildDefaultSelection(
  templates: TemplateChecklist[],
  disciplina: Disciplina,
  faseEntrada: Fase,
): Set<string> {
  const ids = new Set<string>()
  for (const template of templates) {
    if (getFaseIndex(disciplina, template.fase as Fase) >= getFaseIndex(disciplina, faseEntrada)) {
      ids.add(template.id)
    }
  }
  return ids
}

interface AddDisciplinaChecklistModalProps {
  open: boolean
  disciplina: Disciplina
  loading?: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (payload: { metodologia: Metodologia; selectedTemplateIds: Set<string> }) => void
}

const METODOLOGIAS: Metodologia[] = ['2D', '3D', 'BIM']

export function AddDisciplinaChecklistModal({
  open,
  disciplina,
  loading = false,
  error = null,
  onClose,
  onSubmit,
}: AddDisciplinaChecklistModalProps) {
  const [templates, setTemplates] = useState<TemplateChecklist[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [metodologia, setMetodologia] = useState<Metodologia>('2D')
  const [faseEntrada, setFaseEntrada] = useState<Fase>('INFO_GERAL')
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return

    let mounted = true
    setMetodologia('2D')
    setFaseEntrada('INFO_GERAL')
    setSelectedTemplateIds(new Set())
    setLoadingTemplates(true)
    setLoadError(null)

    void fetchActiveTemplates([disciplina])
      .then((data) => {
        if (!mounted) return
        setTemplates(data)
        const filtered = filterTemplatesForDisciplinaMetodologia(data, disciplina, '2D')
        setSelectedTemplateIds(buildDefaultSelection(filtered, disciplina, 'INFO_GERAL'))
      })
      .catch((err) => {
        if (!mounted) return
        setLoadError(err instanceof Error ? err.message : 'Erro ao carregar templates.')
      })
      .finally(() => {
        if (mounted) setLoadingTemplates(false)
      })

    return () => {
      mounted = false
    }
  }, [open, disciplina])

  const filtered = useMemo(
    () => filterTemplatesForDisciplinaMetodologia(templates, disciplina, metodologia),
    [templates, disciplina, metodologia],
  )

  const grouped = useMemo(() => groupByFaseCategoria(filtered), [filtered])

  const fasesOrdenadas = useMemo(
    () => getPhaseSequence(disciplina).filter((f) => grouped[f as Fase]) as Fase[],
    [disciplina, grouped],
  )

  const taskCount = filtered.filter((t) => selectedTemplateIds.has(t.id)).length

  function isTaskEnabled(template: TemplateChecklist): boolean {
    return selectedTemplateIds.has(template.id)
  }

  function setTaskEnabled(template: TemplateChecklist, enabled: boolean) {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev)
      if (enabled) next.add(template.id)
      else next.delete(template.id)
      return next
    })
  }

  function setCategoryEnabled(items: TemplateChecklist[], enabled: boolean) {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev)
      for (const template of items) {
        if (enabled) next.add(template.id)
        else next.delete(template.id)
      }
      return next
    })
  }

  function handleMetodologiaChange(next: Metodologia) {
    setMetodologia(next)
    const nextFiltered = filterTemplatesForDisciplinaMetodologia(templates, disciplina, next)
    setSelectedTemplateIds(buildDefaultSelection(nextFiltered, disciplina, faseEntrada))
  }

  function handleFaseEntradaChange(next: Fase) {
    setFaseEntrada(next)
    setSelectedTemplateIds(buildDefaultSelection(filtered, disciplina, next))
  }

  function handleSubmit() {
    if (taskCount === 0) return
    onSubmit({ metodologia, selectedTemplateIds })
  }

  return (
    <Modal
      open={open}
      title={`Importar tarefas — ${getDisciplinaLabel(disciplina)}`}
      onClose={() => {
        if (!loading) onClose()
      }}
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || taskCount === 0 || loadingTemplates}
          >
            {loading ? 'Adicionando…' : `Adicionar disciplina (${taskCount} tarefas)`}
          </Button>
        </>
      }
    >
      <div className="add-disc-checklist">
        <header className="add-disc-checklist__header">
          <span
            className={`step-checklist__disc-badge ${discToneClasses(disciplina)}`}
            style={discToneStyle(disciplina)}
          >
            {getDisciplinaLabel(disciplina)}
          </span>
          <label className="add-disc-checklist__field">
            <span>Metodologia</span>
            <select
              value={metodologia}
              disabled={loading}
              onChange={(e) => handleMetodologiaChange(e.target.value as Metodologia)}
            >
              {METODOLOGIAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="step-checklist__fase-entrada">
            <span>Fase de entrada</span>
            <select
              value={faseEntrada}
              disabled={loading}
              onChange={(e) => handleFaseEntradaChange(e.target.value as Fase)}
            >
              {getSelectablePhases(disciplina).map((fase) => (
                <option key={fase} value={fase}>
                  {getPhaseLabel(fase, disciplina)}
                </option>
              ))}
            </select>
          </label>
        </header>

        {error ? (
          <p className="step-checklist__error" role="alert">
            {error}
          </p>
        ) : null}

        {loadingTemplates ? (
          <p className="step-checklist__status">Carregando templates…</p>
        ) : loadError ? (
          <p className="step-checklist__error">{loadError}</p>
        ) : filtered.length === 0 ? (
          <p className="step-checklist__status">
            Nenhum template encontrado para esta disciplina e metodologia.
          </p>
        ) : (
          <>
            <p className="step-checklist__intro">
              Selecione as tarefas que deseja importar para o projeto.
            </p>
            <p className="step-checklist__summary">
              <strong>{taskCount}</strong>{' '}
              {taskCount === 1 ? 'tarefa será criada' : 'tarefas serão criadas'}
            </p>

            {fasesOrdenadas.map((fase) => {
              const categorias = grouped[fase]
              if (!categorias) return null
              if (getFaseIndex(disciplina, fase) < getFaseIndex(disciplina, faseEntrada)) {
                return null
              }

              return (
                <div key={fase} className="step-checklist__fase">
                  <h3 className="step-checklist__fase-title">{getPhaseLabel(fase, disciplina)}</h3>
                  {Object.entries(categorias).map(([categoria, items]) => {
                    const sorted = [...items].sort((a, b) => a.ordem - b.ordem)
                    const categoryEnabled = sorted.every((t) => isTaskEnabled(t))

                    return (
                      <div key={categoria} className="step-checklist__categoria">
                        <label className="step-checklist__categoria-head">
                          <input
                            type="checkbox"
                            checked={categoryEnabled}
                            disabled={loading}
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
                                  disabled={loading}
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
          </>
        )}
      </div>
    </Modal>
  )
}
