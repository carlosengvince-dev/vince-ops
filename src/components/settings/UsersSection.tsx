import { useCallback, useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { hasPermissao, PAPEL_LABELS } from '../../lib/constants'
import {
  canActorAssignPapel,
  canActorEditUserPapel,
  deactivateUser,
  fetchSettingsUsers,
  getEditablePapeisForActor,
  isProtectedPapel,
  papelAvatarClass,
  updateUserPapel,
  type SettingsUserRow,
} from '../../lib/settingsUsers'
import { getInitials } from '../../lib/utils'
import type { Papel } from '../../types'
import { AddUserModal } from './AddUserModal'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import './UsersSection.css'

function PapelBadge({ papel }: { papel: Papel }) {
  if (papel === 'diretor_executivo') {
    return (
      <span className="users-section__badge users-section__badge--diretor_executivo">
        <Shield size={12} aria-hidden />
        {PAPEL_LABELS[papel]}
      </span>
    )
  }
  return <span className={`users-section__badge users-section__badge--${papel}`}>{PAPEL_LABELS[papel]}</span>
}

export function UsersSection() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<SettingsUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftPapel, setDraftPapel] = useState<Papel>('projetista')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<SettingsUserRow | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const editablePapeis = profile ? getEditablePapeisForActor(profile.papel) : []

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchSettingsUsers()
      setUsers(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function canEditPapel(user: SettingsUserRow): boolean {
    if (!profile) return false
    return canActorEditUserPapel(profile.papel, user.papel)
  }

  function canDeactivate(user: SettingsUserRow): boolean {
    if (!profile) return false
    if (isProtectedPapel(user.papel)) return false
    if (profile.id === user.id) return false
    return hasPermissao(profile.papel, 'acessar_configuracoes')
  }

  async function handleSavePapel(userId: string) {
    if (!profile || !canActorAssignPapel(profile.papel, draftPapel)) {
      setError('Você não tem permissão para atribuir este papel.')
      return
    }

    setSavingId(userId)
    try {
      await updateUserPapel(userId, draftPapel)
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar papel')
    } finally {
      setSavingId(null)
    }
  }

  async function handleConfirmDeactivate() {
    if (!deactivateTarget || isProtectedPapel(deactivateTarget.papel)) return
    setDeactivating(true)
    try {
      await deactivateUser(deactivateTarget.id)
      setDeactivateTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar usuário')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <section className="users-section">
      <div className="users-section__head">
        <div>
          <h2 className="users-section__title">Usuários</h2>
          <p className="users-section__subtitle">Gerencie papéis e acesso da equipe.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>Adicionar usuário</Button>
      </div>

      {error ? (
        <p className="users-section__error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="users-section__status">Carregando usuários…</p>
      ) : users.length === 0 ? (
        <p className="users-section__status">Nenhum usuário ativo.</p>
      ) : (
        <ul className="users-section__list">
          {users.map((user) => (
            <li key={user.id} className="users-section__item">
              <span className={`users-section__avatar ${papelAvatarClass(user.papel)}`}>
                {getInitials(user.nome)}
              </span>

              <div className="users-section__info">
                <span className="users-section__name">{user.nome}</span>
                <span className="users-section__email">{user.email ?? '—'}</span>
              </div>

              <div className="users-section__papel">
                {editingId === user.id ? (
                  <div className="users-section__edit-row">
                    <select
                      className="users-section__select"
                      value={draftPapel}
                      disabled={savingId === user.id}
                      onChange={(e) => setDraftPapel(e.target.value as Papel)}
                    >
                      {editablePapeis.map((p) => (
                        <option key={p} value={p}>
                          {PAPEL_LABELS[p]}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      loading={savingId === user.id}
                      onClick={() => void handleSavePapel(user.id)}
                    >
                      Salvar
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={savingId === user.id}
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <PapelBadge papel={user.papel} />
                )}
              </div>

              <div className="users-section__actions">
                {canEditPapel(user) && editingId !== user.id ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingId(user.id)
                      setDraftPapel(
                        editablePapeis.includes(user.papel) ? user.papel : editablePapeis[0],
                      )
                    }}
                  >
                    Editar papel
                  </Button>
                ) : null}
                {canDeactivate(user) ? (
                  <Button variant="secondary" onClick={() => setDeactivateTarget(user)}>
                    Desativar
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddUserModal
        open={addOpen}
        editablePapeis={editablePapeis}
        onClose={() => setAddOpen(false)}
        onCreated={() => void load()}
      />

      <ConfirmModal
        isOpen={deactivateTarget != null}
        title="Desativar usuário"
        message={
          deactivateTarget
            ? `Desativar ${deactivateTarget.nome}? O usuário não poderá mais acessar o sistema.`
            : ''
        }
        confirmLabel="Desativar"
        variant="danger"
        loading={deactivating}
        onConfirm={() => void handleConfirmDeactivate()}
        onCancel={() => {
          if (!deactivating) setDeactivateTarget(null)
        }}
      />
    </section>
  )
}
