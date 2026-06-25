import { useMemo } from 'react'
import { DashboardCalendar } from '../components/dashboard/DashboardCalendar'
import { DashboardCharts } from '../components/dashboard/DashboardCharts'
import { DashboardHojeBar } from '../components/dashboard/DashboardHojeBar'
import { DashboardOrgHeader } from '../components/dashboard/DashboardOrgHeader'
import { DashboardProjectsPreview } from '../components/dashboard/DashboardProjectsPreview'
import { PageWrapper } from '../components/layout/PageWrapper'
import { useAuth } from '../hooks/useAuth'
import { useProjects } from '../hooks/useProjects'
import { formatHorasDecimalShort } from '../lib/projectHoras'
import { formatElapsedTime } from '../lib/utils'
import { sortTarefasHojeForUser } from '../types/project-create'
import './Dashboard.css'

export default function Dashboard() {
  const { profile } = useAuth()
  const {
    ativos,
    tarefasProgress,
    metrics,
    horasPorMes,
    tarefasPorStatus,
    tarefasHoje,
    calendarProjects,
    loading,
    error,
    horasChartVersion,
    horasMesPorDisciplina,
    horasPorProjeto,
  } = useProjects()

  const tarefasHojeSorted = useMemo(
    () => sortTarefasHojeForUser(tarefasHoje, profile?.id),
    [tarefasHoje, profile?.id],
  )

  const horasMes = formatElapsedTime(metrics.horasMesSegundos).replace(/^00:/, '')
  const horasMesTooltip = `HID: ${formatHorasDecimalShort(horasMesPorDisciplina.HID)} | PPCI: ${formatHorasDecimalShort(horasMesPorDisciplina.PPCI)}`

  return (
    <PageWrapper>
      <div className="dashboard">
        <DashboardOrgHeader />

        <DashboardHojeBar tarefas={tarefasHojeSorted} loading={loading} />

        <div className="dashboard__metrics">
          <div className="dashboard__metric">
            <span className="dashboard__metric-value">{metrics.projetosAtivos}</span>
            <span className="dashboard__metric-label">Projetos ativos</span>
          </div>
          <div className="dashboard__metric">
            <span className="dashboard__metric-value">{metrics.tarefasAbertas}</span>
            <span className="dashboard__metric-label">Tarefas abertas</span>
          </div>
          <div className="dashboard__metric dashboard__metric--has-tooltip">
            <span className="dashboard__metric-value">{horasMes}</span>
            <span className="dashboard__metric-label">Horas este mês</span>
            <span className="dashboard__metric-tooltip" role="tooltip">
              {horasMesTooltip}
            </span>
          </div>
          <div className="dashboard__metric">
            <span className="dashboard__metric-value">{metrics.projetosConcluidos}</span>
            <span className="dashboard__metric-label">Projetos concluídos</span>
          </div>
        </div>

        <DashboardCharts
          horasPorMes={horasPorMes}
          tarefasPorStatus={tarefasPorStatus}
          horasChartVersion={horasChartVersion}
        />

        <DashboardCalendar projects={calendarProjects} />

        <DashboardProjectsPreview
          projetos={ativos}
          tarefas={tarefasProgress}
          horasPorProjeto={horasPorProjeto}
          loading={loading}
        />

        {error ? (
          <p className="dashboard__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </PageWrapper>
  )
}

