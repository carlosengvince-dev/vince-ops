import { useEffect, useState, type ReactNode } from 'react'
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
import { reorderTarefas } from '../../lib/tarefaManagement'
import type { Papel, Tarefa, TarefaStatus } from '../../types'
import { TaskRow } from './TaskRow'
import './SortableTaskList.css'

interface SortableTaskListProps {
  items: Tarefa[]
  canReorder: boolean
  canManage: boolean
  papel: Papel
  taskTimerTotals: Record<string, number>
  onStatusChange: (tarefaId: string, status: TarefaStatus, motivo?: string) => Promise<void>
  onAssigneeChange: (tarefaId: string, responsavelId: string | null) => Promise<void>
  onEdit: (tarefa: Tarefa) => void
  onMove: (tarefa: Tarefa) => void
  onDelete: (tarefa: Tarefa) => void
  onReorder: (orderedIds: string[]) => void
  expandedTarefaId?: string | null
  readOnly?: boolean
}

export function SortableTaskList({
  items,
  canReorder,
  canManage,
  papel,
  taskTimerTotals,
  onStatusChange,
  onAssigneeChange,
  onEdit,
  onMove,
  onDelete,
  onReorder,
  expandedTarefaId = null,
  readOnly = false,
}: SortableTaskListProps) {
  const [localItems, setLocalItems] = useState(items)

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  const itemIds = localItems.map((t) => t.id)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localItems.findIndex((t) => t.id === active.id)
    const newIndex = localItems.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = reorderTarefas(localItems, oldIndex, newIndex)
    setLocalItems(reordered)
    onReorder(reordered.map((t) => t.id))
  }

  if (!canReorder) {
    return (
      <div className="sortable-task-list">
        {items.map((t) => (
          <TaskRow
            key={t.id}
            tarefa={t}
            papel={papel}
            canManage={canManage}
            readOnly={readOnly}
            taskTimerSeconds={taskTimerTotals[t.id] ?? 0}
            onStatusChange={onStatusChange}
            onAssigneeChange={onAssigneeChange}
            onEdit={() => onEdit(t)}
            onMove={() => onMove(t)}
            onDelete={() => onDelete(t)}
          />
        ))}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="sortable-task-list">
          {localItems.map((t) => (
            <SortableTaskItem key={t.id} id={t.id}>
              <TaskRow
                tarefa={t}
                papel={papel}
                canManage={canManage}
                readOnly={readOnly}
                taskTimerSeconds={taskTimerTotals[t.id] ?? 0}
                initialExpanded={expandedTarefaId === t.id}
                onStatusChange={onStatusChange}
                onAssigneeChange={onAssigneeChange}
                onEdit={() => onEdit(t)}
                onMove={() => onMove(t)}
                onDelete={() => onDelete(t)}
              />
            </SortableTaskItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableTaskItem({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-task-list__item${isDragging ? ' sortable-task-list__item--dragging' : ''}`}
    >
      <button
        type="button"
        className="sortable-task-list__handle"
        aria-label="Reordenar tarefa"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <div className="sortable-task-list__content">{children}</div>
    </div>
  )
}
