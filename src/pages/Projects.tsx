import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { ProjectCard } from '../components/projects/ProjectCard'
import { SuspendedProjects } from '../components/projects/SuspendedProjects'
import { useAuth } from '../hooks/useAuth'
import { useProjects } from '../hooks/useProjects'
import { hasPermissao } from '../lib/constants'
import type { ProjetoListItem } from '../types/project-create'
import '../components/ui/Button.css'
import './Projects.css'

type ProjectFilter = 'todos' | 'ativo' | 'em_revisao' | 'suspenso'

const FILTER_OPTIONS: { value: ProjectFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'em_revisao', label: 'Em revisão' },
  { value: 'suspenso', label: 'Suspensos' },
]

function matchesSearch(projeto: ProjetoListItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    projeto.nome.toLowerCase().includes(q) ||
    projeto.codigo.toLowerCase().includes(q) ||
    (projeto.cliente_nome?.toLowerCase().includes(q) ?? false)
  )
}

export default function Projects() {
  const { profile } = useAuth()
  const {
    ativos,
    suspensos,
    tarefasProgress,
    loading,
    error,
    reactivateProject,
  } = useProjects()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ProjectFilter>('todos')

  const canCreate = profile ? hasPermissao(profile.papel, 'criar_projeto') : false
  const canReactivate = profile ? hasPermissao(profile.papel, 'editar_projeto') : false

  const filteredProjetos = useMemo(() => {
    let source: ProjetoListItem[] = []

    if (filter === 'suspenso') {
      source = suspensos
    } else if (filter === 'ativo') {
      source = ativos.filter((p) => p.status === 'ativo')
    } else if (filter === 'em_revisao') {
      source = ativos.filter((p) => p.status === 'em_revisao')
    } else {
      source = ativos
    }

    return source.filter((p) => matchesSearch(p, search))
  }, [ativos, suspensos, filter, search])

  const showSuspendedSection = filter === 'todos' && suspensos.length > 0

  return (
    <PageWrapper>
      <div className="projects-page">
        <div className="projects-page__toolbar">
          <div className="projects-page__toolbar-left">
            <h1 className="projects-page__title">Projetos</h1>
            <label className="projects-page__search">
              <Search size={16} aria-hidden />
              <input
                type="search"
                placeholder="Buscar por nome, código ou cliente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {canCreate ? (
            <Link to="/projetos/novo" className="ui-button ui-button--primary">
              <Plus size={16} aria-hidden />
              Novo projeto
            </Link>
          ) : null}
        </div>

        <div className="projects-page__filters" role="tablist" aria-label="Filtrar por status">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={filter === opt.value}
              className={`projects-page__filter${filter === opt.value ? ' projects-page__filter--active' : ''}`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="projects-page__error" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="projects-page__status">Carregando projetos…</p>
        ) : filteredProjetos.length === 0 ? (
          <div className="projects-page__empty">
            <p>Nenhum projeto encontrado.</p>
            {canCreate && filter !== 'suspenso' ? (
              <Link to="/projetos/novo" className="ui-button ui-button--primary">
                Criar projeto
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="projects-page__grid">
            {filteredProjetos.map((projeto) => (
              <ProjectCard key={projeto.id} projeto={projeto} tarefas={tarefasProgress} />
            ))}
          </div>
        )}

        {showSuspendedSection ? (
          <SuspendedProjects
            projetos={suspensos.filter((p) => matchesSearch(p, search))}
            onReactivate={reactivateProject}
            canReactivate={canReactivate}
          />
        ) : null}
      </div>
    </PageWrapper>
  )
}
