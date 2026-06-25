import { useEffect, useMemo, useState } from 'react'
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
import { TAREFA_ORIGEM_OPTIONS } from '../../lib/tarefaManagement'
import type { TemplateChecklist } from '../../types'
import { TemplateRowMenu } from './TemplateRowMenu'
import './SortableTemplateList.css'

interface SortableTemplateListProps {
  items: TemplateChecklist[]
  onEdit: (template: TemplateChecklist) => void
  onToggleAtivo: (template: TemplateChecklist) => void
  onDelete: (template: TemplateChecklist) => void
  onReorder: (orderedIds: string[]) => void
}

function TemplateBadges({ template }: { template: TemplateChecklist }) {
  const origemLabel =
    TAREFA_ORIGEM_OPTIONS.find((o) => o.value === template.origem)?.label ?? template.origem

  return (
    <>
      <span
        className={`sortable-template-list__badge sortable-template-list__badge--${template.criticidade}`}
      >
        {template.criticidade === 'critico' ? 'Crítico' : 'Normal'}
      </span>
      <span
        className={`sortable-template-list__badge sortable-template-list__badge--origem-${template.origem.toLowerCase()}`}
      >
        {origemLabel}
      </span>
      {!template.ativo ? (
        <span className="sortable-template-list__badge sortable-template-list__badge--inativa">
          Inativa
        </span>
      ) : null}
    </>
  )
}

function SortableRow({
  template,
  onEdit,
  onToggleAtivo,
  onDelete,
}: {
  template: TemplateChecklist
  onEdit: () => void
  onToggleAtivo: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: template.id,
  })

  return (
    <li
      ref={setNodeRef}
      className={`sortable-template-list__item sortable-template-list__item--active${isDragging ? ' sortable-template-list__item--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="sortable-template-list__handle"
        {...attributes}
        {...listeners}
        aria-label="Reordenar"
      >
        <GripVertical size={14} />
      </button>
      <div className="sortable-template-list__body">
        <span className="sortable-template-list__nome">{template.nome}</span>
        <TemplateBadges template={template} />
      </div>
      <TemplateRowMenu
        ativo={template.ativo}
        onEdit={onEdit}
        onToggleAtivo={onToggleAtivo}
        onDelete={onDelete}
      />
    </li>
  )
}

function InactiveRow({
  template,
  onEdit,
  onToggleAtivo,
  onDelete,
}: {
  template: TemplateChecklist
  onEdit: () => void
  onToggleAtivo: () => void
  onDelete: () => void
}) {
  return (
    <li className="sortable-template-list__item sortable-template-list__item--inactive">
      <span className="sortable-template-list__handle sortable-template-list__handle--spacer" aria-hidden />
      <div className="sortable-template-list__body">
        <span className="sortable-template-list__nome">{template.nome}</span>
        <TemplateBadges template={template} />
      </div>
      <TemplateRowMenu
        ativo={template.ativo}
        onEdit={onEdit}
        onToggleAtivo={onToggleAtivo}
        onDelete={onDelete}
      />
    </li>
  )
}

export function SortableTemplateList({
  items,
  onEdit,
  onToggleAtivo,
  onDelete,
  onReorder,
}: SortableTemplateListProps) {
  const activeItems = useMemo(
    () => items.filter((t) => t.ativo).sort((a, b) => a.ordem - b.ordem),
    [items],
  )
  const inactiveItems = useMemo(
    () => items.filter((t) => !t.ativo).sort((a, b) => a.ordem - b.ordem),
    [items],
  )

  const [localActive, setLocalActive] = useState(activeItems)

  useEffect(() => {
    setLocalActive(activeItems)
  }, [activeItems])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = localActive.findIndex((t) => t.id === active.id)
    const newIndex = localActive.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = [...localActive]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved)
    setLocalActive(next)
    onReorder(next.map((t) => t.id))
  }

  if (items.length === 0) {
    return <p className="sortable-template-list__empty">Nenhuma tarefa nesta categoria.</p>
  }

  return (
    <div className="sortable-template-list__groups">
      {activeItems.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={localActive.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="sortable-template-list">
              {localActive.map((template) => (
                <SortableRow
                  key={template.id}
                  template={template}
                  onEdit={() => onEdit(template)}
                  onToggleAtivo={() => onToggleAtivo(template)}
                  onDelete={() => onDelete(template)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : null}

      {inactiveItems.length > 0 ? (
        <div className="sortable-template-list__inactive-group">
          <p className="sortable-template-list__inactive-label">Inativas</p>
          <ul className="sortable-template-list">
            {inactiveItems.map((template) => (
              <InactiveRow
                key={template.id}
                template={template}
                onEdit={() => onEdit(template)}
                onToggleAtivo={() => onToggleAtivo(template)}
                onDelete={() => onDelete(template)}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
