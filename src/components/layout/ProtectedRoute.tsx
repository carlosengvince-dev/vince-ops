import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, profileLoading, passwordRecovery } = useAuth()
  const location = useLocation()

  // Recuperação de senha: só espera a sessão, depois desvia — nunca Home.
  if (passwordRecovery) {
    if (loading) {
      return (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Carregando…
        </div>
      )
    }
    return <Navigate to="/redefinir-senha" replace />
  }

  // Enquanto sessão ou profile resolvem, NÃO redirecionar (preserva URL no F5).
  // Se já há profile, não desmontar a árvore durante refresh de token / soft loading.
  if ((loading || profileLoading) && !profile) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Carregando…
      </div>
    )
  }

  if (!session || !profile) {
    const from = `${location.pathname}${location.search}`
    return <Navigate to="/login" state={{ from }} replace />
  }

  return children
}
