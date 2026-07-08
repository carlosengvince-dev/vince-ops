import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Disciplina, Fase, Metodologia, PendenciaExterna, Revisao, Tarefa } from '../../types'
import {
  createRevisao,
  REVISAO_ORIGENS,
  suggestNextRevisionNumero,
  type CustomRevisionTask,
  type RevisaoPrefill,
} from '../../lib/revisoes'
import {
  clearNovaRevisaoDraft,
  loadNovaRevisaoDraft,
} from '../../lib/modalNovaRevisaoStorage'
import {
  isNovaRevisaoDraftMeaningful,
  loadMeaningfulModalState,
} from '../../lib/modalDraftUtils'
import { useDebouncedModalPersistence } from '../../hooks/useDebouncedModalPersistence'
import { getDisciplinaLabel } from '../../lib/disciplinaConfig'
import { fetchActiveTemplates } from '../../lib/projects'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { disciplinaTabClass } from '../ui/DisciplinaTabs'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { RevisionTaskSelect } from './RevisionTaskSelect'
import './CreateRevisaoModal.css'

export interface CreateRevisaoFormData {
  numero: string
  origem: (typeof REVISAO_ORIGENS)[number]
  descricao: string
  pendenciaId: string
}

interface CreateRevisaoModalProps {
  open: boolean
  loading?: boolean
  error?: string | null
  projetoId: string
  disciplinaAtiva: Disciplina
  metodologia: Partial<Record<Disciplina, Metodologia>>
  defaultFase: Fase
  existingRevisoes: Revisao[]
  openPendencias: PendenciaExterna[]
  prefill?: RevisaoPrefill | null
  usuarioId: string
  onClose: () => void
  onSubmit: (result: { revisao: Revisao; tarefas: Tarefa[] }) => void
}

function buildFreshForm(
  disciplinaAtiva: Disciplina,
  existingRevisoes: Revisao[],
  prefill?: RevisaoPrefill | null,
): CreateRevisaoFormData {
  return {
    numero: suggestNextRevisionNumero(existingRevisoes, disciplinaAtiva),
    origem: prefill?.origem ?? 'Interno',
    descricao: prefill?.descricao ?? '',
    pendenciaId: prefill?.pendenciaId ?? '',
  }
}

function applyDraft(draft: ReturnType<typeof loadNovaRevisaoDraft>) {
  if (!draft) return null
  return {
    step: draft.step,
    form: draft.form,
    selectedTemplateIds: new Set(draft.selectedTemplateIds),
    customTasks: draft.customTasks,
  }
}

