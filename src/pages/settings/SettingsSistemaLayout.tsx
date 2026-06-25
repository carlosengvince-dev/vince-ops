import { NavLink, Outlet } from 'react-router-dom'
import './SettingsSectionPage.css'

const SUBSECTIONS = [
  { to: 'documentos', label: 'Documentos PRÉ-INFO' },
  { to: 'tipos-edificacao', label: 'Tipos de edificação' },
  { to: 'campos-projeto', label: 'Campos do projeto' },
] as const

export function SettingsSistemaLayout() {
  return (
    <div className="settings-section-page">
      <nav className="settings-section-page__subnav" aria-label="Sub-seções de sistema">
        {SUBSECTIONS.map(({ to, label }) => (
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
