import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import type { DocumentoPadraoConfig } from '../../lib/configuracoes'
import {
  fetchDefaultDocumentosPadrao,
  saveDefaultDocumentosPadrao,
} from '../../lib/documentosProjeto'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import './DocumentosPadraoSection.css'
import './SettingsSubsection.css'

function SortableDocRow({
  doc,
  index,
  onEdit,
  onRemove,
}: {
  doc: DocumentoPadraoConfig
  index: number
  onEdit: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `doc-${index}`,
  })

  return (
    <li
      ref={setNodeRef}
      className={`documentos-padrao__row${isDragging ? ' documentos-padrao__row--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button type="button" className="documentos-padrao__handle" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </button>
      <div className="documentos-padrao__info">
        <span className="documentos-padrao__nome">{doc.nome}</span>
        <span className="documentos-padrao__tipo">{doc.tipo}</span>
        {doc.critico ? <span className="documentos-padrao__critico">Crítico</span> : null}
      </div>
      <button type="button" className="documentos-padrao__icon" onClick={onEdit} aria-label="Editar">
        <Pencil size={14} />
      </button>
      <button type="button" className="documentos-padrao__icon" onClick={onRemove} aria-label="Remover">
        <Trash2 size={14} />
      </button>
    </li>
  )
}

export function DocumentosPadraoSection() {
  const { profile } = useAuth()
  const [items, setItems] = useState<DocumentoPadraoConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<DocumentoPadraoConfig>({ nome: '', tipo: 'Outro', critico: false })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchDefaultDocumentosPadrao())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function persist(next: DocumentoPadraoConfig[]) {
    setSaving(true)
    setError(null)
    try {
      await saveDefaultDocumentosPadrao(next, profile?.id)
      setItems(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = Number(String(active.id).replace('doc-', ''))
    const newIndex = Number(String(over.id).replace('doc-', ''))
    const next = [...items]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved)
    void persist(next)
  }

  function openCreate() {
    setEditIndex(null)
    setDraft({ nome: '', tipo: 'Outro', critico: false })
    setModalOpen(true)
  }

  function openEdit(index: number) {
    setEditIndex(index)
    setDraft({ ...items[index] })
    setModalOpen(true)
  }

  async function handleSaveDoc() {
    if (!draft.nome.trim()) return
    const doc = { ...draft, nome: draft.nome.trim(), tipo: draft.tipo.trim() || 'Outro' }
    const next = [...items]
    if (editIndex != null) next[editIndex] = doc
    else next.push(doc)
    await persist(next)
    setModalOpen(false)
  }

  return (
    <section className="settings-subsection">
      <header className="settings-subsection__head">
        <div>
          <h2 className="settings-subsection__title">Documentos padrão PRÉ-INFO</h2>
          <p className="settings-subsection__hint">
            Lista aplicada automaticamente a novos projetos na fase PRÉ-INFO.
          </p>
        </div>
        <Button variant="secondary" onClick={openCreate}>
          Adicionar documento
        </Button>
      </header>

      {error ? <p className="settings-subsection__error">{error}</p> : null}
      {loading ? <p className="settings-subsection__status">Carregando…</p> : null}

      {!loading ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={items.map((_, i) => `doc-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="documentos-padrao__list">
              {items.map((doc, index) => (
                <SortableDocRow
                  key={`doc-${index}`}
                  doc={doc}
                  index={index}
                  onEdit={() => openEdit(index)}
                  onRemove={() => void persist(items.filter((_, i) => i !== index))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : null}
      {saving ? <p className="settings-subsection__status">Salvando…</p> : null}

      <Modal open={modalOpen} title={editIndex != null ? 'Editar documento' : 'Novo documento'} onClose={() => setModalOpen(false)}>
        <div className="documentos-padrao__form">
          <Input label="Nome *" value={draft.nome} onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} />
          <Input label="Tipo" value={draft.tipo} onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value }))} />
          <label className="documentos-padrao__toggle">
            <input
              type="checkbox"
              checked={draft.critico}
              onChange={(e) => setDraft((d) => ({ ...d, critico: e.target.checked }))}
            />
            Documento crítico
          </label>
          <div className="documentos-padrao__form-actions">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" disabled={!draft.nome.trim() || saving} onClick={() => void handleSaveDoc()}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
