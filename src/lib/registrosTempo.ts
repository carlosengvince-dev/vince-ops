import { formatHorasMinutos } from './projectHoras'
import { supabase } from './supabase'
import type { RegistroTempoOrigem, Tarefa } from '../types'

export interface RegistroTempoRow {
  id: string
  inicio: string
  fim: string | null
  duracao_segundos: number | null
  usuario_id: string
  usuario_nome: string
  origem: RegistroTempoOrigem
  descricao: string | null
}

export interface ManualHorasInput {
  data: string
  horaInicio: string
  horaFim: string
  descricao?: string
}

export function todayIsoDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function buildLocalTimestamp(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString()
}

export function calcDurationSeconds(
  date: string,
  horaInicio: string,
  horaFim: string,
): number | null {
  if (!date || !horaInicio || !horaFim) return null
  const start = new Date(`${date}T${horaInicio}:00`).getTime()
  const end = new Date(`${date}T${horaFim}:00`).getTime()
  const diff = Math.floor((end - start) / 1000)
  return diff > 0 ? diff : null
}

export function validateManualHorasInput(
  input: ManualHorasInput,
  hasActiveTimerOnTask: boolean,
): string | null {
  if (hasActiveTimerOnTask) {
    return 'Pare o timer antes de lançar horas manualmente'
  }

  if (!input.data || !input.horaInicio || !input.horaFim) {
    return 'Preencha data, hora início e hora fim'
  }

  if (input.data > todayIsoDate()) {
    return 'A data não pode ser futura'
  }

  const duration = calcDurationSeconds(input.data, input.horaInicio, input.horaFim)
  if (duration == null) {
    return 'Hora fim deve ser após hora início'
  }

  if (duration < 60) {
    return 'Duração mínima de 1 minuto'
  }

  return null
}

export function formatRegistroDuration(segundos: number | null): string {
  if (segundos == null || segundos <= 0) return '—'
  return formatHorasMinutos(segundos) || '0min'
}

export function formatRegistroDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function formatRegistroTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function formatManualHorasActivityDuration(segundos: number): string {
  return formatHorasMinutos(segundos) || '0min'
}

function mapRegistroRow(row: Record<string, unknown>): RegistroTempoRow {
  const profile = row.profiles as { nome: string } | { nome: string }[] | null
  const nome = Array.isArray(profile) ? profile[0]?.nome : profile?.nome
  return {
    id: row.id as string,
    inicio: row.inicio as string,
    fim: row.fim as string | null,
    duracao_segundos: row.duracao_segundos as number | null,
    usuario_id: row.usuario_id as string,
    usuario_nome: nome ?? '—',
    origem: (row.origem as RegistroTempoOrigem) ?? 'timer',
    descricao: (row.descricao as string | null) ?? null,
  }
}

export async function fetchRegistrosByTarefa(tarefaId: string): Promise<RegistroTempoRow[]> {
  const { data, error } = await supabase
    .from('registros_tempo')
    .select(
      'id, inicio, fim, duracao_segundos, usuario_id, origem, descricao, profiles!usuario_id(nome)',
    )
    .eq('tarefa_id', tarefaId)
    .is('deleted_at', null)
    .order('inicio', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRegistroRow(row as Record<string, unknown>))
}

export async function insertManualRegistroTempo(
  tarefa: Pick<Tarefa, 'id' | 'projeto_id' | 'disciplina' | 'nome'>,
  userId: string,
  input: ManualHorasInput,
): Promise<{ duracaoSegundos: number }> {
  const validationError = validateManualHorasInput(input, false)
  if (validationError) throw new Error(validationError)

  const inicio = buildLocalTimestamp(input.data, input.horaInicio)
  const fim = buildLocalTimestamp(input.data, input.horaFim)
  const duracaoSegundos = calcDurationSeconds(input.data, input.horaInicio, input.horaFim)!
  const descricao = input.descricao?.trim() || null

  const { error } = await supabase.from('registros_tempo').insert({
    tarefa_id: tarefa.id,
    projeto_id: tarefa.projeto_id,
    disciplina: tarefa.disciplina,
    usuario_id: userId,
    inicio,
    fim,
    duracao_segundos: duracaoSegundos,
    origem: 'manual',
    descricao,
  })

  if (error) throw new Error(error.message)
  return { duracaoSegundos }
}

export async function softDeleteRegistroTempo(registroId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_registro_tempo', { registro_id: registroId })
  if (error) throw new Error(error.message)
}

export function modalHorasManuaisKey(tarefaId: string): string {
  return `modal_horas_manuais_${tarefaId}`
}
