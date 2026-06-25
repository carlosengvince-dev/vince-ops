import { useEffect, useState } from 'react'
import type { PendenciaExterna, PendenciaOrgao, PendenciaTipo, Tarefa } from '../../types'
import { PENDENCIA_ORGAOS, PENDENCIA_TIPOS } from '../../lib/pendencias'
import { clearModalState } from '../../lib/modalStorage'
import {
  hasMeaningfulModalState,
  isPendenciaDraftMeaningful,
  loadMeaningfulModalState,
} from '../../lib/modalDraftUtils'
import { useDebouncedModalPersistence } from '../../hooks/useDebouncedModalPersistence'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { TarefaVinculadaSelect } from './TarefaVinculadaSelect'
import './NewPendenciaModal.css'

export interface PendenciaFormData {
  orgao: PendenciaOrgao
  tipo: PendenciaTipo
  descricao: string
  prazo: string
  dataRecebimento: string
  tarefasVinculadas: string[]
}

interface PendenciaFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  loading?: boolean
  error?: string | null
  tarefas: Tarefa[]
  storageKey?: string | null
  initial?: PendenciaFormData
  onClose: () => void
  onSubmit: (data: PendenciaFormData) => void
}

const DEFAULT_FORM: PendenciaFormData = {
  orgao: 'CBMSC',
  tipo: 'Comunique-se',
  descricao: '',
  prazo: '',
  dataRecebimento: '',
  tarefasVinculadas: [],
}

export function PendenciaFormModal({
  open,
  mode,
  loading = false,
  error = null,
  tarefas,
  storageKey = null,
  initial,
  onClose,
  onSubmit,
}: PendenciaFormModalProps) {
  const [form, setForm] = useState<PendenciaFormData>(DEFAULT_FORM)
  const [descricaoError, setDescricaoError] = useState<string | null>(null)
  const [resumePromptOpen, setResumePromptOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)

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
      setDescricaoError(null)
      setInitialized(true)
      return
    }

    if (mode === 'create' && storageKey && hasMeaningfulModalState(storageKey, isPendenciaDraftMeaningful)) {
      setResumePromptOpen(true)
      return
    }

    setForm(DEFAULT_FORM)
    setDescricaoError(null)
    setInitialized(true)
  }, [open, initialized, mode, initial, storageKey])

  function handleResumeContinue() {
    if (storageKey) {
      const saved = loadMeaningfulModalState(storageKey, isPendenciaDraftMeaningful)
      if (saved) setForm(saved)
    }
    setResumePromptOpen(false)
    setInitialized(true)
  }

  function handleResumeFresh() {
    if (storageKey) clearModalState(storageKey)
    setForm(DEFAULT_FORM)
    setResumePromptOpen(false)
    setInitialized(true)
  }

  function handleClose() {
    if (storageKey) clearModalState(storageKey)
    setForm(DEFAULT_FORM)
    setDescricaoError(null)
    setInitialized(false)
    onClose()
  }

  function handleSubmit() {
    if (!form.descricao.trim()) {
      setDescricaoError('Descrição é obrigatória')
      return
    }
    setDescricaoError(null)
    if (storageKey) clearModalState(storageKey)
    setInitialized(false)
    onSubmit(form)
  }

  const showForm = open && initialized && !resumePromptOpen

  return (
    <>
      <ConfirmModal
        isOpen={resumePromptOpen}
        title="Pendência em andamento"
        message="Você tem uma pendência em andamento. Continuar de onde parou?"
        confirmLabel="Continuar"
        cancelLabel="Começar do zero"
        variant="default"
        onConfirm={handleResumeContinue}
        onCancel={handleResumeFresh}
      />

      <Modal
        open={showForm}
        onClose={handleClose}
        title={mode === 'create' ? 'Nova pendência' : 'Editar pendência'}
        width="md"
        footer={
          <div className="new-pendencia-modal__footer">
            <Button variant="secondary" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="primary" loading={loading} onClick={handleSubmit}>
              Salvar
            </Button>
          </div>
        }
      >
        <div className="new-pendencia-modal">
          {error ? (
            <p className="new-pendencia-modal__error" role="alert">
              {error}
            </p>
          ) : null}

          <label className="new-pendencia-modal__field">
            <span className="new-pendencia-modal__label">Órgão</span>
            <select
              className="new-pendencia-modal__select"
              value={form.orgao}
              onChange={(e) => setForm((f) => ({ ...f, orgao: e.target.value as PendenciaOrgao }))}
            >
              {PENDENCIA_ORGAOS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>

          <label className="new-pendencia-modal__field">
            <span className="new-pendencia-modal__label">Tipo</span>
            <select
              className="new-pendencia-modal__select"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as PendenciaTipo }))}
            >
              {PENDENCIA_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <Textarea
            label="Descrição *"
            name="descricao"
            rows={4}
            value={form.descricao}
            error={descricaoError}
            onChange={(e) => {
              setForm((f) => ({ ...f, descricao: e.target.value }))
              if (descricaoError) setDescricaoError(null)
            }}
          />

          <Input
            label="Prazo"
            name="prazo"
            type="date"
            value={form.prazo}
            onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
          />

          <Input
            label="Data de recebimento"
            name="dataRecebimento"
            type="date"
            value={form.dataRecebimento}
            onChange={(e) => setForm((f) => ({ ...f, dataRecebimento: e.target.value }))}
          />

          <TarefaVinculadaSelect
            tarefas={tarefas}
            selectedIds={form.tarefasVinculadas}
            onChange={(ids) => setForm((f) => ({ ...f, tarefasVinculadas: ids }))}
          />
        </div>
      </Modal>
    </>
  )
}

export function pendenciaToFormData(p: PendenciaExterna): PendenciaFormData {
  return {
    orgao: p.orgao,
    tipo: p.tipo,
    descricao: p.descricao,
    prazo: p.prazo ?? '',
    dataRecebimento: p.data_recebimento ?? '',
    tarefasVinculadas: p.tarefas_vinculadas ?? [],
  }
}

export type NewPendenciaFormData = PendenciaFormData
