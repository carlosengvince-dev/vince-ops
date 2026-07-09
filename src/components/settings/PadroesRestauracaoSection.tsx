import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useDisciplinasConfig } from '../../contexts/DisciplinasConfigContext'
import { useFasesConfig } from '../../contexts/FasesConfigContext'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import {
  canManageConfigSnapshots,
  deleteConfigSnapshot,
  fetchConfigSnapshots,
  formatRestaurarSnapshotToast,
  formatSnapshotDate,
  invalidateAllConfigCaches,
  renameConfigSnapshot,
  restaurarConfigSnapshot,
  salvarConfigSnapshot,
  type ConfigSnapshotRow,
} from '../../lib/configSnapshot'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { SnapshotRowMenu } from './SnapshotRowMenu'
import './PadroesRestauracaoSection.css'
import './SettingsSubsection.css'

export function PadroesRestauracaoSection() {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const { refresh: refreshDisciplinas } = useDisciplinasConfig()
  const { refresh: refreshFases } = useFasesConfig()

  const [snapshots, setSnapshots] = useState<ConfigSnapshotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveNome, setSaveNome] = useState('')
  const [saving, setSaving] = useState(false)

  const [restoreTarget, setRestoreTarget] = useState<ConfigSnapshotRow | null>(null)
  const [restoring, setRestoring] = useState(false)

  const [renameTarget, setRenameTarget] = useState<ConfigSnapshotRow | null>(null)
  const [renameNome, setRenameNome] = useState('')
  const [renaming, setRenaming] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ConfigSnapshotRow | null>(null)
  const [deleting, setDeleting] = useState(false)

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
    void load()
  }, [load])

  if (!profile) return null

  if (!canManageConfigSnapshots(profile.papel)) {
    return <Navigate to="/configuracoes/sistema/documentos" replace />
  }

  async function handleSaveSnapshot() {
    const nome = saveNome.trim()
    if (!nome) return

    setSaving(true)
    try {
      await salvarConfigSnapshot(nome, false)
      showToast('Padrão salvo')
      setSaveModalOpen(false)
      setSaveNome('')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar padrão', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmRestore() {
    if (!restoreTarget) return

    setRestoring(true)
    try {
      const result = await restaurarConfigSnapshot(restoreTarget.id, 'tudo')
      invalidateAllConfigCaches()
      await Promise.all([refreshDisciplinas(), refreshFases()])
      showToast(formatRestaurarSnapshotToast(result, 'tudo'))
      setRestoreTarget(null)
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao restaurar', 'error')
    } finally {
      setRestoring(false)
    }
  }

  async function handleConfirmRename() {
    if (!renameTarget) return
    const nome = renameNome.trim()
    if (!nome) return

    setRenaming(true)
    try {
      await renameConfigSnapshot(renameTarget.id, nome)
      showToast('Padrão renomeado')
      setRenameTarget(null)
      setRenameNome('')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao renomear', 'error')
    } finally {
      setRenaming(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      await deleteConfigSnapshot(deleteTarget.id)
      showToast('Padrão excluído')
      setDeleteTarget(null)
      setSnapshots((prev) => prev.filter((row) => row.id !== deleteTarget.id))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao excluir', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="settings-subsection">
      <div className="settings-subsection__head">
        <div>
          <h2 className="settings-subsection__title">Padrões e restauração</h2>
          <p className="settings-subsection__hint">
            Salve o estado atual de disciplinas, fases, categorias, templates e configurações
            gerais. Restaurar um padrão cria automaticamente um backup do estado atual antes de
            aplicar.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setSaveNome('')
            setSaveModalOpen(true)
          }}
        >
          Salvar configuração atual como padrão
        </Button>
      </div>

      {error ? <p className="settings-subsection__error">{error}</p> : null}

      {loading ? (
        <p className="settings-subsection__status">Carregando…</p>
      ) : (
        <div className="padroes-restauracao__table-wrap">
          <table className="padroes-restauracao__table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Data/hora</th>
                <th>Autor</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className="padroes-restauracao__empty">Nenhum padrão salvo ainda.</p>
                  </td>
                </tr>
              ) : (
                snapshots.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="padroes-restauracao__nome">{row.nome}</span>
                      {row.automatico ? (
                        <span className="padroes-restauracao__badge">Automático</span>
                      ) : null}
                    </td>
                    <td>{formatSnapshotDate(row.created_at)}</td>
                    <td>{row.autor_nome ?? '—'}</td>
                    <td>
                      <div className="padroes-restauracao__actions">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setRestoreTarget(row)}
                        >
                          Restaurar
                        </Button>
                        <SnapshotRowMenu
                          onRename={() => {
                            setRenameTarget(row)
                            setRenameNome(row.nome)
                          }}
                          onDelete={() => setDeleteTarget(row)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={saveModalOpen}
        title="Salvar padrão"
        onClose={() => {
          if (!saving) setSaveModalOpen(false)
        }}
      >
        <Input
          label="Nome do padrão"
          id="snapshot-nome"
          value={saveNome}
          onChange={(e) => setSaveNome(e.target.value)}
          placeholder="Padrão VINCE 2026"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && saveNome.trim() && !saving) {
              void handleSaveSnapshot()
            }
          }}
        />
        <div className="padroes-restauracao__modal-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => setSaveModalOpen(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={saving || !saveNome.trim()} onClick={() => void handleSaveSnapshot()}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </Modal>

      <Modal
        open={renameTarget != null}
        title="Renomear padrão"
        onClose={() => {
          if (!renaming) setRenameTarget(null)
        }}
      >
        <Input
          label="Novo nome"
          id="snapshot-rename"
          value={renameNome}
          onChange={(e) => setRenameNome(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && renameNome.trim() && !renaming) {
              void handleConfirmRename()
            }
          }}
        />
        <div className="padroes-restauracao__modal-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={renaming}
            onClick={() => setRenameTarget(null)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={renaming || !renameNome.trim()}
            onClick={() => void handleConfirmRename()}
          >
            {renaming ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={restoreTarget != null}
        title="Restaurar padrão"
        message={
          restoreTarget
            ? `Restaurar '${restoreTarget.nome}'? A configuração atual será substituída. Um backup automático do estado atual será criado antes.`
            : ''
        }
        confirmLabel="Restaurar"
        variant="danger"
        loading={restoring}
        onConfirm={() => void handleConfirmRestore()}
        onCancel={() => {
          if (!restoring) setRestoreTarget(null)
        }}
      />

      <ConfirmModal
        isOpen={deleteTarget != null}
        title="Excluir padrão"
        message={
          deleteTarget
            ? `Excluir '${deleteTarget.nome}' definitivamente? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
      />
    </section>
  )
}
