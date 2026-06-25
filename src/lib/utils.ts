export function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((n) => n.toString().padStart(2, '0')).join(':')
}

export function formatRelativeTime(isoDate: string, nowMs: number = Date.now()): string {
  const date = new Date(isoDate)
  const diffMs = nowMs - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `há ${diffHours}h`

  const now = new Date(nowMs)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (date.toDateString() === yesterday.toDateString()) {
    return `ontem às ${time}`
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ACTIVITY_MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

/** Timestamp para feed de atividade: "há 5 min", "ontem às 14:30", "24 jun às 09:15" */
export function formatActivityTime(isoDate: string, nowMs: number = Date.now()): string {
  const date = new Date(isoDate)
  const diffMs = nowMs - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `há ${diffHours}h`

  const now = new Date(nowMs)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (date.toDateString() === yesterday.toDateString()) {
    return `ontem às ${time}`
  }

  const day = date.getDate()
  const month = ACTIVITY_MONTHS_SHORT[date.getMonth()]
  return `${day} ${month} às ${time}`
}
