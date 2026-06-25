import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { PermittedRoute } from './components/layout/PermittedRoute'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { AuthProvider } from './hooks/useAuth'
import { TimerProvider } from './hooks/useTimer'
import Clients from './pages/Clients'
import CreateProject from './pages/CreateProject'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Login from './pages/Login'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import { SettingsLayout } from './components/settings/SettingsLayout'
import SettingsMyAccount from './pages/settings/SettingsMyAccount'
import SettingsPapeis from './pages/settings/SettingsPapeis'
import SettingsUsers from './pages/settings/SettingsUsers'
import { SettingsTemplatesLayout } from './pages/settings/SettingsTemplatesLayout'
import { SettingsSistemaLayout } from './pages/settings/SettingsSistemaLayout'
import SettingsTemplatesChecklist from './pages/settings/SettingsTemplatesChecklist'
import SettingsTemplatesCategorias from './pages/settings/SettingsTemplatesCategorias'
import SettingsTemplatesFases from './pages/settings/SettingsTemplatesFases'
import SettingsSistemaDocumentos from './pages/settings/SettingsSistemaDocumentos'
import SettingsSistemaTiposEdificacao from './pages/settings/SettingsSistemaTiposEdificacao'
import SettingsSistemaCamposProjeto from './pages/settings/SettingsSistemaCamposProjeto'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <PermittedRoute permission="ver_todos_projetos">
              <Dashboard />
            </PermittedRoute>
          }
        />
        <Route
          path="projetos"
          element={
            <PermittedRoute permission="ver_todos_projetos">
              <Projects />
            </PermittedRoute>
          }
        />
        <Route
          path="projetos/novo"
          element={
            <PermittedRoute permission="criar_projeto">
              <CreateProject />
            </PermittedRoute>
          }
        />
        <Route
          path="projetos/:id"
          element={
            <PermittedRoute permission="ver_todos_projetos">
              <ProjectDetail />
            </PermittedRoute>
          }
        />
        <Route
          path="clientes"
          element={
            <PermittedRoute permission="ver_todos_projetos">
              <Clients />
            </PermittedRoute>
          }
        />
        <Route
          path="historico"
          element={
            <PermittedRoute permission="ver_todos_projetos">
              <History />
            </PermittedRoute>
          }
        />
        <Route path="configuracoes" element={<SettingsLayout />}>
          <Route index element={<Navigate to="minha-conta" replace />} />
          <Route path="minha-conta" element={<SettingsMyAccount />} />
          <Route
            path="usuarios"
            element={
              <PermittedRoute permission="acessar_configuracoes">
                <SettingsUsers />
              </PermittedRoute>
            }
          />
          <Route
            path="papeis"
            element={
              <PermittedRoute permission="gerenciar_papeis">
                <SettingsPapeis />
              </PermittedRoute>
            }
          />
          <Route
            path="templates"
            element={
              <PermittedRoute permission="acessar_configuracoes">
                <SettingsTemplatesLayout />
              </PermittedRoute>
            }
          >
            <Route index element={<Navigate to="checklist" replace />} />
            <Route path="checklist" element={<SettingsTemplatesChecklist />} />
            <Route path="categorias" element={<SettingsTemplatesCategorias />} />
            <Route path="fases" element={<SettingsTemplatesFases />} />
          </Route>
          <Route
            path="sistema"
            element={
              <PermittedRoute permission="acessar_configuracoes">
                <SettingsSistemaLayout />
              </PermittedRoute>
            }
          >
            <Route index element={<Navigate to="documentos" replace />} />
            <Route path="documentos" element={<SettingsSistemaDocumentos />} />
            <Route path="tipos-edificacao" element={<SettingsSistemaTiposEdificacao />} />
            <Route
              path="campos-projeto"
              element={
                <PermittedRoute permission="gerenciar_papeis">
                  <SettingsSistemaCamposProjeto />
                </PermittedRoute>
              }
            />
          </Route>
        </Route>
      </Route>

      <Route path="registros" element={<Navigate to="/projetos" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <TimerProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TimerProvider>
    </AuthProvider>
  )
}
