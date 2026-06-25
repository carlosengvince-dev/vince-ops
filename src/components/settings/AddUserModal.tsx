import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import {
  buildProfileInsertSql,
  createUserProfile,
  isProtectedPapel,
} from '../../lib/settingsUsers'
import { PAPEL_LABELS } from '../../lib/constants'
import type { Papel } from '../../types'
import './AddUserModal.css'

interface AddUserModalProps {
  open: boolean
  editablePapeis: Papel[]
  onClose: () => void
  onCreated: () => void
}

export function AddUserModal({ open, editablePapeis, onClose, onCreated }: AddUserModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<Papel>('projetista')
  const [uuid, setUuid] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep(1)
      setNome('')
      setEmail('')
      setPapel(editablePapeis[0] ?? 'projetista')
      setUuid('')
      setError(null)
      setLoading(false)
    }
  }, [open, editablePapeis])

  const sqlPreview = uuid.trim()
    ? buildProfileInsertSql(nome.trim() || '{nome}', papel, uuid.trim())
    : buildProfileInsertSql(nome.trim() || '{nome}', papel, '[UUID]')

  async function handleCopyEmail() {
    if (!email.trim()) return
    try {
      await navigator.clipboard.writeText(email.trim())
    } catch {
      // ignore
    }
  }

  async function handleCreateProfile() {
    if (isProtectedPapel(papel)) {
      setError('Este papel não pode ser atribuído.')
      return
    }
    if (!editablePapeis.includes(papel)) {
      setError('Você não tem permissão para criar usuário com este papel.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await createUserProfile(uuid, nome, papel)
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar perfil')
    } finally {
      setLoading(false)
    }
  }

  const canAdvanceStep1 = nome.trim().length > 0 && email.trim().length > 0
  const canCreate = uuid.trim().length > 0 && nome.trim().length > 0

  return (
    <Modal
      open={open}
      title="Adicionar usuário"
      onClose={() => {
        if (!loading) onClose()
      }}
      width="md"
      footer={
        step === 1 ? (
          <>
            <Button variant="secondary" disabled={loading} onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={!canAdvanceStep1 || loading} onClick={() => setStep(2)}>
              Já criei o usuário →
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" disabled={loading} onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button loading={loading} disabled={!canCreate} onClick={() => void handleCreateProfile()}>
              Criar perfil
            </Button>
          </>
        )
      }
    >
      <div className="add-user-modal">
        {step === 1 ? (
          <>
            <div className="add-user-modal__fields">
              <Input
                label="Nome"
                name="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <Input
                label="E-mail"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label className="add-user-modal__select-label">
                Papel
                <select
                  className="add-user-modal__select"
                  value={papel}
                  onChange={(e) => setPapel(e.target.value as Papel)}
                >
                  {editablePapeis.map((p) => (
                    <option key={p} value={p}>
                      {PAPEL_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="add-user-modal__instruction">
              <p>
                Acesse <strong>Authentication → Users → Add user</strong> no Supabase Dashboard e
                crie o usuário com este e-mail e senha <strong>@Vince2026</strong>
              </p>
              <div className="add-user-modal__email-copy">
                <code>{email.trim() || 'seu@email.com'}</code>
                <Button
                  variant="secondary"
                  disabled={!email.trim()}
                  onClick={() => void handleCopyEmail()}
                >
                  Copiar e-mail
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <Input
              label="UUID do usuário"
              name="uuid"
              value={uuid}
              placeholder="Cole o UUID criado no Supabase"
              onChange={(e) => setUuid(e.target.value)}
            />

            <div className="add-user-modal__sql">
              <span className="add-user-modal__sql-label">SQL de referência</span>
              <pre className="add-user-modal__sql-code">{sqlPreview}</pre>
            </div>
          </>
        )}

        {error ? (
          <p className="add-user-modal__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
