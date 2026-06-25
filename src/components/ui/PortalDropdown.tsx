import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import './PortalDropdown.css'

export const PORTAL_DROPDOWN_OPEN_UP_THRESHOLD_PX = 150
const GAP_PX = 4

export type PortalDropdownAlign = 'end' | 'start' | 'stretch'
export type PortalDropdownSize = 'menu' | 'status'

interface PortalDropdownProps {
  open: boolean
  triggerRef: RefObject<HTMLElement | null>
  onClose: () => void
  className?: string
  align?: PortalDropdownAlign
  size?: PortalDropdownSize
  children: ReactNode
}

export function PortalDropdown({
  open,
  triggerRef,
  onClose,
  className = '',
  align = 'end',
  size,
  children,
}: PortalDropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return

    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return

    function positionPanel() {
      const triggerEl = triggerRef.current
      const panelEl = panelRef.current
      if (!triggerEl || !panelEl) return

      const rect = triggerEl.getBoundingClientRect()
      const dropdownHeight = panelEl.offsetHeight
      const dropdownWidth = panelEl.offsetWidth
      const spaceBelow = window.innerHeight - rect.bottom

      let top: number
      if (spaceBelow < PORTAL_DROPDOWN_OPEN_UP_THRESHOLD_PX) {
        top = rect.top - dropdownHeight - GAP_PX
      } else {
        top = rect.bottom + GAP_PX
      }

      let left: number
      if (align === 'start' || align === 'stretch') {
        left = rect.left
      } else {
        left = rect.right - dropdownWidth
      }
      panelEl.style.width = ''
      panelEl.style.maxWidth = ''

      const maxTop = window.innerHeight - dropdownHeight - GAP_PX
      const maxLeft = window.innerWidth - dropdownWidth - GAP_PX
      top = Math.min(Math.max(GAP_PX, top), maxTop)
      left = Math.min(Math.max(GAP_PX, left), maxLeft)

      panelEl.style.position = 'fixed'
      panelEl.style.top = `${top}px`
      panelEl.style.left = `${left}px`
      panelEl.style.zIndex = '1000'
    }

    positionPanel()
    const raf = requestAnimationFrame(positionPanel)

    window.addEventListener('resize', positionPanel)
    window.addEventListener('scroll', positionPanel, true)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', positionPanel)
      window.removeEventListener('scroll', positionPanel, true)
    }
  }, [open, align, size, triggerRef, children])

  useEffect(() => {
    if (!open) return

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      onClose()
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open, onClose, triggerRef])

  if (!open) return null

  const sizeClass = size ? `portal-dropdown--${size}` : ''

  return createPortal(
    <div ref={panelRef} className={`portal-dropdown ${sizeClass} ${className}`.trim()}>
      {children}
    </div>,
    document.body,
  )
}
