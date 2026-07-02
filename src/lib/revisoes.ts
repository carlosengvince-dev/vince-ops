import { supabase } from './supabase'
import { insertTarefasRpc, type TarefaInsertRow } from './tarefaRpc'
import type { TemplateChecklist } from '../types'
import type {
  Disciplina,
  Fase,
  PendenciaOrgao,
  Revisao,
  RevisaoOrigem,
  Tarefa,
} from '../types'

export const REVISAO_ORIGENS: RevisaoOrigem[] = [
  'Exigência CBMSC',
  'Exigência EMASA',
  'Solicitação cliente',
  'Interno',
]

export const REVISAO_DISCIPLINAS: Disciplina[] = ['HID', 'PPCI']

export const REVISAO_STATUS_LABELS = {
  aberta: 'Aberta',
  concluida: 'Concluída',
} as const

export interface RevisaoPrefill {
  pendenciaId?: string
  origem?: RevisaoOrigem
  descricao?: string
  disciplina?: Disciplina
}

export interface CustomRevisionTask {
  nome: string
  fase: Fase
  categoria: string
}

export interface CreateRevisaoInput {
  projetoId: string
  numero: string
  disciplina: Disciplina
  origem: RevisaoOrigem
  descricao: string
  pendenciaId?: string | null
  templateIds: string[]
  customTasks: CustomRevisionTask[]
  templates: TemplateChecklist[]
  criadoPor: string
}

export interface RevisaoWithStats extends Revisao {
  tarefas_total: number
  tarefas_concluidas: number
}

const DONE_STATUSES = new Set(['concluido', 'nao_aplica'])

export function mapPendenciaOrgaoToOrigem(orgao: PendenciaOrgao): RevisaoOrigem {
  switch (orgao) {
    case 'CBMSC':
      return 'Exigência CBMSC'
    case 'EMASA':
      return 'Exigência EMASA'
    case 'Cliente':
      return 'Solicitação cliente'
    default:
      return 'Interno'
  }
}

export function suggestNextRevisionNumero(
  existing: Revisao[],
  disciplina: Disciplina,
): string {
  let max = 0
  for (const revisao of existing) {
    if (revisao.disciplina !== disciplina) continue
    const match = /^R(\d+)$/i.exec(revisao.numero.trim())
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10))
    }
  }
  return `R${String(max + 1).padStart(2, '0')}`
}

export function calcRevisaoTaskStats(
  revisaoId: string,
  tarefas: Tarefa[],
): { total: number; concluidas: number } {
  const revisionTasks = tarefas.filter((t) => t.revisao_id === revisaoId && t.deleted_at === null)
  const concluidas = revisionTasks.filter((t) => DONE_STATUSES.has(t.status)).length
  return { total: revisionTasks.length, concluidas }
}

export function canCompleteRevisao(revisaoId: string, tarefas: Tarefa[]): boolean {
  const { total, concluidas } = calcRevisaoTaskStats(revisaoId, tarefas)
  return total > 0 && total === concluidas
}

function mapRevisaoRow(row: Record<string, unknown>): Revisao {
  const profile = row.profiles as { nome: string } | null
  return {
    id: row.id as string,
    projeto_id: row.projeto_id as string,
    numero: row.numero as string,
    disciplina: row.disciplina as Disciplina,
    origem: row.origem as RevisaoOrigem,
    descricao: (row.descricao as string | null) ?? null,
    status: row.status as Revisao['status'],
    data_abertura: row.data_abertura as string,
    data_conclusao: (row.data_conclusao as string | null) ?? null,
    criado_por: (row.criado_por as string | null) ?? null,
    criado_por_nome: profile?.nome ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_at: row.created_at as string,
  }
}

export async function fetchProjectRevisoes(
  projetoId: string,
  disciplina?: Disciplina,
): Promise<Revisao[]> {
  let query = supabase
    .from('revisoes')
    .select('*, profiles!criado_por(nome)')
    .eq('projeto_id', projetoId)
    .is('deleted_at', null)

  if (disciplina) {
    query = query.eq('disciplina', disciplina)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRevisaoRow(row as Record<string, unknown>))
}

function templateToRevisionTarefaRow(
  template: TemplateChecklist,
  projetoId: string,
  revisaoId: string,
): TarefaInsertRow {
  return {
    projeto_id: projetoId,
    revisao_id: revisaoId,
    template_id: template.id,
    disciplina: template.disciplina,
    fase: template.fase,
    categoria: template.categoria,
    nome: template.nome,
    descricao: template.descricao,
    criticidade: template.criticidade,
    origem: template.origem,
    referencia_normativa: template.referencia_normativa,
    metodologia_minima: template.metodologia_minima,
    ordem: template.ordem,
    status: 'pendente',
  }
}

function customToRevisionTarefaRow(
  task: CustomRevisionTask,
  disciplina: Disciplina,
  projetoId: string,
  revisaoId: string,
  ordem: number,
): TarefaInsertRow {
  return {
    projeto_id: projetoId,
    revisao_id: revisaoId,
    template_id: null,
    disciplina,
    fase: task.fase,
    categoria: task.categoria,
    nome: task.nome.trim(),
    descricao: null,
    criticidade: 'normal',
    origem: 'interno',
    ordem,
    status: 'pendente',
  }
}

export async function createRevisao(
  input: CreateRevisaoInput,
): Promise<{ revisao: Revisao; tarefas: Tarefa[] }> {
  const { data: revisaoRow, error: revisaoError } = await supabase
    .from('revisoes')
    .insert({
      projeto_id: input.projetoId,
      numero: input.numero.trim(),
      disciplina: input.disciplina,
      origem: input.origem,
      descricao: input.descricao.trim() || null,
      status: 'aberta',
      criado_por: input.criadoPor,
    })
    .select('*, profiles!criado_por(nome)')
    .single()

  if (revisaoError) throw new Error(revisaoError.message)

  const revisao = mapRevisaoRow(revisaoRow as Record<string, unknown>)
  const templateMap = new Map(input.templates.map((t) => [t.id, t]))
  const selectedTemplates = input.templateIds
    .map((id) => templateMap.get(id))
    .filter((t): t is TemplateChecklist => t != null)

  const tarefaRows = [
    ...selectedTemplates.map((t) => templateToRevisionTarefaRow(t, input.projetoId, revisao.id)),
    ...input.customTasks.map((task, index) =>
      customToRevisionTarefaRow(
        task,
        input.disciplina,
        input.projetoId,
        revisao.id,
        9000 + index,
      ),
    ),
  ]

  let insertedTarefas: Tarefa[] = []

  if (tarefaRows.length > 0) {
    insertedTarefas = await insertTarefasRpc(tarefaRows)
  }

  if (input.pendenciaId) {
    const { error: pendenciaError } = await supabase
      .from('pendencias_externas')
      .update({
        revisao_gerada_id: revisao.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.pendenciaId)

    if (pendenciaError) throw new Error(pendenciaError.message)
  }

  return { revisao, tarefas: insertedTarefas }
}

export async function completeRevisao(revisaoId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('revisoes')
    .update({
      status: 'concluida',
      data_conclusao: today,
    })
    .eq('id', revisaoId)

  if (error) throw new Error(error.message)
}
