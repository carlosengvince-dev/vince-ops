import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { DocumentoProjeto, DocumentoStatus } from '../../types'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import './PreInfoPanel.css'

const DOC_STATUS_LABELS: Record<DocumentoStatus, string> = {
  aguardando: 'Aguardando',
  recebido: 'Recebido',
  nao_receberemos: 'Não receberemos',
}

interface PreInfoPanelProps {
  nome: string
  clienteNome: string | null
  documentos: DocumentoProjeto[]
  readOnly?: boolean
  onStatusChange?: (
    docId: string,
    status: DocumentoStatus,
    dataRecebimento?: string | null,
  ) => Promise<void>
  onObservacoesChange?: (docId: string, observacoes: string | null) => Promise<void>
  onAddDocumento?: (nome: string, tipo: string) => Promise<void>
  onRemoveDocumento?: (docId: string) => Promise<void>
}

export function PreInfoPanel({
  nome,
  clienteNome,
  documentos,
  readOnly = false,
  onStatusChange,
  onObservacoesChange,
  onAddDocumento,
  onRemoveDocumento,
}: PreInfoPanelProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [addNome, setAddNome] = useState('')
  const [addTipo, setAddTipo] = useState('')
  const [adding, setAdding] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<DocumentoProjeto | null>(null)
  const [removing, setRemoving] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [obsDraft, setObsDraft] = useState<Record<string, string>>({})

  const canEdit = !readOnly && onStatusChange != null

  async function handleToggleRecebido(doc: DocumentoProjeto) {
    if (!onStatusChange) return
    const next: DocumentoStatus = doc.status === 'recebido' ? 'aguardando' : 'recebido'
    setSavingId(doc.id)
    try {
      await onStatusChange(
        doc.id,
        next,
        next === 'recebido' ? new Date().toISOString().slice(0, 10) : null,
      )
    } finally {
      setSavingId(null)
    }
  }

  async function handleToggleNaoReceberemos(doc: DocumentoProjeto) {
    if (!onStatusChange) return
    const next: DocumentoStatus =
      doc.status === 'nao_receberemos' ? 'aguardando' : 'nao_receberemos'
    setSavingId(doc.id)
    try {
      await onStatusChange(doc.id, next, null)
    } finally {
      setSavingId(null)
    }
  }

  async function handleSaveObs(doc: DocumentoProjeto) {
    if (!onObservacoesChange) return
    const value = obsDraft[doc.id] ?? doc.observacoes ?? ''
    setSavingId(doc.id)
    try {
      await onObservacoesChange(doc.id, value.trim() || null)
    } finally {
      setSavingId(null)
    }
  }

  async function handleAdd() {
    if (!onAddDocumento || !addNome.trim()) return
    setAdding(true)
    try {
      await onAddDocumento(addNome.trim(), addTipo.trim() || 'Outro')
      setAddOpen(false)
      setAddNome('')
      setAddTipo('')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove() {
    if (!removeTarget || !onRemoveDocumento) return
    setRemoving(true)
    try {
      await onRemoveDocumento(removeTarget.id)
      setRemoveTarget(null)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="pre-info-panel">
      <header className="pre-info-panel__header">
        <div>
          <h1 className="pre-info-panel__title">{nome}</h1>
          <p className="pre-info-panel__subtitle">
            {clienteNome ?? 'Sem cliente'} · Recebimento de documentos
          </p>
        </div>
        {canEdit && onAddDocumento ? (
          <Button variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus size={14} />
            Adicionar documento
          </Button>
        ) : null}
      </header>

      <div className="pre-info-panel__body">
        {documentos.length === 0 ? (
          <p className="pre-info-panel__empty">Nenhum documento cadastrado.</p>
        ) : (
          <ul className="pre-info-panel__list">
            {documentos.map((doc) => {
              const obsValue = obsDraft[doc.id] ?? doc.observacoes ?? ''
              return (
                <li key={doc.id} className="pre-info-panel__item">
                  <div className="pre-info-panel__item-main">
                    <div className="pre-info-panel__item-head">
                      <span className="pre-info-panel__nome">{doc.nome}</span>
                      <span className="pre-info-panel__tipo">{doc.tipo}</span>
                      {doc.critico ? (
                        <span className="pre-info-panel__critico">Crítico</span>
                      ) : null}
                      <span
                        className={`pre-info-panel__status pre-info-panel__status--${doc.status.replace('_', '')}`}
                      >
                        {DOC_STATUS_LABELS[doc.status]}
                      </span>
                      {doc.status === 'recebido' && doc.data_recebimento ? (
                        <span className="pre-info-panel__data-rec">
                          {new Date(doc.data_recebimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      ) : null}
                    </div>

                    {canEdit ? (
                      <div className="pre-info-panel__controls">
                        <label className="pre-info-panel__toggle">
                          <input
                            type="checkbox"
                            checked={doc.status === 'recebido'}
                            disabled={savingId === doc.id}
                            onChange={() => void handleToggleRecebido(doc)}
                          />
                          Recebido
                        </label>
                        <label className="pre-info-panel__toggle">
                          <input
                            type="checkbox"
                            checked={doc.status === 'nao_receberemos'}
                            disabled={savingId === doc.id}
                            onChange={() => void handleToggleNaoReceberemos(doc)}
                          />
                          Não receberemos
                        </label>
                        {onRemoveDocumento ? (
                          <button
                            type="button"
                            className="pre-info-panel__remove"
                            aria-label="Remover documento"
                            onClick={() => setRemoveTarget(doc)}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {canEdit && onObservacoesChange ? (
                      <div className="pre-info-panel__obs">
                        <Textarea
                          label="Observações"
                          value={obsValue}
                          rows={2}
                          onChange={(e) =>
                            setObsDraft((prev) => ({ ...prev, [doc.id]: e.target.value }))
                          }
                          onBlur={() => {
                            if (obsValue !== (doc.observacoes ?? '')) void handleSaveObs(doc)
                          }}
                        />
                      </div>
                    ) : doc.observacoes ? (
                      <p className="pre-info-panel__obs-read">{doc.observacoes}</p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Modal open={addOpen} title="Adicionar documento avulso" onClose={() => setAddOpen(false)}>
        <div className="pre-info-panel__add-form">
          <Input label="Nome *" value={addNome} onChange={(e) => setAddNome(e.target.value)} />
          <Input label="Tipo" value={addTipo} onChange={(e) => setAddTipo(e.target.value)} />
          <div className="pre-info-panel__add-actions">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={adding || !addNome.trim()} onClick={() => void handleAdd()}>
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={removeTarget != null}
        title="Remover documento"
        message={`Remover "${removeTarget?.nome}" deste projeto?`}
        variant="danger"
        confirmLabel="Remover"
        loading={removing}
        onConfirm={() => void handleRemove()}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  )
}
