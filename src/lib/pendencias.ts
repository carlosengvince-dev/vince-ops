import { supabase } from './supabase'
import type {
  PendenciaExterna,
  PendenciaOrgao,
  PendenciaStatus,
  PendenciaTipo,
} from '../types'

export const PENDENCIA_ORGAOS: PendenciaOrgao[] = ['CBMSC', 'EMASA', 'Cliente', 'Outro']

export const PENDENCIA_TIPOS: PendenciaTipo[] = [
  'Comunique-se',
  'Exigência',
  'Solicitação',
  'Dúvida',
]

export const PENDENCIA_STATUS_LABELS: Record<PendenciaStatus, string> = {
  aberta: 'Aberta',
  respondida: 'Respondida',
  cancelada: 'Cancelada',
}

export type PrazoUrgency = 'overdue' | 'soon' | 'normal'

export function getPrazoUrgency(prazo: string | null, now = new Date()): PrazoUrgency | null {
  if (!prazo) return null

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const deadline = new Date(prazo + 'T00:00:00')

  if (deadline < today) return 'overdue'

  const inSevenDays = new Date(today)
  inSevenDays.setDate(inSevenDays.getDate() + 7)
  if (deadline <= inSevenDays) return 'soon'

  return 'normal'
}

export function formatPrazoDate(prazo: string): string {
  return new Date(prazo + 'T00:00:00').toLocaleDateString('pt-BR')
}

export interface CreatePendenciaInput {
  projetoId: string
  orgao: PendenciaOrgao
  tipo: PendenciaTipo
  descricao: string
  prazo: string | null
  dataRecebimento: string | null
  tarefasVinculadas: string[]
  criadoPor: string
}

function mapPendenciaRow(row: Record<string, unknown>): PendenciaExterna {
  const profile = row.profiles as { nome: string } | null
  return {
    id: row.id as string,
    projeto_id: row.projeto_id as string,
    orgao: row.orgao as PendenciaOrgao,
    tipo: row.tipo as PendenciaTipo,
    descricao: row.descricao as string,
    prazo: (row.prazo as string | null) ?? null,
    status: row.status as PendenciaStatus,
    revisao_gerada_id: (row.revisao_gerada_id as string | null) ?? null,
    data_recebimento: (row.data_recebimento as string | null) ?? null,
    tarefas_vinculadas: (row.tarefas_vinculadas as string[] | null) ?? [],
    criado_por: (row.criado_por as string | null) ?? null,
    criado_por_nome: profile?.nome ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function fetchProjectPendencias(projetoId: string): Promise<PendenciaExterna[]> {
  const { data, error } = await supabase
    .from('pendencias_externas')
    .select('*, profiles!criado_por(nome)')
    .eq('projeto_id', projetoId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => mapPendenciaRow(row as Record<string, unknown>))
}

export async function createPendencia(input: CreatePendenciaInput): Promise<PendenciaExterna> {
  const { data, error } = await supabase
    .from('pendencias_externas')
    .insert({
      projeto_id: input.projetoId,
      orgao: input.orgao,
      tipo: input.tipo,
      descricao: input.descricao.trim(),
      prazo: input.prazo || null,
      data_recebimento: input.dataRecebimento || null,
      tarefas_vinculadas: input.tarefasVinculadas,
      criado_por: input.criadoPor,
      status: 'aberta',
    })
    .select('*, profiles!criado_por(nome)')
    .single()

  if (error) throw new Error(error.message)

  return mapPendenciaRow(data as Record<string, unknown>)
}

export interface UpdatePendenciaInput {
  orgao: PendenciaOrgao
  tipo: PendenciaTipo
  descricao: string
  prazo: string | null
  dataRecebimento: string | null
  tarefasVinculadas: string[]
}

export async function updatePendencia(
  pendenciaId: string,
  input: UpdatePendenciaInput,
): Promise<PendenciaExterna> {
  const { data, error } = await supabase
    .from('pendencias_externas')
    .update({
      orgao: input.orgao,
      tipo: input.tipo,
      descricao: input.descricao.trim(),
      prazo: input.prazo || null,
      data_recebimento: input.dataRecebimento || null,
      tarefas_vinculadas: input.tarefasVinculadas,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendenciaId)
    .select('*, profiles!criado_por(nome)')
    .single()

  if (error) throw new Error(error.message)

  return mapPendenciaRow(data as Record<string, unknown>)
}

export async function updatePendenciaStatus(
  pendenciaId: string,
  status: PendenciaStatus,
): Promise<void> {
  const { error } = await supabase
    .from('pendencias_externas')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendenciaId)

  if (error) throw new Error(error.message)
}
