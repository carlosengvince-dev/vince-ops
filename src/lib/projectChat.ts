import { supabase } from './supabase'
import type { Disciplina, Fase, Papel } from '../types'

export const CHAT_FEED_PAGE_SIZE = 50

export interface ProjectChatFeedItem {
  id: string
  tipo: 'mensagem' | 'comentario'
  autor_id: string
  autor_nome: string
  autor_papel: string
  texto: string
  created_at: string
  tarefa_id?: string
  tarefa_nome?: string
  tarefa_disciplina?: string
  tarefa_fase?: string
}

export function chatDraftKey(projetoId: string): string {
  return `chat_draft_${projetoId}`
}

function mergeFeedItems(
  mensagens: ProjectChatFeedItem[],
  comentarios: ProjectChatFeedItem[],
): ProjectChatFeedItem[] {
  return [...mensagens, ...comentarios].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

function mapMensagemRow(row: Record<string, unknown>): ProjectChatFeedItem {
  const profile = row.profiles as { nome: string; papel: Papel } | null
  return {
    id: row.id as string,
    tipo: 'mensagem',
    autor_id: row.autor_id as string,
    autor_nome: profile?.nome ?? '—',
    autor_papel: profile?.papel ?? 'projetista',
    texto: row.texto as string,
    created_at: row.created_at as string,
  }
}

function mapComentarioRow(row: Record<string, unknown>): ProjectChatFeedItem | null {
  const tarefaId = row.tarefa_id as string | null | undefined
  if (!tarefaId) return null

  const profile = row.profiles as { nome: string; papel: Papel } | null
  const tarefaRaw = row.tarefas
  const tarefa = (Array.isArray(tarefaRaw) ? tarefaRaw[0] : tarefaRaw) as
    | { nome: string; disciplina: Disciplina; fase: Fase }
    | null
    | undefined

  if (!tarefa?.nome || !tarefa.disciplina || !tarefa.fase) return null

  return {
    id: row.id as string,
    tipo: 'comentario',
    autor_id: row.autor_id as string,
    autor_nome: profile?.nome ?? '—',
    autor_papel: profile?.papel ?? 'projetista',
    texto: row.texto as string,
    created_at: row.created_at as string,
    tarefa_id: tarefaId,
    tarefa_nome: tarefa.nome,
    tarefa_disciplina: tarefa.disciplina,
    tarefa_fase: tarefa.fase,
  }
}

async function fetchProjetoTarefaIds(projetoId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tarefas')
    .select('id')
    .eq('projeto_id', projetoId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.id)
}

async function fetchMensagensSlice(
  projetoId: string,
  opts: { before?: string; after?: string; limit: number },
): Promise<ProjectChatFeedItem[]> {
  let query = supabase
    .from('chat_mensagens')
    .select('id, autor_id, texto, created_at, profiles!autor_id(nome, papel)')
    .eq('projeto_id', projetoId)
    .is('deleted_at', null)

  if (opts.before) query = query.lt('created_at', opts.before)
  if (opts.after) query = query.gt('created_at', opts.after)

  const ascending = Boolean(opts.after)
  query = query.order('created_at', { ascending }).limit(opts.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const items = (data ?? []).map((row) => mapMensagemRow(row as Record<string, unknown>))
  return ascending ? items : items.reverse()
}

async function fetchComentariosSlice(
  projetoId: string,
  opts: { before?: string; after?: string; limit: number },
): Promise<ProjectChatFeedItem[]> {
  const tarefaIds = await fetchProjetoTarefaIds(projetoId)
  if (tarefaIds.length === 0) return []

  let query = supabase
    .from('comentarios')
    .select(
      'id, tarefa_id, autor_id, texto, created_at, profiles!autor_id(nome, papel), tarefas!inner(nome, disciplina, fase)',
    )
    .in('tarefa_id', tarefaIds)
    .not('tarefa_id', 'is', null)
    .is('deleted_at', null)

  if (opts.before) query = query.lt('created_at', opts.before)
  if (opts.after) query = query.gt('created_at', opts.after)

  const ascending = Boolean(opts.after)
  query = query.order('created_at', { ascending }).limit(opts.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const items = (data ?? [])
    .map((row) => mapComentarioRow(row as Record<string, unknown>))
    .filter((item): item is ProjectChatFeedItem => item != null)

  return ascending ? items : items.reverse()
}

function takeLatestMerged(
  mensagens: ProjectChatFeedItem[],
  comentarios: ProjectChatFeedItem[],
  limit: number,
): ProjectChatFeedItem[] {
  const merged = mergeFeedItems(mensagens, comentarios)
  if (merged.length <= limit) return merged
  return merged.slice(merged.length - limit)
}

function takeOldestBeforeMerged(
  mensagens: ProjectChatFeedItem[],
  comentarios: ProjectChatFeedItem[],
  before: string,
  limit: number,
): ProjectChatFeedItem[] {
  const merged = mergeFeedItems(mensagens, comentarios).filter(
    (item) => item.created_at < before,
  )
  if (merged.length <= limit) return merged
  return merged.slice(merged.length - limit)
}

export async function fetchChatFeed(
  projetoId: string,
  limit = CHAT_FEED_PAGE_SIZE,
  before?: string,
): Promise<ProjectChatFeedItem[]> {
  const sliceOpts = { before, limit }

  const [mensagens, comentarios] = await Promise.all([
    fetchMensagensSlice(projetoId, sliceOpts),
    fetchComentariosSlice(projetoId, sliceOpts),
  ])

  if (before) {
    return takeOldestBeforeMerged(mensagens, comentarios, before, limit)
  }

  return takeLatestMerged(mensagens, comentarios, limit)
}

export async function fetchChatFeedAfter(
  projetoId: string,
  after: string,
  limit = CHAT_FEED_PAGE_SIZE,
): Promise<ProjectChatFeedItem[]> {
  const sliceOpts = { after, limit }

  const [mensagens, comentarios] = await Promise.all([
    fetchMensagensSlice(projetoId, sliceOpts),
    fetchComentariosSlice(projetoId, sliceOpts),
  ])

  return mergeFeedItems(mensagens, comentarios).filter((item) => item.created_at > after)
}

export async function sendChatMensagem(
  projetoId: string,
  texto: string,
  autorId: string,
): Promise<ProjectChatFeedItem> {
  const trimmed = texto.trim()
  if (!trimmed) throw new Error('Mensagem não pode estar vazia')

  const { data, error } = await supabase
    .from('chat_mensagens')
    .insert({
      projeto_id: projetoId,
      autor_id: autorId,
      texto: trimmed,
    })
    .select('id, autor_id, texto, created_at, profiles!autor_id(nome, papel)')
    .single()

  if (error) throw new Error(error.message)
  return mapMensagemRow(data as Record<string, unknown>)
}

export async function softDeleteChatMensagem(mensagemId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_chat_mensagem', { mensagem_id: mensagemId })

  if (error) throw error
}
