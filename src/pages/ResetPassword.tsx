import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabase'
import './Login.css'

export default function ResetPassword() {
  const { loading, passwordRecovery, clearPasswordRecovery } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="login-page">
        <p className="login-page__loading">Carregando…</p>
      </div>
    )
  }

  if (!passwordRecovery) {
    return <Navigate to="/login" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      clearPasswordRecovery()
      showToast('Senha alterada com sucesso')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar a senha.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__content">
        <img
          src="/logo-branca.svg"
          alt="VINCE Engenharia"
          className="login-page__logo"
          width={300}
          height={300}
        />

        <form className="login-page__form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <h1 className="login-page__title">Definir nova senha</h1>
          <p className="login-page__subtitle">Escolha uma senha com no mínimo 8 caracteres.</p>

          <Input
            label="Nova senha"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={submitting}
            autoFocus
          />

          <Input
            label="Confirmar nova senha"
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            disabled={submitting}
          />

          {error ? (
            <p className="login-page__error" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" fullWidth loading={submitting}>
            Salvar nova senha
          </Button>
        </form>
      </div>
    </div>
  )
}
