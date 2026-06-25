import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  requestEmailChange,
  updateOwnPassword,
  updateOwnProfileNome,
} from '../../lib/settingsAccount'
import { PAPEL_LABELS } from '../../lib/constants'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import './MyAccountSection.css'

export function MyAccountSection() {
  const { user, profile, refreshProfile } = useAuth()
  const [nome, setNome] = useState(profile?.nome ?? '')
  const [savingNome, setSavingNome] = useState(false)
  const [nomeError, setNomeError] = useState<string | null>(null)
  const [nomeSaved, setNomeSaved] = useState(false)

  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)

  useEffect(() => {
    setNome(profile?.nome ?? '')
  }, [profile?.nome])

  if (!profile) return null

  const currentEmail = user?.email ?? '—'

  async function handleSaveNome() {
    if (nome.trim() === profile!.nome) return
    setSavingNome(true)
    setNomeError(null)
    setNomeSaved(false)
    try {
      await updateOwnProfileNome(profile!.id, nome)
      await refreshProfile()
      setNomeSaved(true)
    } catch (err) {
      setNomeError(err instanceof Error ? err.message : 'Erro ao salvar nome')
    } finally {
      setSavingNome(false)
    }
  }

  async function handleEmailChange() {
    setEmailError(null)
    setEmailSuccess(null)

    const trimmed = newEmail.trim().toLowerCase()
    const confirm = confirmEmail.trim().toLowerCase()

    if (!trimmed || !confirm) {
      setEmailError('Preencha os dois campos de e-mail.')
      return
    }
    if (trimmed !== confirm) {
      setEmailError('Os e-mails não coincidem.')
      return
    }
    if (trimmed === currentEmail.toLowerCase()) {
      setEmailError('O novo e-mail é igual ao atual.')
      return
    }

    setEmailLoading(true)
    try {
      await requestEmailChange(trimmed)
      setEmailSuccess('Verifique sua caixa de entrada e clique no link de confirmação.')
      setNewEmail('')
      setConfirmEmail('')
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Erro ao solicitar troca de e-mail')
    } finally {
      setEmailLoading(false)
    }
  }

  async function handlePasswordChange() {
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword.length < 8) {
      setPasswordError('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    setPasswordLoading(true)
    try {
      await updateOwnPassword(newPassword)
      setPasswordSuccess('Senha alterada com sucesso.')
      setNewPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Erro ao alterar senha')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <section className="my-account">
      <div className="my-account__head">
        <h2 className="my-account__title">Minha conta</h2>
        <p className="my-account__subtitle">Gerencie seus dados de acesso.</p>
      </div>

      <div className="my-account__card">
        <div className="my-account__field">
          <label className="my-account__label" htmlFor="my-account-nome">
            Nome
          </label>
          <div className="my-account__nome-row">
            <input
              id="my-account-nome"
              className="my-account__input"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                setNomeSaved(false)
              }}
            />
            <Button
              variant="secondary"
              loading={savingNome}
              disabled={nome.trim() === profile.nome}
              onClick={() => void handleSaveNome()}
            >
              Salvar
            </Button>
          </div>
          {nomeError ? (
            <p className="my-account__error" role="alert">
              {nomeError}
            </p>
          ) : null}
          {nomeSaved ? <p className="my-account__success">Nome atualizado.</p> : null}
        </div>

        <div className="my-account__field">
          <span className="my-account__label">Papel</span>
          <span className="my-account__readonly">{PAPEL_LABELS[profile.papel]}</span>
        </div>

        <div className="my-account__field">
          <span className="my-account__label">E-mail atual</span>
          <span className="my-account__readonly">{currentEmail}</span>
          <Button variant="secondary" onClick={() => setEmailModalOpen(true)}>
            Alterar e-mail
          </Button>
        </div>

        <div className="my-account__field">
          <span className="my-account__label">Senha</span>
          <Button variant="secondary" onClick={() => setPasswordModalOpen(true)}>
            Alterar senha
          </Button>
        </div>
      </div>

      <Modal
        open={emailModalOpen}
        title="Alterar e-mail"
        onClose={() => {
          if (!emailLoading) setEmailModalOpen(false)
        }}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={emailLoading}
              onClick={() => setEmailModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button loading={emailLoading} onClick={() => void handleEmailChange()}>
              Confirmar
            </Button>
          </>
        }
      >
        <div className="my-account__modal">
          <p className="my-account__modal-hint">
            Um link de confirmação será enviado para o novo e-mail. A troca só é efetivada após a
            confirmação.
          </p>
          <Input
            label="Novo e-mail"
            type="email"
            name="new_email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <Input
            label="Confirmar novo e-mail"
            type="email"
            name="confirm_email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
          />
          {emailError ? (
            <p className="my-account__error" role="alert">
              {emailError}
            </p>
          ) : null}
          {emailSuccess ? (
            <p className="my-account__success" role="status">
              {emailSuccess}
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={passwordModalOpen}
        title="Alterar senha"
        onClose={() => {
          if (!passwordLoading) setPasswordModalOpen(false)
        }}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={passwordLoading}
              onClick={() => setPasswordModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button loading={passwordLoading} onClick={() => void handlePasswordChange()}>
              Confirmar
            </Button>
          </>
        }
      >
        <div className="my-account__modal">
          <Input
            label="Nova senha"
            type="password"
            name="new_password"
            value={newPassword}
            minLength={8}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          {passwordError ? (
            <p className="my-account__error" role="alert">
              {passwordError}
            </p>
          ) : null}
          {passwordSuccess ? (
            <p className="my-account__success" role="status">
              {passwordSuccess}
            </p>
          ) : null}
        </div>
      </Modal>
    </section>
  )
}
