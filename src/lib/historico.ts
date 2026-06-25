import { supabase } from './supabase'
import type { Disciplina, ModoCriacao, ProjetoStatus } from '../types'

export interface HistoricoProjetoRow {
  id: string
  codigo: string
  numero_sequencial: number
  nome: string
  status: ProjetoStatus
  modo_criacao: ModoCriacao
  disciplinas: Disciplina[]
  cliente_id: string | null
  cliente_nome: string | null
  data_inicio: string | null
  data_conclusao_real: string | null
  horas_totais_segundos: number
}

function mapHistoricoRow(
  row: Record<string, unknown>,
  horasByProjeto: Map<string, number>,
): HistoricoProjetoRow {
  const cliente = row.clientes as { nome: string } | null | undefined
  const id = row.id as string
  return {
    id,
    codigo: row.codigo as string,
    numero_sequencial: row.numero_sequencial as number,
    nome: row.nome as string,
    status: row.status as ProjetoStatus,
    modo_criacao: row.modo_criacao as ModoCriacao,
    disciplinas: row.disciplinas as Disciplina[],
    cliente_id: row.cliente_id as string | null,
    cliente_nome: cliente?.nome ?? null,
    data_inicio: row.data_inicio as string | null,
    data_conclusao_real: row.data_conclusao_real as string | null,
    horas_totais_segundos: horasByProjeto.get(id) ?? 0,
  }
}

async function fetchHorasByProjeto(projetoIds: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>()
  if (projetoIds.length === 0) return totals

  const { data, error } = await supabase
    .from('registros_tempo')
    .select('duracao_segundos, tarefas!inner(projeto_id)')
    .in('tarefas.projeto_id', projetoIds)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    const tarefa = r.tarefas as { projeto_id: string } | { projeto_id: string }[] | null
    const projetoId = Array.isArray(tarefa) ? tarefa[0]?.projeto_id : tarefa?.projeto_id
    if (!projetoId) continue
    const segundos = (r.duracao_segundos as number | null) ?? 0
    totals.set(projetoId, (totals.get(projetoId) ?? 0) + segundos)
  }

  return totals
}

export function isProjetoHistoricoReadOnly(projeto: {
  status: ProjetoStatus
  modo_criacao: ModoCriacao
}): boolean {
  if (projeto.modo_criacao === 'historico') return true
  return projeto.status === 'concluido' || projeto.status === 'cancelado' || projeto.status === 'suspenso'
}

export function formatHistoricoHoras(segundos: number): string {
  if (segundos <= 0) return '—'
  const horas = Math.round((segundos / 3600) * 10) / 10
  return `${horas}h`
}

export function formatHistoricoDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export async function fetchHistoricoProjects(): Promise<HistoricoProjetoRow[]> {
  const { data, error } = await supabase
    .from('projetos')
    .select('*, clientes(nome)')
    .or('status.in.(concluido,cancelado,suspenso),modo_criacao.eq.historico')
    .is('deleted_at', null)
    .order('data_conclusao_real', { ascending: false, nullsFirst: false })

  if (error) throw new Error(error.message)

  const rows = data ?? []
  const projetoIds = rows.map((r) => (r as Record<string, unknown>).id as string)
  const horasByProjeto = await fetchHorasByProjeto(projetoIds)

  return rows.map((r) => mapHistoricoRow(r as Record<string, unknown>, horasByProjeto))
}

export async function reabrirProjetoSuspenso(projetoId: string): Promise<void> {
  const { error } = await supabase
    .from('projetos')
    .update({ status: 'ativo', updated_at: new Date().toISOString() })
    .eq('id', projetoId)
    .eq('status', 'suspenso')

  if (error) throw new Error(error.message)
}
