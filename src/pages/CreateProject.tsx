import { useMemo, useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  StepIndicator,
  StepModeSelect,
} from '../components/projects/CreateProjectSteps'
import {
  StepChecklistSelect,
  validateChecklistStep,
} from '../components/projects/StepChecklistSelect'
import {
  StepProjectData,
  validateProjectFormStep,
} from '../components/projects/StepProjectData'
import { checkCodigoDisponivel, fetchActiveTemplates } from '../lib/projects'
import { useProjects } from '../hooks/useProjects'
import '../components/projects/CreateProjectSteps.css'
import '../components/projects/StepProjectData.css'
import '../components/projects/StepChecklistSelect.css'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useAuth } from '../hooks/useAuth'
import { clearModalState } from '../lib/modalStorage'
import { useDebouncedModalPersistence } from '../hooks/useDebouncedModalPersistence'
import {
  hasMeaningfulModalState,
  isCreateProjectDraftMeaningful,
  loadMeaningfulModalState,
} from '../lib/modalDraftUtils'
import type { ModoCriacao } from '../types'
import {
  EMPTY_CHECKLIST_SELECTION,
  EMPTY_PROJECT_FORM,
  type ChecklistSelectionState,
  type ProjectFormData,
} from '../types/project-create'

const CREATE_PROJECT_KEY = 'modal_novo_projeto'

interface CreateProjectDraft {
  step: number
  modo: ModoCriacao | null
  form: ProjectFormData
  checklist: {
    faseEntrada: ChecklistSelectionState['faseEntrada']
    selectedTemplateIds: string[]
    disabledTemplateIds: string[]
  }
}

function getStepLabels(modo: ModoCriacao | null): string[] {
  if (modo === 'historico') {
    return ['Tipo', 'Dados do projeto']
  }
  return ['Tipo', 'Dados do projeto', 'Checklist inicial']
}

function serializeChecklist(checklist: ChecklistSelectionState) {
  return {
    faseEntrada: checklist.faseEntrada,
    selectedTemplateIds: Array.from(checklist.selectedTemplateIds),
    disabledTemplateIds: Array.from(checklist.disabledTemplateIds),
  }
}

function deserializeChecklist(
  data: CreateProjectDraft['checklist'],
): ChecklistSelectionState {
  return {
    faseEntrada: data.faseEntrada,
    selectedTemplateIds: new Set(data.selectedTemplateIds),
    disabledTemplateIds: new Set(data.disabledTemplateIds),
  }
}

