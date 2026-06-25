import { supabase } from './supabase'
import type { Disciplina, Fase, Tarefa } from '../types'

export interface ActiveTimerRow {
  id: string
  inicio: string
  usuarioId: string
  usuarioNome: string
  tarefaId: string
  tarefaNome: string
  projetoId: string
  projetoCodigo: string
  disciplina: Disciplina
  fase: Fase
}

export interface MyActiveTimer {
  id: string
  tarefaId: string
  tarefaNome: string
  projetoId: string
  disciplina: Disciplina
  fase: Fase
  inicio: string
}

export function buildTaskTimerNavigateUrl(timer: Pick<MyActiveTimer, 'projetoId' | 'disciplina' | 'fase' | 'tarefaId'>): string {
  const params = new URLSearchParams({
    aba: 'checklist',
    disc: timer.disciplina,
    fase: timer.fase,
    tarefa: timer.tarefaId,
  })
  return `/projetos/${timer.projetoId}?${params.toString()}`
}

export function truncateTaskName(nome: string, max = 20): string {
  if (nome.length <= max) return nome
  return `${nome.slice(0, max - 3)}...`
}

function parseTarefaJoin(
  tarefa: { nome: string; fase: Fase } | { nome: string; fase: Fase }[] | null | undefined,
): { nome: string; fase: Fase } | null {
  if (!tarefa) return null
  if (Array.isArray(tarefa)) return tarefa[0] ?? null
  return tarefa
}

type TarefaTimerJoin = {
  nome: string
  fase: Fase
  projetos: { codigo: string } | null
}

function parseTarefaTimerJoin(
  tarefa: TarefaTimerJoin | TarefaTimerJoin[] | null | undefined,
): TarefaTimerJoin | null {
  if (!tarefa) return null
  if (Array.isArray(tarefa)) return tarefa[0] ?? null
  return tarefa
}

export async function fetchActiveTimers(): Promise<ActiveTimerRow[]> {
  const { data, error } = await supabase
    .from('registros_tempo')
    .select(
      'id, inicio, usuario_id, tarefa_id, projeto_id, disciplina, profiles!usuario_id(nome), tarefas(nome, fase, projetos(codigo))',
    )
    .is('fim', null)
    .is('deleted_at', null)
    .order('inicio', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const profile = r.profiles as { nome: string } | null
    const tarefa = parseTarefaTimerJoin(
      r.tarefas as TarefaTimerJoin | TarefaTimerJoin[] | null,
    )
    return {
      id: r.id as string,
      inicio: r.inicio as string,
      usuarioId: r.usuario_id as string,
      tarefaId: r.tarefa_id as string,
      usuarioNome: profile?.nome ?? '—',
      tarefaNome: tarefa?.nome ?? '—',
      projetoId: r.projeto_id as string,
      projetoCodigo: tarefa?.projetos?.codigo ?? '—',
      disciplina: r.disciplina as Disciplina,
      fase: (tarefa?.fase ?? 'PRE_INFO') as Fase,
    }
  })
}

export async function fetchMyActiveTimer(userId: string): Promise<MyActiveTimer | null> {
  const { data, error } = await supabase
    .from('registros_tempo')
    .select('id, tarefa_id, projeto_id, disciplina, inicio, tarefas(nome, fase)')
    .eq('usuario_id', userId)
    .is('fim', null)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const tarefa = parseTarefaJoin(
    data.tarefas as { nome: string; fase: Fase } | { nome: string; fase: Fase }[] | null,
  )

  return {
    id: data.id,
    tarefaId: data.tarefa_id,
    tarefaNome: tarefa?.nome ?? 'Tarefa',
    projetoId: data.projeto_id,
    disciplina: data.disciplina as Disciplina,
    fase: (tarefa?.fase ?? 'PRE_INFO') as Fase,
    inicio: data.inicio,
  }
}

export async function stopTimerRegistro(registroId: string, inicio: string): Promise<void> {
  const fim = new Date().toISOString()
  const duracaoSegundos = Math.floor((Date.now() - new Date(inicio).getTime()) / 1000)

  const { error } = await supabase
    .from('registros_tempo')
    .update({
      fim,
      duracao_segundos: duracaoSegundos,
    })
    .eq('id', registroId)

  if (error) throw new Error(error.message)
}

export async function startTimerRegistro(
  tarefa: Pick<Tarefa, 'id' | 'projeto_id' | 'disciplina'>,
  userId: string,
): Promise<MyActiveTimer> {
  const inicio = new Date().toISOString()

  const { data, error } = await supabase
    .from('registros_tempo')
    .insert({
      tarefa_id: tarefa.id,
      projeto_id: tarefa.projeto_id,
      disciplina: tarefa.disciplina,
      usuario_id: userId,
      inicio,
      fim: null,
    })
    .select('id, tarefa_id, projeto_id, disciplina, inicio, tarefas(nome, fase)')
    .single()

  if (error) throw new Error(error.message)

  const tarefaRow = parseTarefaJoin(
    data.tarefas as { nome: string; fase: Fase } | { nome: string; fase: Fase }[] | null,
  )

  return {
    id: data.id,
    tarefaId: data.tarefa_id,
    tarefaNome: tarefaRow?.nome ?? 'Tarefa',
    projetoId: data.projeto_id,
    disciplina: data.disciplina as Disciplina,
    fase: (tarefaRow?.fase ?? 'PRE_INFO') as Fase,
    inicio: data.inicio,
  }
}

export async function fetchTaskTimerTotals(
  projetoId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('registros_tempo')
    .select('tarefa_id, inicio, fim, duracao_segundos')
    .eq('projeto_id', projetoId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  const totals: Record<string, number> = {}
  const now = Date.now()

  for (const row of data ?? []) {
    const seconds = row.fim
      ? (row.duracao_segundos ?? 0)
      : Math.max(0, Math.floor((now - new Date(row.inicio).getTime()) / 1000))

    totals[row.tarefa_id] = (totals[row.tarefa_id] ?? 0) + seconds
  }

  return totals
}
