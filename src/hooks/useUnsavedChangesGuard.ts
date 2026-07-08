import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'

interface UseUnsavedChangesGuardOptions {
  isDirty: boolean
  onSave: () => Promise<void>
  onDiscard: () => void
  message?: string
  /** When false, navigation blocking is disabled (e.g. while data is still loading). */
  enabled?: boolean
}

export function useUnsavedChangesGuard({
  isDirty,
  onSave,
  onDiscard,
  message = 'Você tem alterações não salvas. Deseja salvar antes de sair?',
  enabled = true,
}: UseUnsavedChangesGuardOptions) {
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)

  const shouldBlock = enabled && isDirty

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      shouldBlock && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!shouldBlock) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [shouldBlock])

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setModalOpen(true)
    }
  }, [blocker.state])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    pendingActionRef.current = null
    if (blocker.state === 'blocked') {
      blocker.reset()
    }
  }, [blocker])

  const proceedAfterLeave = useCallback(() => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    setModalOpen(false)
    if (blocker.state === 'blocked') {
      blocker.proceed()
    }
    action?.()
  }, [blocker])

  const handleSaveAndLeave = useCallback(async () => {
    setSaving(true)
    try {
      await onSave()
      proceedAfterLeave()
    } finally {
      setSaving(false)
    }
  }, [onSave, proceedAfterLeave])

  const handleDiscard = useCallback(() => {
    onDiscard()
    proceedAfterLeave()
  }, [onDiscard, proceedAfterLeave])

  const confirmIfDirty = useCallback(
    (action: () => void) => {
      if (!shouldBlock) {
        action()
        return
      }
      pendingActionRef.current = action
      setModalOpen(true)
    },
    [shouldBlock],
  )

  return {
    modalOpen,
    saving,
    message,
    handleSaveAndLeave,
    handleDiscard,
    handleCancel: closeModal,
    confirmIfDirty,
  }
}
