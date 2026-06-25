import type { HorasPorMesItem } from '../types/project-create'

export function formatHoursMinutes(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0min'

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}min`
  return '< 1min'
}

export interface HorasBarChartConfig {
  values: number[]
  useMinutes: boolean
  stepSize: number
  suffix: string
}

export function buildHorasBarChartConfig(horasPorMes: HorasPorMesItem[]): HorasBarChartConfig {
  const maxSegundos = Math.max(...horasPorMes.map((m) => m.segundos), 0)
  const useMinutes = maxSegundos < 3600

  const values = horasPorMes.map((m) =>
    useMinutes ? Math.round(m.segundos / 60) : Math.round(m.segundos / 3600),
  )

  const maxVal = Math.max(...values, 1)
  let stepSize = 1
  if (maxVal > 10) {
    stepSize = Math.max(1, Math.ceil(maxVal / 5))
  }

  return {
    values,
    useMinutes,
    stepSize,
    suffix: useMinutes ? 'min' : 'h',
  }
}
