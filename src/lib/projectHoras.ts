import { supabase } from './supabase'
import type { Disciplina } from '../types'

export interface ProjetoHorasResumo {
  totalSegundos: number
  porDisciplina: Partial<Record<Disciplina, number>>
}

export type HorasMesPorDisciplina = Partial<Record<Disciplina, number>>

export function formatHorasMinutos(totalSeconds: number): string {
  if (totalSeconds <= 0) return ''
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours === 0) return `${minutes}min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

export function formatHorasDecimalShort(segundos: number): string {
  const horas = Math.round((segundos / 3600) * 10) / 10
  return `${horas}h`
}

export function getEstimativaHorasTotal(
  horasEstimadasHid: number | null,
  horasEstimadasPpci: number | null,
): number | null {
  const hasEstimativa =
    (horasEstimadasHid != null && horasEstimadasHid > 0) ||
    (horasEstimadasPpci != null && horasEstimadasPpci > 0)
  if (!hasEstimativa) return null
  return (horasEstimadasHid ?? 0) + (horasEstimadasPpci ?? 0)
}

export function formatProjetoHorasPrincipal(
  totalSegundos: number,
  estimativaHoras: number | null,
): string {
  if (totalSegundos <= 0) return 'Nenhuma hora registrada'

  const tempo = formatHorasMinutos(totalSegundos)
  if (estimativaHoras == null || estimativaHoras <= 0) {
    return `${tempo} registradas`
  }

  const horasUsadas = totalSegundos / 3600
  const percentual = Math.round((horasUsadas / estimativaHoras) * 100)
  return `${tempo} de ${estimativaHoras}h estimadas (${percentual}%)`
}

export function formatProjetoHorasPorDisciplina(
  disciplinas: Disciplina[],
  porDisciplina: Partial<Record<Disciplina, number>>,
  totalSegundos: number,
): string {
  const parts = disciplinas.map((disc) => {
    const seg = porDisciplina[disc] ?? 0
    return `${disc}: ${formatHorasMinutos(seg) || '0min'}`
  })
  parts.push(`Total: ${formatHorasMinutos(totalSegundos) || '0min'}`)
  return parts.join(' | ')
}

function aggregateRegistrosHoras(
  rows: { duracao_segundos: number | null; disciplina?: string; projeto_id?: string }[],
): {
  totalSegundos: number
  porDisciplina: Partial<Record<Disciplina, number>>
} {
  const porDisciplina: Partial<Record<Disciplina, number>> = {}
  let totalSegundos = 0

  for (const row of rows) {
    const segundos = row.duracao_segundos ?? 0
    if (segundos <= 0) continue
    totalSegundos += segundos
    const disc = row.disciplina as Disciplina | undefined
    if (disc) {
      porDisciplina[disc] = (porDisciplina[disc] ?? 0) + segundos
    }
  }

  return { totalSegundos, porDisciplina }
}

export async function fetchProjetoHoras(projetoId: string): Promise<ProjetoHorasResumo> {
  const { data, error } = await supabase
    .from('registros_tempo')
    .select('duracao_segundos, disciplina')
    .eq('projeto_id', projetoId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  return aggregateRegistrosHoras(data ?? [])
}

export async function fetchHorasPorProjetos(
  projetoIds: string[],
): Promise<Record<string, number>> {
  const totals: Record<string, number> = {}
  if (projetoIds.length === 0) return totals

  const { data, error } = await supabase
    .from('registros_tempo')
    .select('duracao_segundos, projeto_id')
    .in('projeto_id', projetoIds)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const segundos = row.duracao_segundos ?? 0
    if (segundos <= 0) continue
    totals[row.projeto_id] = (totals[row.projeto_id] ?? 0) + segundos
  }

  return totals
}

function computeRegistroSegundos(
  reg: { duracao_segundos: number | null; inicio: string; fim: string | null },
  todayStart: string,
): number {
  if (reg.duracao_segundos != null) return reg.duracao_segundos
  if (reg.fim == null && reg.inicio >= todayStart) {
    return Math.floor((Date.now() - new Date(reg.inicio).getTime()) / 1000)
  }
  return 0
}

export function aggregateHorasMesPorDisciplina(
  rows: { duracao_segundos: number | null; inicio: string; fim: string | null; disciplina: string }[],
  todayStart: string,
): HorasMesPorDisciplina {
  const result: HorasMesPorDisciplina = {}

  for (const reg of rows) {
    const segundos = computeRegistroSegundos(reg, todayStart)
    if (segundos <= 0 || !reg.disciplina) continue
    result[reg.disciplina] = (result[reg.disciplina] ?? 0) + segundos
  }

  return result
}

export function formatHorasMesDisciplinaTooltip(
  horas: HorasMesPorDisciplina,
  getLabel: (codigo: Disciplina | string) => string,
  codigos: Disciplina[],
): string {
  return codigos
    .map((codigo) => `${getLabel(codigo)}: ${formatHorasDecimalShort(horas[codigo] ?? 0)}`)
    .join(' | ')
}
