import { PROJETO_STATUS_LABELS } from './constants'
import { patchProjetoRpc } from './projetoRpc'
import { supabase } from './supabase'
import type { Disciplina, ProjetoStatus, TarefaStatus } from '../types'

export const PROJECT_STATUS_OPTIONS: ProjetoStatus[] = [
  'ativo',
  'em_revisao',
  'suspenso',
  'cancelado',
  'concluido',
]

export type ProjectStatusConfirmKind = 'suspender' | 'cancelar' | 'concluir' | 'reativar'

export interface SnapshotFechamentoMembro {
  nome: string
  horas: number
}

export interface SnapshotFechamento {
  data_conclusao: string
  horas_totais: Partial<Record<Disciplina, number>> & { total: number }
  tarefas: {
    total: number
    concluidas: number
    nao_aplica: number
    pendentes: number
  }
  revisoes: {
    total: number
    concluidas: number
  }
  membros: SnapshotFechamentoMembro[]
  desvio_prazo_dias: number | null
}

export function getProjectStatusConfirmKind(
  from: ProjetoStatus,
  to: ProjetoStatus,
): ProjectStatusConfirmKind | null {
  if (from === to) return null
  if (to === 'suspenso') return 'suspender'
  if (to === 'cancelado') return 'cancelar'
  if (to === 'concluido') return 'concluir'
  if (to === 'ativo' && (from === 'suspenso' || from === 'cancelado')) return 'reativar'
  return null
}

export function projectStatusLabel(status: ProjetoStatus): string {
  return PROJETO_STATUS_LABELS[status]
}

export function isSnapshotPlaceholder(
  snapshot: Record<string, unknown> | null | undefined,
): boolean {
  if (!snapshot) return false
  return snapshot.placeholder === true
}

export function isRealSnapshotFechamento(
  snapshot: Record<string, unknown> | null | undefined,
): boolean {
  if (!snapshot || isSnapshotPlaceholder(snapshot)) return false
  return typeof snapshot.data_conclusao === 'string' && typeof snapshot.horas_totais === 'object'
}

export function parseSnapshotFechamento(
  snapshot: Record<string, unknown> | null | undefined,
): SnapshotFechamento | null {
  if (!isRealSnapshotFechamento(snapshot)) return null
  return snapshot as unknown as SnapshotFechamento
}

