import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { buildHorasBarChartConfig, formatHoursMinutes } from '../../lib/chartUtils'
import type { HorasPorMesItem, TarefasPorStatusCounts } from '../../types/project-create'
import './DashboardCharts.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip)

const DOUGHNUT_ITEMS: {
  key: keyof TarefasPorStatusCounts
  label: string
  color: string
}[] = [
  { key: 'concluido', label: 'Concluído', color: '#10B981' },
  { key: 'em_elaboracao', label: 'Em elaboração', color: '#F59E0B' },
  { key: 'em_revisao', label: 'Em revisão', color: '#8B5CF6' },
  { key: 'bloqueado', label: 'Bloqueado', color: '#EF4444' },
  { key: 'pendente', label: 'Pendente', color: '#E5E7EB' },
]

interface DashboardChartsProps {
  horasPorMes: HorasPorMesItem[]
  tarefasPorStatus: TarefasPorStatusCounts
  horasChartVersion?: number
}

export function DashboardCharts({
  horasPorMes,
  tarefasPorStatus,
  horasChartVersion = 0,
}: DashboardChartsProps) {
  const barConfig = useMemo(() => buildHorasBarChartConfig(horasPorMes), [horasPorMes])

  const horasData = {
    labels: horasPorMes.map((m) => m.label),
    datasets: [
      {
        data: barConfig.values,
        backgroundColor: '#0B4EA2',
        borderRadius: 4,
        maxBarThickness: 40,
      },
    ],
  }

  const statusEntries = DOUGHNUT_ITEMS.map((item) => ({
    ...item,
    value: tarefasPorStatus[item.key],
  }))

  const totalTarefas = statusEntries.reduce((sum, e) => sum + e.value, 0)

  const doughnutData = {
    labels: statusEntries.map((e) => e.label),
    datasets: [
      {
        data: statusEntries.map((e) => e.value),
        backgroundColor: statusEntries.map((e) => e.color),
        borderWidth: 0,
      },
    ],
  }

  return (
    <div className="dashboard-charts">
      <div className="dashboard-charts__card">
        <h2 className="dashboard-charts__title">Horas registradas por mês</h2>
        <div className="dashboard-charts__canvas dashboard-charts__canvas--bar">
          <Bar
            key={`horas-bar-${horasChartVersion}`}
            data={horasData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const seconds = horasPorMes[ctx.dataIndex]?.segundos ?? 0
                      return formatHoursMinutes(seconds)
                    },
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { font: { size: 11 } },
                },
                y: {
                  min: 0,
                  beginAtZero: true,
                  ticks: {
                    font: { size: 11 },
                    precision: 0,
                    stepSize: barConfig.stepSize,
                    callback: (value) => `${value}${barConfig.suffix}`,
                  },
                },
              },
            }}
          />
        </div>
      </div>

      <div className="dashboard-charts__card">
        <h2 className="dashboard-charts__title">Tarefas por status</h2>
        <div className="dashboard-charts__doughnut-wrap">
          <div className="dashboard-charts__canvas dashboard-charts__canvas--doughnut">
            {totalTarefas > 0 ? (
              <Doughnut
                data={doughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '62%',
                  plugins: { legend: { display: false } },
                }}
              />
            ) : (
              <p className="dashboard-charts__empty">Nenhuma tarefa</p>
            )}
          </div>
          <ul className="dashboard-charts__legend">
            {statusEntries.map((entry) => (
              <li key={entry.key} className="dashboard-charts__legend-item">
                <span
                  className="dashboard-charts__legend-swatch"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="dashboard-charts__legend-label">{entry.label}</span>
                <span className="dashboard-charts__legend-value">{entry.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