export default function CreateProject() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { createProject } = useProjects()

  const [step, setStep] = useState(1)
  const [modo, setModo] = useState<ModoCriacao | null>(null)
  const [form, setForm] = useState<ProjectFormData>(EMPTY_PROJECT_FORM)
  const [checklist, setChecklist] = useState<ChecklistSelectionState>(EMPTY_CHECKLIST_SELECTION)
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ProjectFormData | 'codigo_dup', string>>
  >({})
  const [checklistError, setChecklistError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resumePromptOpen, setResumePromptOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const totalSteps = modo === 'historico' ? 2 : 3
  const stepLabels = useMemo(() => getStepLabels(modo), [modo])
  const isFinalStep = step === totalSteps

  const draftState: CreateProjectDraft = {
    step,
    modo,
    form,
    checklist: serializeChecklist(checklist),
  }

  useDebouncedModalPersistence(CREATE_PROJECT_KEY, draftState, initialized && !resumePromptOpen)

  useEffect(() => {
    if (initialized) return
    if (hasMeaningfulModalState(CREATE_PROJECT_KEY, isCreateProjectDraftMeaningful)) {
      setResumePromptOpen(true)
    } else {
      setInitialized(true)
    }
  }, [initialized])

  function applyDraft(draft: CreateProjectDraft) {
    setStep(draft.step)
    setModo(draft.modo)
    setForm(draft.form)
    setChecklist(deserializeChecklist(draft.checklist))
    setFieldErrors({})
    setChecklistError(null)
    setSubmitError(null)
  }

  function handleResumeContinue() {
    const draft = loadMeaningfulModalState(CREATE_PROJECT_KEY, isCreateProjectDraftMeaningful)
    if (draft) applyDraft(draft as CreateProjectDraft)
    setResumePromptOpen(false)
    setInitialized(true)
  }

  function handleResumeFresh() {
    clearModalState(CREATE_PROJECT_KEY)
    setStep(1)
    setModo(null)
    setForm(EMPTY_PROJECT_FORM)
    setChecklist(EMPTY_CHECKLIST_SELECTION)
    setFieldErrors({})
    setChecklistError(null)
    setSubmitError(null)
    setResumePromptOpen(false)
    setInitialized(true)
  }

  function handleSelectModo(nextModo: ModoCriacao) {
    setModo(nextModo)
    setForm(EMPTY_PROJECT_FORM)
    setChecklist({
      faseEntrada: {},
      selectedTemplateIds: new Set(),
      disabledTemplateIds: new Set(),
    })
    setFieldErrors({})
    setChecklistError(null)
    setSubmitError(null)
  }

  function handleBack() {
    if (step === 1) {
      clearModalState(CREATE_PROJECT_KEY)
      navigate('/')
      return
    }
    setFieldErrors({})
    setChecklistError(null)
    setSubmitError(null)
    setStep((s) => s - 1)
  }

  async function handleNext() {
    if (step === 1) {
      if (!modo) return
      setStep(2)
      return
    }

    if (step === 2 && modo) {
      const codigoOk = form.codigo.trim()
        ? await checkCodigoDisponivel(form.codigo)
        : false
      const errors = validateProjectFormStep(modo, form, !codigoOk)
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        return
      }
      setFieldErrors({})

      if (modo === 'historico') {
        return
      }

      setChecklistError(null)
      setStep(3)
    }
  }

  async function handleCreate() {
    if (!modo || !profile) return

    setSubmitError(null)
    setSubmitting(true)

    try {
      const codigoOk = form.codigo.trim()
        ? await checkCodigoDisponivel(form.codigo)
        : false
      const formErrors = validateProjectFormStep(modo, form, !codigoOk)
      if (Object.keys(formErrors).length > 0) {
        setFieldErrors(formErrors)
        if (step !== 2) setStep(2)
        return
      }

      if (modo !== 'historico') {
        const templates = await fetchActiveTemplates(form.disciplinas)
        const checklistErr = validateChecklistStep(modo, checklist, templates, form)
        if (checklistErr) {
          setChecklistError(checklistErr)
          if (step !== 3) setStep(3)
          return
        }
      }

      await createProject({
        modo,
        form,
        checklist,
        createdBy: profile.id,
      })

      clearModalState(CREATE_PROJECT_KEY)

      if (modo === 'historico') {
        navigate('/historico')
      } else {
        navigate('/')
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao criar projeto.')
    } finally {
      setSubmitting(false)
    }
  }

  const continueDisabled = step === 1 && !modo

  if (!initialized && resumePromptOpen) {
    return (
      <PageWrapper title="Novo projeto">
        <ConfirmModal
          isOpen
          title="Projeto em andamento"
          message="Você tem um projeto em andamento. Continuar de onde parou?"
          confirmLabel="Continuar"
          cancelLabel="Começar do zero"
          variant="default"
          onConfirm={handleResumeContinue}
          onCancel={handleResumeFresh}
        />
      </PageWrapper>
    )
  }

  if (!initialized) {
    return (
      <PageWrapper title="Novo projeto">
        <p className="step-checklist__status">Carregando…</p>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Novo projeto">
      <StepIndicator currentStep={step} totalSteps={totalSteps} labels={stepLabels} />

      {submitError ? (
        <p className="step-checklist__error" role="alert" style={{ marginBottom: 16 }}>
          {submitError}
        </p>
      ) : null}

      {step === 1 ? (
        <StepModeSelect selected={modo} onSelect={handleSelectModo} />
      ) : step === 2 && modo ? (
        <StepProjectData
          modo={modo}
          form={form}
          onChange={setForm}
          fieldErrors={fieldErrors}
        />
      ) : step === 3 && modo && modo !== 'historico' ? (
        <StepChecklistSelect
          modo={modo}
          form={form}
          checklist={checklist}
          onChange={setChecklist}
          error={checklistError}
        />
      ) : null}

      <div className="create-project__footer">
        <Button type="button" variant="ghost" onClick={handleBack} disabled={submitting}>
          <ArrowLeft size={16} />
          {step === 1 ? 'Voltar ao dashboard' : 'Voltar'}
        </Button>
        <div className="create-project__footer-right">
          {isFinalStep ? (
            <Button type="button" onClick={() => void handleCreate()} loading={submitting}>
              Criar projeto
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void handleNext()}
              disabled={continueDisabled || submitting}
            >
              Continuar
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
