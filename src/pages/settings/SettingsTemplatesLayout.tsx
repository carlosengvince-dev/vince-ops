import { NavLink, Outlet } from 'react-router-dom'
import './SettingsSectionPage.css'

const SUBSECTIONS = [
  { to: 'checklist', label: 'Templates de checklist' },
  { to: 'categorias', label: 'Categorias' },
  { to: 'fases', label: 'Fases e sequências' },
] as const

export function SettingsTemplatesLayout() {
  return (
    <div className="settings-section-page">
      <nav className="settings-section-page__subnav" aria-label="Sub-seções de templates">
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
