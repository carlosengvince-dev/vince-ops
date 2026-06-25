export function formatTaskDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return ''
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((n) => n.toString().padStart(2, '0')).join(':')
}

export function formatTimerHours(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0'
  const hours = totalSeconds / 3600
  if (hours < 1) {
    const rounded = Math.round(hours * 10) / 10
    return rounded.toString()
  }
  const rounded = Math.round(hours * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function computeRegistroSeconds(
  inicio: string,
  fim: string | null,
  duracaoSegundos: number | null,
  nowMs: number = Date.now(),
): number {
  if (fim != null && duracaoSegundos != null) {
    return duracaoSegundos
  }
  if (fim == null) {
    return Math.max(0, Math.floor((nowMs - new Date(inicio).getTime()) / 1000))
  }
  return duracaoSegundos ?? 0
}
