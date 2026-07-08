import { supabase } from './supabase'
import type { Disciplina, Fase } from '../types'

export interface InsertLiberacaoFaseRpcParams {
  p_projeto_id: string
  p_disciplina: Disciplina
  p_fase_liberada: Fase
  p_liberado_por: string
  p_justificativa: string
  p_tarefas_pendentes_ids: string[]
}

export async function insertLiberacaoFaseRpc(
  params: InsertLiberacaoFaseRpcParams,
): Promise<string> {
  const { data, error } = await supabase.rpc('insert_liberacao_fase', params)
  if (error) throw new Error(error.message)
  if (!data) throw new Error('insert_liberacao_fase não retornou id')
  return data as string
}
