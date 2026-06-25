import { TAREFA_STATUS_LABELS } from '../../lib/constants'
import type { TarefaHojeItem } from '../../types/project-create'
import './DashboardHojeBar.css'

interface DashboardHojeBarProps {
  tarefas: TarefaHojeItem[]
  loading?: boolean
}

export function DashboardHojeBar({ tarefas, loading }: DashboardHojeBarProps) {
  return (
    <section className="dashboard-hoje" aria-label="Tarefas de hoje">
      <h2 className="dashboard-hoje__title">Hoje</h2>

      {loading ? (
        <p className="dashboard-hoje__status">Carregando…</p>
      ) : tarefas.length === 0 ? (
        <p className="dashboard-hoje__status">Nenhuma tarefa em elaboração ou revisão.</p>
      ) : (
        <ul className="dashboard-hoje__list">
          {tarefas.map((t) => (
            <li key={t.id} className="dashboard-hoje__item">
              <span className="dashboard-hoje__nome">{t.nome}</span>
              <span className="dashboard-hoje__meta">
                <span className="dashboard-hoje__codigo">{t.projeto_codigo}</span>
                <span className="dashboard-hoje__sep">·</span>
                <span className="dashboard-hoje__resp">
                  {t.responsavel_nome ?? 'Sem responsável'}
                </span>
                <span
                  className={`dashboard-hoje__status-badge dashboard-hoje__status-badge--${t.status.replace('_', '')}`}
                >
                  {TAREFA_STATUS_LABELS[t.status]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
