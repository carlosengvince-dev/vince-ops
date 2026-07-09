import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../../hooks/useToast'
import {
  CONFIG_SNAPSHOT_ESCOPO_LABELS,
  fetchConfigSnapshots,
  formatRestaurarSnapshotToast,
  formatSnapshotDate,
  invalidateConfigCacheForEscopo,
  restaurarConfigSnapshot,
  type ConfigSnapshotRow,
  type ConfigSnapshotTabEscopo,
} from '../../lib/configSnapshot'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Modal } from '../ui/Modal'
import './RestoreScopeModal.css'

interface RestoreScopeModalProps {
  open: boolean
  escopo: ConfigSnapshotTabEscopo
  onClose: () => void
  onRestored: () => void | Promise<void>
  onRefreshContext?: () => Promise<void>
}

export function RestoreScopeModal({
  open,
  escopo,
  onClose,
  onRestored,
  onRefreshContext,
}: RestoreScopeModalProps) {
  const { showToast } = useToast()
  const [snapshots, setSnapshots] = useState<ConfigSnapshotRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<ConfigSnapshotRow | null>(null)
  const [restoring, setRestoring] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchConfigSnapshots()
      setSnapshots(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar snapshots')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setConfirmTarget(null)
      return
    }
    void load()
  }, [load, open])

  async function handleConfirmRestore() {
    if (!confirmTarget) return

    setRestoring(true)
    try {
      const result = await restaurarConfigSnapshot(confirmTarget.id, escopo)
      invalidateConfigCacheForEscopo(escopo)
      if (onRefreshContext) await onRefreshContext()
      await onRestored()
      showToast(formatRestaurarSnapshotToast(result, escopo))
      setConfirmTarget(null)
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao restaurar', 'error')
    } finally {
      setRestoring(false)
    }
  }

  const escopoLabel = CONFIG_SNAPSHOT_ESCOPO_LABELS[escopo]

  return (
    <>
      <Modal
        open={open && confirmTarget == null}
        title="Restaurar desta aba"
        onClose={() => {
          if (!restoring) onClose()
        }}
        width="md"
      >
        <p className="restore-scope-modal__hint">
          Escolha um padrão salvo para restaurar apenas {escopoLabel}.
        </p>

        {error ? <p className="restore-scope-modal__error">{error}</p> : null}

        {loading ? (
          <p className="restore-scope-modal__status">Carregando…</p>
        ) : snapshots.length === 0 ? (
          <p className="restore-scope-modal__empty">Nenhum padrão salvo ainda.</p>
        ) : (
          <ul className="restore-scope-modal__list">
            {snapshots.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="restore-scope-modal__item"
                  onClick={() => setConfirmTarget(row)}
                >
                  <span className="restore-scope-modal__item-name">
                    {row.nome}
                    {row.automatico ? (
                      <span className="restore-scope-modal__badge">Automático</span>
                    ) : null}
                  </span>
                  <span className="restore-scope-modal__item-date">
                    {formatSnapshotDate(row.created_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmTarget != null}
        title="Restaurar desta aba"
        message={
          confirmTarget
            ? `Restaurar apenas ${escopoLabel} de '${confirmTarget.nome}'? As demais configurações não serão alteradas. Um backup automático será criado antes.`
            : ''
        }
        confirmLabel="Restaurar"
        variant="warning"
        loading={restoring}
        onConfirm={() => void handleConfirmRestore()}
        onCancel={() => {
          if (!restoring) setConfirmTarget(null)
        }}
      />
    </>
  )
}
