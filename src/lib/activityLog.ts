import { supabase } from './supabase'
import type { ActivityLogTipo, Papel } from '../types'

export interface LogActivityInput {
  projetoId: string
  usuarioId: string
  tipo: ActivityLogTipo
  descricao: string
  metadata?: Record<string, unknown>
}

export interface ActivityFeedItem {
  id: string
  tipo: ActivityLogTipo
  descricao: string
  created_at: string
  usuario_id: string
  usuario_nome: string
  usuario_papel: Papel
}

const ACTIVITY_FEED_LIMIT = 50

export async function logActivity(input: LogActivityInput): Promise<void> {
  const { error } = await supabase.from('activity_log').insert({
    projeto_id: input.projetoId,
    usuario_id: input.usuarioId,
    tipo: input.tipo,
    descricao: input.descricao,
    metadata: input.metadata ?? {},
  })

  if (error) {
    console.error('[activity_log] falha ao registrar evento:', error.message, input)
  }
}

export async function fetchProjectActivity(
  projetoId: string,
  limit = ACTIVITY_FEED_LIMIT,
): Promise<ActivityFeedItem[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, tipo, descricao, created_at, usuario_id, profiles!usuario_id(nome, papel)')
    .eq('projeto_id', projetoId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const profile = r.profiles as { nome: string; papel: Papel } | null
    return {
      id: r.id as string,
      tipo: r.tipo as ActivityLogTipo,
      descricao: r.descricao as string,
      created_at: r.created_at as string,
      usuario_id: r.usuario_id as string,
      usuario_nome: profile?.nome ?? '—',
      usuario_papel: profile?.papel ?? 'projetista',
    }
  })
}

export { ACTIVITY_FEED_LIMIT }
