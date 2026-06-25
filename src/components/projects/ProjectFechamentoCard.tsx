import { DISCIPLINA_LABELS } from '../../lib/constants'
import { discToneClasses } from '../../lib/disciplinaTokens'
import {
  formatSnapshotHoras,
  type SnapshotFechamento,
} from '../../lib/projectStatus'
import type { Disciplina } from '../../types'
import './ProjectFechamentoCard.css'

interface ProjectFechamentoCardProps {
  snapshot: SnapshotFechamento
}

function desvioPrazoLabel(dias: number | null): { text: string; tone: 'early' | 'late' | 'none' } {
  if (dias === null) return { text: 'Sem data prevista', tone: 'none' }
  if (dias < 0) return { text: `Adiantado ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`, tone: 'early' }
  if (dias > 0) return { text: `Atrasado ${dias} dia${dias === 1 ? '' : 's'}`, tone: 'late' }
  return { text: 'No prazo', tone: 'none' }
}

export function ProjectFechamentoCard({ snapshot }: ProjectFechamentoCardProps) {
  const disciplinas = (Object.keys(snapshot.horas_totais) as (Disciplina | 'total')[]).filter(
    (k) => k !== 'total',
  ) as Disciplina[]

  const desvio = desvioPrazoLabel(snapshot.desvio_prazo_dias)

  return (
    <section className="project-fechamento" aria-label="Resumo de fechamento">
      <h2 className="project-fechamento__title">Fechamento do projeto</h2>

      <div className="project-fechamento__grid">
        <div className="project-fechamento__block">
          <span className="project-fechamento__label">Horas por disciplina</span>
          <div className="project-fechamento__horas-row">
            {disciplinas.map((disc) => (
              <span
                key={disc}
                className={`project-fechamento__disc-badge ${discToneClasses(disc, true)}`}
              >
                {DISCIPLINA_LABELS[disc]} · {formatSnapshotHoras(snapshot.horas_totais[disc] ?? 0)}
              </span>
            ))}
          </div>
          <p className="project-fechamento__total-horas">
            Total: <strong>{formatSnapshotHoras(snapshot.horas_totais.total)}</strong>
          </p>
        </div>

        <div className="project-fechamento__block">
          <span className="project-fechamento__label">Desvio de prazo</span>
          <p className={`project-fechamento__desvio project-fechamento__desvio--${desvio.tone}`}>
            {desvio.text}
          </p>
        </div>

        <div className="project-fechamento__block">
          <span className="project-fechamento__label">Tarefas</span>
          <p className="project-fechamento__stat">
            {snapshot.tarefas.concluidas} concluídas de {snapshot.tarefas.total} total
          </p>
        </div>

        <div className="project-fechamento__block">
          <span className="project-fechamento__label">Revisões</span>
          <p className="project-fechamento__stat">
            {snapshot.revisoes.concluidas} concluídas de {snapshot.revisoes.total} total
          </p>
        </div>
      </div>

      {snapshot.membros.length > 0 ? (
        <div className="project-fechamento__membros">
          <span className="project-fechamento__label">Membros envolvidos</span>
          <ul className="project-fechamento__membros-list">
            {snapshot.membros.map((membro, index) => (
              <li key={`${membro.nome}-${index}`} className="project-fechamento__membro">
                <span className="project-fechamento__membro-nome">{membro.nome}</span>
                <span className="project-fechamento__membro-horas">{formatSnapshotHoras(membro.horas)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
