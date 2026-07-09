import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { canManageConfigSnapshots, type ConfigSnapshotTabEscopo } from '../../lib/configSnapshot'
import { RestoreScopeModal } from './RestoreScopeModal'
import './RestoreScopeAction.css'

interface RestoreScopeActionProps {
  escopo: ConfigSnapshotTabEscopo
  onRestored: () => void | Promise<void>
  onRefreshContext?: () => Promise<void>
}

export function RestoreScopeAction({ escopo, onRestored, onRefreshContext }: RestoreScopeActionProps) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)

  if (!profile || !canManageConfigSnapshots(profile.papel)) {
    return null
  }

  return (
    <>
      <button
        type="button"
        className="restore-scope-action"
        onClick={() => setOpen(true)}
      >
        Restaurar desta aba…
      </button>

      <RestoreScopeModal
        open={open}
        escopo={escopo}
        onClose={() => setOpen(false)}
        onRestored={onRestored}
        onRefreshContext={onRefreshContext}
      />
    </>
  )
}
