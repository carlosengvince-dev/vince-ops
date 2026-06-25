import { useEffect, useState } from 'react'
import type { Criticidade, OrigemNormativa } from '../../types'
import {
  CRITICIDADE_OPTIONS,
  NOVA_CATEGORIA_VALUE,
  TAREFA_ORIGEM_OPTIONS,
  type TaskFormValues,
} from '../../lib/tarefaManagement'
import { clearModalState } from '../../lib/modalStorage'
import {
  hasMeaningfulModalState,
  isTaskDraftMeaningful,
  loadMeaningfulModalState,
} from '../../lib/modalDraftUtils'
import { useDebouncedModalPersistence } from '../../hooks/useDebouncedModalPersistence'
import { useActiveProfiles } from '../../hooks/useActiveProfiles'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import './TaskFormModal.css'

interface TaskFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  loading?: boolean
  error?: string | null
  categorias: string[]
  storageKey?: string | null
  initial?: TaskFormValues
  onClose: () => void
  onSubmit: (values: TaskFormValues & { categoriaFinal: string }) => void
}

const DEFAULT_VALUES: TaskFormValues = {
  nome: '',
  descricao: '',
  categoria: '',
  categoriaIsNew: false,
  novaCategoriaText: '',
  criticidade: 'normal',
  origem: 'interno',
  referencia_normativa: '',
  responsavelId: '',
}

