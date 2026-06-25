import { supabase } from './supabase'
import type { Disciplina, Fase, FasesAtuais, Tarefa, TarefaStatus } from '../types'

const DONE_STATUSES: TarefaStatus[] = ['concluido', 'nao_aplica']

export function calcPhaseProgress(
  tarefas: Tarefa[],
  disciplina: Disciplina,
  fase: Fase,
): number {
  const phaseTasks = tarefas.filter(
    (t) =>
      t.disciplina === disciplina &&
      t.fase === fase &&
      t.revisao_id == null &&
      t.deleted_at === null,
  )
  if (phaseTasks.length === 0) return 0
  const done = phaseTasks.filter((t) => DONE_STATUSES.includes(t.status)).length
  return Math.round((done / phaseTasks.length) * 100)
}

export function groupTarefasByCategoria(tarefas: Tarefa[]): Map<string, Tarefa[]> {
  const map = new Map<string, Tarefa[]>()
  for (const t of tarefas) {
    const list = map.get(t.categoria) ?? []
    list.push(t)
    map.set(t.categoria, list)
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.ordem - b.ordem)
  }
  return map
}

export async function updateTarefaResponsavel(
  tarefaId: string,
  responsavelId: string | null,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('tarefas')
    .update({
      responsavel_id: responsavelId,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', tarefaId)

  if (error) throw new Error(error.message)
}

export async function updateTarefaStatus(
  tarefaId: string,
  status: TarefaStatus,
  userId: string,
  motivoBloqueio?: string | null,
): Promise<void> {
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }

  if (status === 'concluido') {
    payload.data_conclusao = new Date().toISOString()
    payload.motivo_bloqueio = null
  } else if (status === 'bloqueado') {
    payload.motivo_bloqueio = motivoBloqueio ?? null
    payload.data_conclusao = null
  } else {
    payload.motivo_bloqueio = null
    payload.data_conclusao = null
  }

  const { error } = await supabase.from('tarefas').update(payload).eq('id', tarefaId)
  if (error) throw new Error(error.message)
}

export async function advanceProjectPhase(
  projetoId: string,
  disciplina: Disciplina,
  nextFase: Fase,
  fasesAtuais: FasesAtuais,
): Promise<FasesAtuais> {
  const updated: FasesAtuais = { ...fasesAtuais, [disciplina]: nextFase }

  const { error } = await supabase
    .from('projetos')
    .update({
      fases_atuais: updated,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projetoId)

  if (error) throw new Error(error.message)
  return updated
}

export async function liberarFaseBloqueada(
  projetoId: string,
  disciplina: Disciplina,
  faseLiberada: Fase,
  nextFase: Fase,
  fasesAtuais: FasesAtuais,
  liberadoPor: string,
  justificativa: string,
  tarefasPendentesIds: string[],
): Promise<FasesAtuais> {
  const { error: libError } = await supabase.from('liberacoes_fase').insert({
    projeto_id: projetoId,
    disciplina,
    fase_liberada: faseLiberada,
    liberado_por: liberadoPor,
    justificativa,
    tarefas_pendentes_ids: tarefasPendentesIds,
  })

  if (libError) throw new Error(libError.message)

  return advanceProjectPhase(projetoId, disciplina, nextFase, fasesAtuais)
}
