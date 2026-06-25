import { useEffect, useState } from 'react'
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
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import './SortableStringList.css'

interface SortableStringListProps {
  items: string[]
  onChange: (items: string[]) => void
  onRename?: (oldValue: string, newValue: string) => void
  addLabel?: string
}

function SortableItem({
  id,
  value,
  onEdit,
  onRemove,
}: {
  id: string
  value: string
  onEdit: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  return (
    <li
      ref={setNodeRef}
      className={`sortable-string-list__item${isDragging ? ' sortable-string-list__item--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button type="button" className="sortable-string-list__handle" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </button>
      <span className="sortable-string-list__value">{value}</span>
      <button type="button" className="sortable-string-list__icon-btn" onClick={onEdit} aria-label="Renomear">
        <Pencil size={14} />
      </button>
      <button type="button" className="sortable-string-list__icon-btn" onClick={onRemove} aria-label="Remover">
        <Trash2 size={14} />
      </button>
    </li>
  )
}

export function SortableStringList({
  items,
  onChange,
  onRename,
  addLabel = 'Adicionar',
}: SortableStringListProps) {
  const [localItems, setLocalItems] = useState(items)
  const [newItem, setNewItem] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  const ids = localItems.map((item, i) => `${item}-${i}`)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const next = [...localItems]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved)
    setLocalItems(next)
    onChange(next)
  }

  function handleAdd() {
    const trimmed = newItem.trim()
    if (!trimmed || localItems.includes(trimmed)) return
    const next = [...localItems, trimmed]
    setLocalItems(next)
    onChange(next)
    setNewItem('')
  }

  function startEdit(index: number) {
    setEditingIndex(index)
    setEditDraft(localItems[index])
  }

  function commitEdit() {
    if (editingIndex == null) return
    const trimmed = editDraft.trim()
    if (!trimmed) return
    const oldValue = localItems[editingIndex]
    if (oldValue === trimmed) {
      setEditingIndex(null)
      return
    }
    if (onRename) {
      onRename(oldValue, trimmed)
      setEditingIndex(null)
      return
    }
    const next = [...localItems]
    next[editingIndex] = trimmed
    setLocalItems(next)
    onChange(next)
    setEditingIndex(null)
  }

  function handleRemove(index: number) {
    const next = localItems.filter((_, i) => i !== index)
    setLocalItems(next)
    onChange(next)
  }

  return (
    <div className="sortable-string-list">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="sortable-string-list__list">
            {localItems.map((item, index) => (
              <SortableItem
                key={ids[index]}
                id={ids[index]}
                value={item}
                onEdit={() => startEdit(index)}
                onRemove={() => handleRemove(index)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {editingIndex != null ? (
        <div className="sortable-string-list__edit-row">
          <Input
            label="Renomear"
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
          />
          <Button variant="secondary" onClick={commitEdit}>
            Salvar
          </Button>
          <Button variant="secondary" onClick={() => setEditingIndex(null)}>
            Cancelar
          </Button>
        </div>
      ) : null}

      <div className="sortable-string-list__add-row">
        <Input
          label={addLabel}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
        />
        <Button variant="secondary" onClick={handleAdd}>
          Adicionar
        </Button>
      </div>
    </div>
  )
}
