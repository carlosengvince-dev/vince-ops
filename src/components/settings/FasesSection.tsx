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
import { GripVertical } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { DISCIPLINA_LABELS, PHASE_LABELS, PHASE_SEQUENCES } from '../../lib/constants'
import {
  fetchPhaseLabels,
  fetchPhaseOrder,
  getDefaultPhaseOrder,
  resolvePhaseLabel,
  resolvePhaseSequence,
  savePhaseLabels,
  savePhaseOrder,
  type PhaseLabelsMap,
  type PhaseOrderMap,
} from '../../lib/phaseConfig'
import type { Disciplina, Fase } from '../../types'
import { DisciplinaTabs } from '../ui/DisciplinaTabs'
import { Input } from '../ui/Input'
import './FasesSection.css'
import './SettingsSubsection.css'

function SortablePhaseRow({
  fase,
  label,
  onLabelChange,
}: {
  fase: Fase
  label: string
  onLabelChange: (fase: Fase, label: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fase,
  })

  return (
    <li
      ref={setNodeRef}
      className={`fases-section__row${isDragging ? ' fases-section__row--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button type="button" className="fases-section__handle" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </button>
      <span className="fases-section__code">{fase}</span>
      <Input
        label="Label exibido"
        value={label}
        onChange={(e) => onLabelChange(fase, e.target.value)}
      />
      <span className="fases-section__default">
        Padrão: {PHASE_LABELS[fase]}
      </span>
    </li>
  )
}

export function FasesSection() {
  const { profile } = useAuth()
  const [disciplina, setDisciplina] = useState<Disciplina>('HID')
  const [labels, setLabels] = useState<PhaseLabelsMap>({})
  const [orderMap, setOrderMap] = useState<PhaseOrderMap>({})
  const [sequence, setSequence] = useState<Fase[]>(getDefaultPhaseOrder('HID'))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [lbl, ord] = await Promise.all([fetchPhaseLabels(), fetchPhaseOrder()])
      setLabels(lbl)
      setOrderMap(ord)
      setSequence(resolvePhaseSequence(disciplina, ord))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar fases')
    } finally {
      setLoading(false)
    }
  }, [disciplina])

  useEffect(() => {
    void load()
  }, [load])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleLabelChange(fase: Fase, value: string) {
    setLabels((prev) => {
      const trimmed = value.trim()
      if (!trimmed || trimmed === PHASE_LABELS[fase]) {
        const next = { ...prev }
        delete next[fase]
        return next
      }
      return { ...prev, [fase]: trimmed }
    })
    setSaved(false)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sequence.indexOf(active.id as Fase)
    const newIndex = sequence.indexOf(over.id as Fase)
    if (oldIndex < 0 || newIndex < 0) return
    const next = [...sequence]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved)
    setSequence(next)
    setOrderMap((prev) => ({ ...prev, [disciplina]: next }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await Promise.all([
        savePhaseLabels(labels, profile?.id),
        savePhaseOrder(orderMap, profile?.id),
      ])
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="settings-subsection">
      <header className="settings-subsection__head">
        <div>
          <h2 className="settings-subsection__title">Fases e sequências</h2>
          <p className="settings-subsection__hint">
            Reordenar fases afeta apenas novos projetos. Os códigos internos (ex.: AP) não são
            alterados.
          </p>
        </div>
        <button
          type="button"
          className="fases-section__save"
          disabled={saving || loading}
          onClick={() => void handleSave()}
        >
          {saving ? 'Salvando…' : saved ? 'Salvo' : 'Salvar alterações'}
        </button>
      </header>

      <DisciplinaTabs value={disciplina} onChange={setDisciplina} />

      {error ? <p className="settings-subsection__error">{error}</p> : null}
      {loading ? <p className="settings-subsection__status">Carregando…</p> : null}

      {!loading ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sequence} strategy={verticalListSortingStrategy}>
            <ul className="fases-section__list">
              {sequence.map((fase) => (
                <SortablePhaseRow
                  key={fase}
                  fase={fase}
                  label={resolvePhaseLabel(fase, labels)}
                  onLabelChange={handleLabelChange}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : null}

      <p className="fases-section__seq-hint">
        Sequência padrão {DISCIPLINA_LABELS[disciplina]}:{' '}
        {PHASE_SEQUENCES[disciplina].join(' → ')}
      </p>
    </section>
  )
}
