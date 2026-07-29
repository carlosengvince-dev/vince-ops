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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import './SortableCategoryList.css'

export interface CategorySectionItem {
  id: string
  title: string
  count: number
  collapsed: boolean
  content: ReactNode
}

interface SortableCategoryListProps {
  items: CategorySectionItem[]
  canReorder: boolean
  onReorder: (orderedIds: string[]) => void
  onToggleCollapse: (id: string) => void
}

export function SortableCategoryList({
  items,
  canReorder,
  onReorder,
  onToggleCollapse,
}: SortableCategoryListProps) {
  const [localItems, setLocalItems] = useState(items)

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  const itemIds = localItems.map((c) => c.id)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localItems.findIndex((c) => c.id === active.id)
    const newIndex = localItems.findIndex((c) => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(localItems, oldIndex, newIndex)
    setLocalItems(reordered)
    onReorder(reordered.map((c) => c.id))
  }

  const list = canReorder ? localItems : items

  if (!canReorder) {
    return (
      <div className="sortable-category-list">
        {list.map((cat) => (
          <CategorySection
            key={cat.id}
            item={cat}
            showHandle={false}
            onToggle={() => onToggleCollapse(cat.id)}
          />
        ))}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="sortable-category-list">
          {list.map((cat) => (
            <SortableCategorySection
              key={cat.id}
              item={cat}
              onToggle={() => onToggleCollapse(cat.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableCategorySection({
  item,
  onToggle,
}: {
  item: CategorySectionItem
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-category-list__item${isDragging ? ' sortable-category-list__item--dragging' : ''}`}
    >
      <CategorySection
        item={item}
        showHandle
        onToggle={onToggle}
        handleAttributes={attributes}
        handleListeners={listeners}
      />
    </div>
  )
}

function CategorySection({
  item,
  showHandle,
  onToggle,
  handleAttributes,
  handleListeners,
}: {
  item: CategorySectionItem
  showHandle: boolean
  onToggle: () => void
  handleAttributes?: ReturnType<typeof useSortable>['attributes']
  handleListeners?: ReturnType<typeof useSortable>['listeners']
}) {
  return (
    <section className="checklist-panel__section sortable-category-list__section">
      <div className="sortable-category-list__header">
        {showHandle ? (
          <button
            type="button"
            className="sortable-category-list__handle"
            aria-label={`Reordenar categoria ${item.title}`}
            {...(handleAttributes ?? {})}
            {...(handleListeners ?? {})}
          >
            <GripVertical size={16} />
          </button>
        ) : null}
        <button
          type="button"
          className="sortable-category-list__title-btn"
          aria-expanded={!item.collapsed}
          onClick={onToggle}
        >
          <span className="sortable-category-list__chevron" aria-hidden>
            {item.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </span>
          <h2 className="checklist-panel__section-title sortable-category-list__title">
            {item.title}
          </h2>
          <span className="sortable-category-list__count">{item.count}</span>
        </button>
      </div>
      {!item.collapsed ? item.content : null}
    </section>
  )
}