export function CreateRevisaoModal({
  open,
  loading = false,
  error = null,
  projetoId,
  disciplinaAtiva,
  metodologia,
  defaultFase,
  existingRevisoes,
  openPendencias,
  prefill,
  usuarioId,
  onClose,
  onSubmit,
}: CreateRevisaoModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState<CreateRevisaoFormData>(() =>
    buildFreshForm(disciplinaAtiva, existingRevisoes, prefill),
  )
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set())
  const [customTasks, setCustomTasks] = useState<CustomRevisionTask[]>([])
  const [stepError, setStepError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resumePromptOpen, setResumePromptOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const prefillAppliedRef = useRef(false)

  const metodologiaAtiva = metodologia[disciplinaAtiva] ?? '2D'

  const resetFresh = useCallback(() => {
    setStep(1)
    setForm(buildFreshForm(disciplinaAtiva, existingRevisoes, prefill))
    setSelectedTemplateIds(new Set())
    setCustomTasks([])
    setStepError(null)
  }, [disciplinaAtiva, existingRevisoes, prefill])

  const revisaoStorageKey = `modal_nova_revisao_${projetoId}`

  const draftForPersist = useMemo(
    () => ({
      step,
      disciplina: disciplinaAtiva,
      form,
      selectedTemplateIds: Array.from(selectedTemplateIds),
      customTasks,
    }),
    [step, disciplinaAtiva, form, selectedTemplateIds, customTasks],
  )

  useDebouncedModalPersistence(
    open ? revisaoStorageKey : null,
    draftForPersist,
    open && initialized && !resumePromptOpen,
  )

  useEffect(() => {
    if (!open) {
      setInitialized(false)
      setResumePromptOpen(false)
      prefillAppliedRef.current = false
      return
    }

    if (initialized) return

    if (prefill) {
      resetFresh()
      setInitialized(true)
      prefillAppliedRef.current = true
      return
    }

    const draft = loadMeaningfulModalState(revisaoStorageKey, isNovaRevisaoDraftMeaningful)
    if (draft && draft.disciplina === disciplinaAtiva) {
      setResumePromptOpen(true)
    } else {
      resetFresh()
      setInitialized(true)
    }
  }, [open, initialized, projetoId, disciplinaAtiva, prefill, resetFresh, revisaoStorageKey])

  function handleResumeContinue() {
    const draft = loadMeaningfulModalState(revisaoStorageKey, isNovaRevisaoDraftMeaningful)
    const applied = applyDraft(draft)
    if (applied) {
      setStep(applied.step)
      setForm(applied.form)
      setSelectedTemplateIds(applied.selectedTemplateIds)
      setCustomTasks(applied.customTasks)
    } else {
      resetFresh()
    }
    setResumePromptOpen(false)
    setInitialized(true)
  }

  function handleResumeFresh() {
    clearNovaRevisaoDraft(projetoId)
    resetFresh()
    setResumePromptOpen(false)
    setInitialized(true)
  }

  function handleCloseAndClear() {
    clearNovaRevisaoDraft(projetoId)
    setStep(1)
    setStepError(null)
    setInitialized(false)
    onClose()
  }

  function handleNext() {
    if (!form.numero.trim()) {
      setStepError('Informe o número da revisão.')
      return
    }
    setStepError(null)
    setStep(2)
  }

  async function handleConfirm() {
    const totalTasks = selectedTemplateIds.size + customTasks.length
    if (totalTasks === 0) {
      setStepError('Selecione ao menos uma tarefa para a revisão.')
      return
    }

    setSubmitting(true)
    setStepError(null)
    try {
      const templates = await fetchActiveTemplates([disciplinaAtiva])
      const { revisao, tarefas } = await createRevisao({
        projetoId,
        numero: form.numero,
        disciplina: disciplinaAtiva,
        origem: form.origem,
        descricao: form.descricao,
        pendenciaId: form.pendenciaId || null,
        templateIds: Array.from(selectedTemplateIds),
        customTasks,
        templates,
        criadoPor: usuarioId,
      })
      clearNovaRevisaoDraft(projetoId)
      onSubmit({ revisao, tarefas })
      setInitialized(false)
      onClose()
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Erro ao criar revisão')
    } finally {
      setSubmitting(false)
    }
  }

  const displayError = stepError ?? error
  const busy = loading || submitting
  const showForm = open && initialized && !resumePromptOpen

  return (
    <>
      <ConfirmModal
        isOpen={resumePromptOpen}
        title="Revisão em andamento"
        message="Você tem uma revisão em andamento. Continuar de onde parou?"
        confirmLabel="Continuar"
        cancelLabel="Começar do zero"
        variant="default"
        onConfirm={handleResumeContinue}
        onCancel={handleResumeFresh}
      />

      <Modal
        open={showForm}
        onClose={handleCloseAndClear}
        title={step === 1 ? 'Nova revisão — Dados' : 'Nova revisão — Tarefas'}
        width="lg"
        footer={
          <div className="create-revisao-modal__footer">
            {step === 2 ? (
              <Button variant="secondary" disabled={busy} onClick={() => setStep(1)}>
                Voltar
              </Button>
            ) : (
              <Button variant="secondary" disabled={busy} onClick={handleCloseAndClear}>
                Cancelar
              </Button>
            )}
            {step === 1 ? (
              <Button variant="primary" disabled={busy} onClick={handleNext}>
                Próximo
              </Button>
            ) : (
              <Button variant="primary" loading={busy} onClick={() => void handleConfirm()}>
                Criar revisão
              </Button>
            )}
          </div>
        }
      >
        <div className="create-revisao-modal">
          {displayError ? (
            <p className="create-revisao-modal__error" role="alert">
              {displayError}
            </p>
          ) : null}

          {step === 1 ? (
            <>
              <Input
                label="Número"
                name="numero"
                value={form.numero}
                onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
              />

              <div className="create-revisao-modal__readonly">
                <span className="create-revisao-modal__label">Disciplina</span>
                <span
                  className={`create-revisao-modal__disciplina ${disciplinaTabClass(disciplinaAtiva, true)}`}
                >
                  {getDisciplinaLabel(disciplinaAtiva)}
                </span>
              </div>

              <label className="create-revisao-modal__field">
                <span className="create-revisao-modal__label">Origem</span>
                <select
                  className="create-revisao-modal__select"
                  value={form.origem}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      origem: e.target.value as CreateRevisaoFormData['origem'],
                    }))
                  }
                >
                  {REVISAO_ORIGENS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>

              <Textarea
                label="Descrição"
                name="descricao"
                rows={4}
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />

              <label className="create-revisao-modal__field">
                <span className="create-revisao-modal__label">Pendência vinculada</span>
                <select
                  className="create-revisao-modal__select"
                  value={form.pendenciaId}
                  onChange={(e) => setForm((f) => ({ ...f, pendenciaId: e.target.value }))}
                >
                  <option value="">Nenhuma</option>
                  {openPendencias.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.tipo} — {p.orgao}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <RevisionTaskSelect
              disciplina={disciplinaAtiva}
              metodologia={metodologiaAtiva}
              defaultFase={defaultFase}
              selectedTemplateIds={selectedTemplateIds}
              customTasks={customTasks}
              onSelectedTemplateIdsChange={setSelectedTemplateIds}
              onCustomTasksChange={setCustomTasks}
            />
          )}
        </div>
      </Modal>
    </>
  )
}
