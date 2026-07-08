import { useEffect, useState } from 'react'
import type { Criticidade, ExecutorPadrao, Fase, Metodologia, OrigemNormativa } from '../../types'
import { CRITICIDADE_OPTIONS, TAREFA_ORIGEM_OPTIONS } from '../../lib/tarefaManagement'
import type { TemplateChecklistInput } from '../../lib/templatesChecklist'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import './TemplateFormModal.css'

const EXECUTOR_OPTIONS: { value: ExecutorPadrao; label: string }[] = [
  { value: 'gestor', label: 'Gestor' },
  { value: 'projetista', label: 'Projetista' },
  { value: 'ambos', label: 'Ambos' },
]

const METODOLOGIA_OPTIONS: { value: '' | Metodologia; label: string }[] = [
  { value: '', label: 'Qualquer' },
  { value: '2D', label: '2D+' },
  { value: '3D', label: '3D+' },
  { value: 'BIM', label: 'BIM' },
]

export type TemplateFormValues = Omit<TemplateChecklistInput, 'disciplina' | 'fase' | 'categoria'>

interface TemplateFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  loading?: boolean
  error?: string | null
  initial?: Partial<TemplateFormValues>
  categoriaLabel?: string | null
  faseSelect?: {
    options: { value: Fase; label: string }[]
    value: Fase | ''
    onChange: (fase: Fase) => void
  } | null
  onClose: () => void
  onSubmit: (values: TemplateFormValues) => void
}

const DEFAULT: TemplateFormValues = {
  nome: '',
  descricao: '',
  criticidade: 'normal',
  origem: 'interno',
  referencia_normativa: '',
  executor_padrao: 'projetista',
  metodologia_minima: null,
  ordem: 0,
}

export function TemplateFormModal({
  open,
  mode,
  loading = false,
  error = null,
  initial,
  categoriaLabel = null,
  faseSelect = null,
  onClose,
  onSubmit,
}: TemplateFormModalProps) {
  const [form, setForm] = useState<TemplateFormValues>(DEFAULT)
  const [nomeError, setNomeError] = useState<string | null>(null)
  const [faseError, setFaseError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm({ ...DEFAULT, ...initial })
    setNomeError(null)
    setFaseError(null)
  }, [open, initial])

  function handleSubmit() {
    if (faseSelect && !faseSelect.value) {
      setFaseError('Selecione a fase')
      return
    }
    if (!form.nome.trim()) {
      setNomeError('Nome é obrigatório')
      return
    }
    onSubmit({
      ...form,
      nome: form.nome.trim(),
      descricao: form.descricao?.trim() || null,
      referencia_normativa: form.referencia_normativa?.trim() || null,
    })
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Adicionar tarefa ao template' : 'Editar tarefa do template'}
      onClose={onClose}
    >
      <div className="template-form-modal">
        {categoriaLabel ? (
          <p className="template-form-modal__categoria">
            Categoria: <strong>{categoriaLabel}</strong>
          </p>
        ) : null}

        {faseSelect ? (
          <label className="template-form-modal__field">
            <span className="template-form-modal__label">Fase *</span>
            <select
              value={faseSelect.value}
              onChange={(e) => {
                faseSelect.onChange(e.target.value as Fase)
                if (faseError) setFaseError(null)
              }}
            >
              <option value="">Selecione a fase</option>
              {faseSelect.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {faseError ? <span className="template-form-modal__field-error">{faseError}</span> : null}
          </label>
        ) : null}

        <Input
          label="Nome *"
          value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          error={nomeError ?? undefined}
        />
        <Textarea
          label="Descrição"
          value={form.descricao ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          rows={3}
        />
        <div className="template-form-modal__row">
          <label className="template-form-modal__field">
            <span className="template-form-modal__label">Criticidade</span>
            <select
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
          <label className="template-form-modal__field">
            <span className="template-form-modal__label">Origem</span>
            <select
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
        </div>
        <Input
          label="Referência normativa"
          value={form.referencia_normativa ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, referencia_normativa: e.target.value }))}
        />
        <div className="template-form-modal__row">
          <label className="template-form-modal__field">
            <span className="template-form-modal__label">Executor padrão</span>
            <select
              value={form.executor_padrao}
              onChange={(e) =>
                setForm((f) => ({ ...f, executor_padrao: e.target.value as ExecutorPadrao }))
              }
            >
              {EXECUTOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="template-form-modal__field">
            <span className="template-form-modal__label">Metodologia mínima</span>
            <select
              value={form.metodologia_minima ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  metodologia_minima: (e.target.value || null) as Metodologia | null,
                }))
              }
            >
              {METODOLOGIA_OPTIONS.map((o) => (
                <option key={o.value || 'any'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Input
          label="Ordem"
          type="number"
          value={String(form.ordem)}
          onChange={(e) => setForm((f) => ({ ...f, ordem: Number(e.target.value) || 0 }))}
        />
        {error ? <p className="template-form-modal__error">{error}</p> : null}
        <div className="template-form-modal__actions">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando…' : mode === 'create' ? 'Adicionar' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
