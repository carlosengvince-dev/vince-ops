import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { canManageConfigSnapshots } from '../../lib/configSnapshot'
import './SettingsSectionPage.css'

const SUBSECTIONS = [
  { to: 'documentos', label: 'Documentos PRÉ-INFO' },
  { to: 'tipos-edificacao', label: 'Tipos de edificação' },
  { to: 'campos-projeto', label: 'Campos do projeto' },
  { to: 'padroes-restauracao', label: 'Padrões e restauração', gestorOnly: true as const },
] as const

export function SettingsSistemaLayout() {
  const { profile } = useAuth()

  const visibleSubsections = SUBSECTIONS.filter(
    (s) => !('gestorOnly' in s) || (profile != null && canManageConfigSnapshots(profile.papel)),
  )

  return (
    <div className="settings-section-page">
      <nav className="settings-section-page__subnav" aria-label="Sub-seções de sistema">
        {visibleSubsections.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `settings-section-page__subnav-link${isActive ? ' settings-section-page__subnav-link--active' : ''}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
