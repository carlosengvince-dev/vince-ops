import { insertLiberacaoFaseRpc } from './liberacaoFaseRpc'
import { patchProjetoRpc } from './projetoRpc'
import {
  fetchTarefaById,
  tarefaToRpcParams,
  upsertTarefaRpc,
  patchTarefaRpc,
} from './tarefaRpc'
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
  _userId: string,
): Promise<void> {
  await patchTarefaRpc(tarefaId, {
    p_responsavel_id: responsavelId,
  })
}

export async function updateTarefaStatus(
  tarefaId: string,
  status: TarefaStatus,
  _userId: string,
  motivoBloqueio?: string | null,
): Promise<void> {
  const tarefa = await fetchTarefaById(tarefaId)
  const patch: Partial<ReturnType<typeof tarefaToRpcParams>> = {
    p_status: status,
  }

  if (status === 'concluido') {
    patch.p_data_conclusao = new Date().toISOString()
    patch.p_motivo_bloqueio = null
  } else if (status === 'bloqueado') {
    patch.p_motivo_bloqueio = motivoBloqueio ?? null
    patch.p_data_conclusao = null
  } else {
    patch.p_motivo_bloqueio = null
    patch.p_data_conclusao = null
  }

  await upsertTarefaRpc(tarefaToRpcParams(tarefa, patch))
}

export async function advanceProjectPhase(
  projetoId: string,
  disciplina: Disciplina,
  nextFase: Fase,
  fasesAtuais: FasesAtuais,
): Promise<FasesAtuais> {
  const updated: FasesAtuais = { ...fasesAtuais, [disciplina]: nextFase }

  await patchProjetoRpc(projetoId, { fases_atuais: updated })
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
  await insertLiberacaoFaseRpc({
    p_projeto_id: projetoId,
    p_disciplina: disciplina,
    p_fase_liberada: faseLiberada,
    p_liberado_por: liberadoPor,
    p_justificativa: justificativa,
    p_tarefas_pendentes_ids: tarefasPendentesIds,
  })

  return advanceProjectPhase(projetoId, disciplina, nextFase, fasesAtuais)
}
