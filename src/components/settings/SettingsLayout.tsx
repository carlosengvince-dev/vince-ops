import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { hasPermissao } from '../../lib/constants'
import { PageWrapper } from '../layout/PageWrapper'
import './SettingsLayout.css'

export function SettingsLayout() {
  const { profile } = useAuth()

  const showUsuarios = profile ? hasPermissao(profile.papel, 'acessar_configuracoes') : false
  const showPapeis = profile ? hasPermissao(profile.papel, 'gerenciar_papeis') : false
  const showTemplates = showUsuarios
  const showSistema = showUsuarios

  return (
    <PageWrapper>
      <div className="settings-layout">
        <aside className="settings-layout__sidebar" aria-label="Seções de configurações">
          <h1 className="settings-layout__title">Configurações</h1>
          <nav className="settings-layout__nav">
            <NavLink
              to="/configuracoes/minha-conta"
              className={({ isActive }) =>
                `settings-layout__nav-link${isActive ? ' settings-layout__nav-link--active' : ''}`
              }
            >
              Minha conta
            </NavLink>

            {showUsuarios ? (
              <NavLink
                to="/configuracoes/usuarios"
                className={({ isActive }) =>
                  `settings-layout__nav-link${isActive ? ' settings-layout__nav-link--active' : ''}`
                }
              >
                Usuários
              </NavLink>
            ) : null}

            {showPapeis ? (
              <NavLink
                to="/configuracoes/papeis"
                className={({ isActive }) =>
                  `settings-layout__nav-link${isActive ? ' settings-layout__nav-link--active' : ''}`
                }
              >
                Papéis e permissões
              </NavLink>
            ) : null}

            {showTemplates ? (
              <NavLink
                to="/configuracoes/templates"
                className={({ isActive }) =>
                  `settings-layout__nav-link${isActive ? ' settings-layout__nav-link--active' : ''}`
                }
              >
                Templates
              </NavLink>
            ) : null}

            {showSistema ? (
              <NavLink
                to="/configuracoes/sistema"
                className={({ isActive }) =>
                  `settings-layout__nav-link${isActive ? ' settings-layout__nav-link--active' : ''}`
                }
              >
                Sistema
              </NavLink>
            ) : null}
          </nav>
        </aside>
        <div className="settings-layout__content">
          <Outlet />
        </div>
      </div>
    </PageWrapper>
  )
}
