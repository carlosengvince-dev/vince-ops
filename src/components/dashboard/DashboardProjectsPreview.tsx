import { Link } from 'react-router-dom'
import { getDisciplineProgressMap } from '../../lib/projectProgress'
import { formatHorasMinutos } from '../../lib/projectHoras'
import type { ProjetoListItem } from '../../types/project-create'
import type { TarefaProgressRow } from '../../hooks/useProjects'
import './DashboardProjectsPreview.css'

interface DashboardProjectsPreviewProps {
  projetos: ProjetoListItem[]
  tarefas: TarefaProgressRow[]
  horasPorProjeto: Record<string, number>
  loading?: boolean
}

function formatPreviewHoras(segundos: number): string {
  if (segundos <= 0) return 'Nenhuma hora registrada'
  return `${formatHorasMinutos(segundos)} registradas`
}

function overallProgress(
  projeto: ProjetoListItem,
  tarefas: TarefaProgressRow[],
): number {
  const map = getDisciplineProgressMap(projeto, tarefas)
  if (projeto.disciplinas.length === 0) return 0
  const sum = projeto.disciplinas.reduce((acc, disc) => acc + (map[disc]?.percent ?? 0), 0)
  return Math.round(sum / projeto.disciplinas.length)
}

export function DashboardProjectsPreview({
  projetos,
  tarefas,
  horasPorProjeto,
  loading,
}: DashboardProjectsPreviewProps) {
  const preview = projetos.slice(0, 3)

  return (
    <section className="dashboard-projects-preview">
      <div className="dashboard-projects-preview__head">
        <h2 className="dashboard-projects-preview__title">Projetos em andamento</h2>
        <Link to="/projetos" className="dashboard-projects-preview__link">
          Ver todos →
        </Link>
      </div>

      {loading ? (
        <p className="dashboard-projects-preview__status">Carregando…</p>
      ) : preview.length === 0 ? (
        <p className="dashboard-projects-preview__status">Nenhum projeto em andamento.</p>
      ) : (
        <ul className="dashboard-projects-preview__list">
          {preview.map((projeto) => {
            const percent = overallProgress(projeto, tarefas)
            return (
              <li key={projeto.id}>
                <Link to={`/projetos/${projeto.id}?aba=home`} className="dashboard-projects-preview__item">
                  <div className="dashboard-projects-preview__item-head">
                    <span className="dashboard-projects-preview__codigo">{projeto.codigo}</span>
                    <span className="dashboard-projects-preview__pct">{percent}%</span>
                  </div>
                  <p className="dashboard-projects-preview__nome">{projeto.nome}</p>
                  <div className="dashboard-projects-preview__bar">
                    <div
                      className="dashboard-projects-preview__bar-fill"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="dashboard-projects-preview__horas">
                    {formatPreviewHoras(horasPorProjeto[projeto.id] ?? 0)}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
