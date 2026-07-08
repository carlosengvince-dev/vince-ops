import { Link } from 'react-router-dom'
import {
  formatNumeroProjeto,
  PROJETO_STATUS_LABELS,
} from '../../lib/constants'
import { getDisciplinaLabel } from '../../lib/disciplinaConfig'
import { getPhaseLabel } from '../../lib/faseConfig'
import { discToneClasses, discToneStyle } from '../../lib/disciplinaTokens'
import { getDisciplineProgressMap } from '../../lib/projectProgress'
import type { ProjetoListItem } from '../../types/project-create'
import './ProjectCard.css'

interface ProjectCardProps {
  projeto: ProjetoListItem
  tarefas: { projeto_id: string; disciplina: string; fase: string; status: string }[]
}

export function ProjectCard({ projeto, tarefas }: ProjectCardProps) {
  const numero = formatNumeroProjeto(projeto.numero_sequencial)
  const progressMap = getDisciplineProgressMap(projeto, tarefas)

  return (
    <article className="project-card">
      <header className="project-card__header">
        <div>
          <span className="project-card__codigo">{projeto.codigo}</span>
          <span className="project-card__numero">{numero}</span>
        </div>
        <span className={`project-card__status project-card__status--${projeto.status.replace('_', '')}`}>
          {PROJETO_STATUS_LABELS[projeto.status]}
        </span>
      </header>

      <h3 className="project-card__nome">{projeto.nome}</h3>
      {projeto.cliente_nome ? (
        <p className="project-card__cliente">{projeto.cliente_nome}</p>
      ) : null}

      <div className="project-card__disciplinas">
        {projeto.disciplinas.map((disc) => {
          const prog = progressMap[disc]
          if (!prog) return null

          return (
            <div key={disc} className="project-card__disc">
              <div className="project-card__disc-head">
                <span
                  className={`project-card__disc-badge ${discToneClasses(disc)}`}
                  style={discToneStyle(disc)}
                >
                  {getDisciplinaLabel(disc)}
                </span>
                <span className="project-card__disc-pct">{prog.percent}%</span>
              </div>
              <div className="project-card__bar">
                <div
                  className="project-card__bar-fill"
                  style={{ width: `${prog.percent}%` }}
                />
              </div>
              <div className="project-card__dots" title={`Fase: ${getPhaseLabel(prog.faseAtual, disc)}`}>
                {prog.phaseDots.map(({ fase, status }) => (
                  <span
                    key={fase}
                    className={`project-card__dot project-card__dot--${status}`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <footer className="project-card__footer">
        <Link to={`/projetos/${projeto.id}?aba=home`} className="project-card__open">
          Abrir
        </Link>
      </footer>
    </article>
  )
}
