import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { hasPermissao, type Permissao } from '../../lib/constants'
import { useAuth } from '../../hooks/useAuth'

interface PermittedRouteProps {
  permission: Permissao
  children: ReactNode
}

export function PermittedRoute({ permission, children }: PermittedRouteProps) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Carregando…
      </div>
    )
  }

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  if (!hasPermissao(profile.papel, permission)) {
    return <Navigate to="/" replace />
  }

  return children
}
