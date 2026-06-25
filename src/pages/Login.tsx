import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import './Login.css'

type FormFeedback = {
  type: 'success' | 'error'
  message: string
}

export default function Login() {
  const { login, loading, error, clearError, profile, session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [feedback, setFeedback] = useState<FormFeedback | null>(null)

  useEffect(() => {
    clearError()
    setFeedback(null)
  }, [email, password, clearError])

  if (!loading && session && profile) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)

    try {
      await login(email, password)
    } catch {
      // erro exibido via useAuth.error
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPassword() {
    clearError()

    if (!email.trim()) {
      setFeedback({
        type: 'error',
        message: 'Digite seu e-mail antes de solicitar a recuperação.',
      })
      return
    }

    setResetting(true)
    setFeedback(null)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      })

      if (resetError) {
        throw resetError
      }

      setFeedback({
        type: 'success',
        message: 'Enviamos um link de recuperação para seu e-mail.',
      })
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao solicitar recuperação de senha.',
      })
    } finally {
      setResetting(false)
    }
  }

  if (loading && !submitting) {
    return (
      <div className="login-page">
        <p className="login-page__loading">Carregando…</p>
      </div>
    )
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

        <form className="login-page__form" onSubmit={handleSubmit} noValidate>
          <Input
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />

          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
          />

          {error ? (
            <p className="login-page__error" role="alert">
              {error}
            </p>
          ) : null}

          {feedback ? (
            <p
              className={
                feedback.type === 'success'
                  ? 'login-page__success'
                  : 'login-page__error'
              }
              role="status"
            >
              {feedback.message}
            </p>
          ) : null}

          <Button type="submit" fullWidth loading={submitting} disabled={resetting}>
            Entrar
          </Button>

          <button
            type="button"
            className="login-page__forgot"
            onClick={() => void handleForgotPassword()}
            disabled={submitting || resetting}
          >
            {resetting ? 'Enviando…' : 'Esqueci minha senha'}
          </button>
        </form>

        <p className="login-page__hint">
          Acesso somente por convite do gestor do escritório.
        </p>
      </div>
    </div>
  )
}
