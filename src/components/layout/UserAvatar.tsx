import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PAPEL_LABELS } from '../../lib/constants'
import { getInitials } from '../../lib/utils'
import './UserAvatar.css'

export function UserAvatar() {
  const { profile, logout } = useAuth()

  if (!profile) {
    return null
  }

  const initials = getInitials(profile.nome)

  return (
    <div className="user-avatar">
      <button
        type="button"
        className="user-avatar__button"
        title={`${profile.nome} — ${PAPEL_LABELS[profile.papel]}`}
        aria-label={`Usuário ${profile.nome}`}
      >
        <span className="user-avatar__initials">{initials}</span>
      </button>
      <div className="user-avatar__menu">
        <div className="user-avatar__info">
          <span className="user-avatar__name">{profile.nome}</span>
          <span className="user-avatar__role">{PAPEL_LABELS[profile.papel]}</span>
        </div>
        <Link to="/configuracoes/minha-conta" className="user-avatar__settings">
          Configurações
        </Link>
        <button type="button" className="user-avatar__logout" onClick={() => void logout()}>
          Sair
        </button>
      </div>
    </div>
  )
}
