import { useMemo } from 'react'
import type { CalendarProjectDates } from '../../types/project-create'
import './DashboardCalendar.css'

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

interface DashboardCalendarProps {
  projects: CalendarProjectDates[]
}

export function DashboardCalendar({ projects }: DashboardCalendarProps) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const { inicioDays, entregaDays } = useMemo(() => {
    const inicio = new Set<string>()
    const entrega = new Set<string>()

    for (const p of projects) {
      if (p.data_inicio) inicio.add(dateKey(p.data_inicio))
      if (p.data_entrega_prevista) entrega.add(dateKey(p.data_entrega_prevista))
    }

    return { inicioDays: inicio, entregaDays: entrega }
  }, [projects])

  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDay.getDay()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function getDayKey(day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <section className="dashboard-calendar">
      <h2 className="dashboard-calendar__title">
        Agenda do mês — {MONTH_NAMES[month]} {year}
      </h2>

      <div className="dashboard-calendar__weekdays">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={`${label}-${i}`} className="dashboard-calendar__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="dashboard-calendar__grid">
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="dashboard-calendar__cell dashboard-calendar__cell--empty" />
          }

          const key = getDayKey(day)
          const hasInicio = inicioDays.has(key)
          const hasEntrega = entregaDays.has(key)
          const isToday =
            day === now.getDate() && month === now.getMonth() && year === now.getFullYear()

          return (
            <div
              key={key}
              className={`dashboard-calendar__cell${isToday ? ' dashboard-calendar__cell--today' : ''}`}
            >
              <span className="dashboard-calendar__day">{day}</span>
              {(hasInicio || hasEntrega) && (
                <span className="dashboard-calendar__dots">
                  {hasInicio ? (
                    <span className="dashboard-calendar__dot dashboard-calendar__dot--inicio" />
                  ) : null}
                  {hasEntrega ? (
                    <span className="dashboard-calendar__dot dashboard-calendar__dot--entrega" />
                  ) : null}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <p className="dashboard-calendar__legend">
        <span>
          <span className="dashboard-calendar__dot dashboard-calendar__dot--inicio" /> Início
        </span>
        <span>
          <span className="dashboard-calendar__dot dashboard-calendar__dot--entrega" /> Entrega prevista
        </span>
      </p>
    </section>
  )
}
