import { NavLink, Link } from 'react-router-dom'
import { ActiveTimersDropdown } from '../timer/ActiveTimersDropdown'
import { HeaderQuickTimer } from '../timer/HeaderQuickTimer'
import { UserAvatar } from './UserAvatar'
import './Header.css'

const NAV_ITEMS = [
  { to: '/', label: 'Início', end: true },
  { to: '/projetos', label: 'Projetos', end: false },
  { to: '/clientes', label: 'Clientes', end: false },
  { to: '/historico', label: 'Histórico', end: false },
] as const

export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__bar">
        <div className="app-header__brand">
          <Link to="/" className="app-header__brand-link" aria-label="Ir para o Início">
            <img
              src="/logo-branca.svg"
              alt="VINCE Engenharia"
              className="app-header__logo"
              height={48}
            />
          </Link>
        </div>

        <nav className="app-header__nav" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `app-header__nav-link${isActive ? ' app-header__nav-link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-header__actions">
          <HeaderQuickTimer />
          <ActiveTimersDropdown />
          <UserAvatar />
        </div>
      </div>
    </header>
  )
}
