import { logActivity } from './activityLog'
import { supabase } from './supabase'

export interface ComentarioRow {
  id: string
  tarefa_id: string
  autor_id: string
  texto: string
  created_at: string
  autor_nome: string
}

export async function fetchComentarios(tarefaId: string): Promise<ComentarioRow[]> {
  const { data, error } = await supabase
    .from('comentarios')
    .select('id, tarefa_id, autor_id, texto, created_at, profiles!autor_id(nome)')
    .eq('tarefa_id', tarefaId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? [])
    .filter((row) => {
      const r = row as Record<string, unknown>
      return r.tarefa_id === tarefaId
    })
    .map((row) => {
    const r = row as Record<string, unknown>
    const profile = r.profiles as { nome: string } | null
    return {
      id: r.id as string,
      tarefa_id: r.tarefa_id as string,
      autor_id: r.autor_id as string,
      texto: r.texto as string,
      created_at: r.created_at as string,
      autor_nome: profile?.nome ?? '—',
    }
  })
}

export async function createComentario(input: {
  tarefaId: string
  projetoId: string
  tarefaNome: string
  autorId: string
  autorNome: string
  texto: string
}): Promise<ComentarioRow> {
  const trimmed = input.texto.trim()
  if (!trimmed) throw new Error('Comentário não pode estar vazio')

  const { data, error } = await supabase
    .from('comentarios')
    .insert({
      tarefa_id: input.tarefaId,
      autor_id: input.autorId,
      texto: trimmed,
    })
    .select('id, tarefa_id, autor_id, texto, created_at')
    .single()

  if (error) throw new Error(error.message)

  await logActivity({
    projetoId: input.projetoId,
    usuarioId: input.autorId,
    tipo: 'comentario_adicionado',
    descricao: `${input.autorNome} comentou em "${input.tarefaNome}"`,
    metadata: {
      tarefa_id: input.tarefaId,
      comentario_id: data.id,
      tarefa_nome: input.tarefaNome,
    },
  })

  return {
    id: data.id,
    tarefa_id: data.tarefa_id,
    autor_id: data.autor_id,
    texto: data.texto,
    created_at: data.created_at,
    autor_nome: input.autorNome,
  }
}

export async function softDeleteComentario(comentarioId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_comentario', { comentario_id: comentarioId })

  if (error) throw error
}