export function TaskFormModal({
  open,
  mode,
  loading = false,
  error = null,
  categorias,
  storageKey = null,
  initial,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  const [form, setForm] = useState<TaskFormValues>(DEFAULT_VALUES)
  const [nomeError, setNomeError] = useState<string | null>(null)
  const [categoriaError, setCategoriaError] = useState<string | null>(null)
  const [resumePromptOpen, setResumePromptOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const { profiles, loading: profilesLoading } = useActiveProfiles(open)

  const categoriaSelectValue = form.categoriaIsNew
    ? NOVA_CATEGORIA_VALUE
    : form.categoria && categorias.includes(form.categoria)
      ? form.categoria
      : categorias[0] ?? NOVA_CATEGORIA_VALUE

  const shouldPersist = open && initialized && !resumePromptOpen && storageKey != null
  useDebouncedModalPersistence(storageKey, form, shouldPersist)

  useEffect(() => {
    if (!open) {
      setInitialized(false)
      setResumePromptOpen(false)
      return
    }
    if (initialized) return

    if (mode === 'edit' && initial) {
      setForm(initial)
      setInitialized(true)
      return
    }

    if (mode === 'create' && storageKey && hasMeaningfulModalState(storageKey, isTaskDraftMeaningful)) {
      setResumePromptOpen(true)
      return
    }

    setForm({
      ...DEFAULT_VALUES,
      categoria: categorias[0] ?? '',
      categoriaIsNew: categorias.length === 0,
    })
    setNomeError(null)
    setCategoriaError(null)
    setInitialized(true)
  }, [open, initialized, mode, initial, categorias, storageKey])

  function handleResumeContinue() {
    if (storageKey) {
      const saved = loadMeaningfulModalState(storageKey, isTaskDraftMeaningful)
      if (saved) setForm(saved)
    }
    setResumePromptOpen(false)
    setInitialized(true)
  }

  function handleResumeFresh() {
    if (storageKey) clearModalState(storageKey)
    setForm({
      ...DEFAULT_VALUES,
      categoria: categorias[0] ?? '',
      categoriaIsNew: categorias.length === 0,
    })
    setResumePromptOpen(false)
    setInitialized(true)
  }

  function handleClose() {
    if (storageKey) clearModalState(storageKey)
    setForm(DEFAULT_VALUES)
    setNomeError(null)
    setCategoriaError(null)
    setInitialized(false)
    onClose()
  }

  function resolveCategoria(): string | null {
    if (form.categoriaIsNew || categoriaSelectValue === NOVA_CATEGORIA_VALUE) {
      const trimmed = form.novaCategoriaText.trim()
      if (!trimmed) {
        setCategoriaError('Informe o nome da categoria')
        return null
      }
      return trimmed
    }
    return form.categoria.trim() || categorias[0] || null
  }

  function handleSubmit() {
    if (!form.nome.trim()) {
      setNomeError('Nome é obrigatório')
      return
    }
    const categoriaFinal = resolveCategoria()
    if (!categoriaFinal) return

    setNomeError(null)
    setCategoriaError(null)
    if (storageKey) clearModalState(storageKey)
    setInitialized(false)
    onSubmit({ ...form, categoriaFinal })
  }

  const showForm = open && initialized && !resumePromptOpen

  return (
    <>
      <ConfirmModal
        isOpen={resumePromptOpen}
        title="Tarefa em andamento"
        message="Você tem uma tarefa em andamento. Continuar de onde parou?"
        confirmLabel="Continuar"
        cancelLabel="Começar do zero"
        variant="default"
        onConfirm={handleResumeContinue}
        onCancel={handleResumeFresh}
      />

      <Modal
        open={showForm}
        onClose={handleClose}
        title={mode === 'create' ? 'Nova tarefa' : 'Editar tarefa'}
        width="md"
        footer={
          <div className="task-form-modal__footer">
            <Button variant="secondary" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="primary" loading={loading} onClick={handleSubmit}>
              Salvar
            </Button>
          </div>
        }
      >
        <div className="task-form-modal">
          {error ? (
            <p className="task-form-modal__error" role="alert">
              {error}
            </p>
          ) : null}

          <Input
            label="Nome *"
            name="nome"
            value={form.nome}
            error={nomeError}
            onChange={(e) => {
              setForm((f) => ({ ...f, nome: e.target.value }))
              if (nomeError) setNomeError(null)
            }}
          />

          <Textarea
            label="Descrição"
            name="descricao"
            rows={3}
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          />

          <label className="task-form-modal__field">
            <span className="task-form-modal__label">Categoria</span>
            <select
              className="task-form-modal__select"
              value={categoriaSelectValue}
              onChange={(e) => {
                const val = e.target.value
                if (val === NOVA_CATEGORIA_VALUE) {
                  setForm((f) => ({ ...f, categoriaIsNew: true }))
                } else {
                  setForm((f) => ({
                    ...f,
                    categoriaIsNew: false,
                    categoria: val,
                  }))
                }
                if (categoriaError) setCategoriaError(null)
              }}
            >
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NOVA_CATEGORIA_VALUE}>Nova categoria…</option>
            </select>
          </label>

          <div
            className="task-form-modal__nova-categoria"
            style={{ display: form.categoriaIsNew ? 'block' : 'none' }}
          >
            <Input
              label="Nome da nova categoria"
              name="novaCategoria"
              value={form.novaCategoriaText}
              error={categoriaError}
              onChange={(e) => {
                setForm((f) => ({ ...f, novaCategoriaText: e.target.value }))
                if (categoriaError) setCategoriaError(null)
              }}
            />
          </div>

          <label className="task-form-modal__field">
            <span className="task-form-modal__label">Criticidade</span>
            <select
              className="task-form-modal__select"
              value={form.criticidade}
              onChange={(e) =>
                setForm((f) => ({ ...f, criticidade: e.target.value as Criticidade }))
              }
            >
              {CRITICIDADE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="task-form-modal__field">
            <span className="task-form-modal__label">Origem</span>
            <select
              className="task-form-modal__select"
              value={form.origem}
              onChange={(e) =>
                setForm((f) => ({ ...f, origem: e.target.value as OrigemNormativa }))
              }
            >
              {TAREFA_ORIGEM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="Referência normativa"
            name="referencia"
            value={form.referencia_normativa}
            onChange={(e) => setForm((f) => ({ ...f, referencia_normativa: e.target.value }))}
          />

          <label className="task-form-modal__field">
            <span className="task-form-modal__label">Responsável</span>
            <select
              className="task-form-modal__select"
              value={form.responsavelId}
              disabled={profilesLoading}
              onChange={(e) => setForm((f) => ({ ...f, responsavelId: e.target.value }))}
            >
              <option value="">Nenhum</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Modal>
    </>
  )
}
