import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, profileLoading } = useAuth()
  const location = useLocation()

  if (loading || (session != null && profileLoading)) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Carregando…
      </div>
    )
  }

  if (!session || !profile) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return children
}
