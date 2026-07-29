import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import {
  EMPTY_RT_FORM,
  type ResponsavelTecnicoFormData,
} from '../../hooks/useResponsaveisTecnicos'
import type { ResponsavelTecnico } from '../../types'

interface RtFormModalProps {
  open: boolean
  title?: string
  initial?: ResponsavelTecnico | null
  saving?: boolean
  onClose: () => void
  onSubmit: (data: ResponsavelTecnicoFormData) => Promise<void>
}

export function RtFormModal({
  open,
  title,
  initial = null,
  saving = false,
  onClose,
  onSubmit,
}: RtFormModalProps) {
  const [form, setForm] = useState<ResponsavelTecnicoFormData>(EMPTY_RT_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      initial
        ? {
            nome: initial.nome,
            documento: initial.documento ?? '',
            registro: initial.registro ?? '',
          }
        : EMPTY_RT_FORM,
    )
  }, [open, initial])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.nome.trim()) {
      setError('Nome é obrigatório.')
      return
    }
    setError(null)
    try {
      await onSubmit(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar RT')
    }
  }

  return (
    <Modal
      open={open}
      title={title ?? (initial ? 'Editar RT' : 'Novo RT')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="rt-form" loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="rt-form" onSubmit={(e) => void handleSubmit(e)}>
        {error ? (
          <p role="alert" style={{ margin: '0 0 12px', color: 'var(--status-bloqueado-border)' }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="Nome"
            value={form.nome}
            onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
            required
            autoFocus
          />
          <Input
            label="Documento (CPF/CNPJ)"
            value={form.documento}
            onChange={(e) => setForm((prev) => ({ ...prev, documento: e.target.value }))}
          />
          <Input
            label="Registro (CREA/CAU)"
            value={form.registro}
            onChange={(e) => setForm((prev) => ({ ...prev, registro: e.target.value }))}
          />
        </div>
      </form>
    </Modal>
  )
}