export function formatSnapshotHoras(horas: number): string {
  const rounded = Math.round(horas * 10) / 10
  return `${rounded}h`
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function roundHoras(segundos: number): number {
  return Math.round((segundos / 3600) * 10) / 10
}

function computeDesvioPrazoDias(
  dataConclusao: string,
  dataEntregaPrevista: string | null,
): number | null {
  if (!dataEntregaPrevista) return null
  const start = new Date(`${dataEntregaPrevista}T00:00:00`)
  const end = new Date(`${dataConclusao}T00:00:00`)
  const diffMs = end.getTime() - start.getTime()
  return Math.round(diffMs / (24 * 60 * 60 * 1000))
}

export async function buildProjectSnapshot(
  projetoId: string,
  dataConclusao: string,
  dataEntregaPrevista: string | null,
): Promise<SnapshotFechamento> {
  const [tempoRes, tarefasRes, revisoesRes] = await Promise.all([
    supabase
      .from('registros_tempo')
      .select('duracao_segundos, usuario_id, tarefas!inner(disciplina), profiles!usuario_id(nome)')
      .eq('projeto_id', projetoId)
      .is('deleted_at', null),
    supabase
      .from('tarefas')
      .select('status')
      .eq('projeto_id', projetoId)
      .is('deleted_at', null)
      .is('revisao_id', null),
    supabase
      .from('revisoes')
      .select('status')
      .eq('projeto_id', projetoId)
      .is('deleted_at', null),
  ])

  if (tempoRes.error) throw new Error(tempoRes.error.message)
  if (tarefasRes.error) throw new Error(tarefasRes.error.message)
  if (revisoesRes.error) throw new Error(revisoesRes.error.message)

  const horasPorDisciplina = new Map<Disciplina, number>()
  const horasPorMembro = new Map<string, { nome: string; segundos: number }>()
  let totalSegundos = 0

  for (const row of tempoRes.data ?? []) {
    const r = row as Record<string, unknown>
    const segundos = (r.duracao_segundos as number | null) ?? 0
    if (segundos <= 0) continue

    totalSegundos += segundos

    const tarefa = r.tarefas as { disciplina: Disciplina } | { disciplina: Disciplina }[] | null
    const disciplina = Array.isArray(tarefa) ? tarefa[0]?.disciplina : tarefa?.disciplina
    if (disciplina) {
      horasPorDisciplina.set(disciplina, (horasPorDisciplina.get(disciplina) ?? 0) + segundos)
    }

    const usuarioId = r.usuario_id as string
    const profile = r.profiles as { nome: string } | { nome: string }[] | null
    const nome = Array.isArray(profile) ? profile[0]?.nome : profile?.nome
    if (!usuarioId) continue

    const existing = horasPorMembro.get(usuarioId)
    if (existing) {
      existing.segundos += segundos
      if (nome && !existing.nome) existing.nome = nome
    } else {
      horasPorMembro.set(usuarioId, { nome: nome ?? 'Usuário', segundos })
    }
  }

  const horas_totais: SnapshotFechamento['horas_totais'] = { total: roundHoras(totalSegundos) }
  for (const [disc, segundos] of horasPorDisciplina) {
    horas_totais[disc] = roundHoras(segundos)
  }

  let concluidas = 0
  let nao_aplica = 0
  let pendentes = 0

  for (const row of tarefasRes.data ?? []) {
    const status = row.status as TarefaStatus
    if (status === 'concluido') concluidas += 1
    else if (status === 'nao_aplica') nao_aplica += 1
    else pendentes += 1
  }

  const tarefasTotal = concluidas + nao_aplica + pendentes

  let revisoesConcluidas = 0
  const revisoesTotal = revisoesRes.data?.length ?? 0
  for (const row of revisoesRes.data ?? []) {
    if (row.status === 'concluida') revisoesConcluidas += 1
  }

  const membros: SnapshotFechamentoMembro[] = [...horasPorMembro.values()]
    .map((m) => ({ nome: m.nome, horas: roundHoras(m.segundos) }))
    .sort((a, b) => b.horas - a.horas)

  return {
    data_conclusao: dataConclusao,
    horas_totais,
    tarefas: {
      total: tarefasTotal,
      concluidas,
      nao_aplica,
      pendentes,
    },
    revisoes: {
      total: revisoesTotal,
      concluidas: revisoesConcluidas,
    },
    membros,
    desvio_prazo_dias: computeDesvioPrazoDias(dataConclusao, dataEntregaPrevista),
  }
}

export interface UpdateProjetoStatusResult {
  status: ProjetoStatus
  data_conclusao_real: string | null
  justificativa_cancelamento: string | null
  snapshot_fechamento: Record<string, unknown> | null
}

export async function updateProjetoStatus(
  projetoId: string,
  newStatus: ProjetoStatus,
  opts: {
    justificativa?: string
    currentDataConclusaoReal?: string | null
    currentSnapshotFechamento?: Record<string, unknown> | null
    dataEntregaPrevista?: string | null
  } = {},
): Promise<UpdateProjetoStatusResult> {
  const patch: Parameters<typeof patchProjetoRpc>[1] = {
    p_status: newStatus,
  }

  if (newStatus === 'cancelado') {
    const trimmed = opts.justificativa?.trim()
    if (!trimmed) throw new Error('Justificativa é obrigatória para cancelar o projeto.')
    patch.p_justificativa_cancelamento = trimmed
  }

  if (newStatus === 'concluido') {
    const dataConclusao = opts.currentDataConclusaoReal ?? todayIsoDate()
    if (!opts.currentDataConclusaoReal) {
      patch.p_data_conclusao_real = dataConclusao
    }

    const existing = opts.currentSnapshotFechamento
    if (!existing || isSnapshotPlaceholder(existing)) {
      patch.p_snapshot_fechamento = (await buildProjectSnapshot(
        projetoId,
        dataConclusao,
        opts.dataEntregaPrevista ?? null,
      )) as unknown as Record<string, unknown>
    }
  }

  await patchProjetoRpc(projetoId, patch)

  const { data, error } = await supabase
    .from('projetos')
    .select('status, data_conclusao_real, justificativa_cancelamento, snapshot_fechamento')
    .eq('id', projetoId)
    .single()

  if (error) throw new Error(error.message)

  return {
    status: data.status as ProjetoStatus,
    data_conclusao_real: data.data_conclusao_real as string | null,
    justificativa_cancelamento: data.justificativa_cancelamento as string | null,
    snapshot_fechamento: (data.snapshot_fechamento as Record<string, unknown> | null) ?? null,
  }
}
