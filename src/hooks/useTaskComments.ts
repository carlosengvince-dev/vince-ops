import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createComentario,
  fetchComentarios,
  softDeleteComentario,
  type ComentarioRow,
} from '../lib/comentarios'

function withoutDeleted(rows: ComentarioRow[], deletedIds: ReadonlySet<string>): ComentarioRow[] {
  if (deletedIds.size === 0) return rows
  return rows.filter((row) => !deletedIds.has(row.id))
}

export function useTaskComments(
  tarefaId: string,
  projetoId: string,
  tarefaNome: string,
  enabled: boolean,
) {
  const [comentarios, setComentarios] = useState<ComentarioRow[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadGenerationRef = useRef(0)
  const deletedIdsRef = useRef<Set<string>>(new Set())

  const applyRows = useCallback((rows: ComentarioRow[]) => {
    setComentarios(withoutDeleted(rows, deletedIdsRef.current))
  }, [])

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchComentarios(tarefaId)
      if (generation !== loadGenerationRef.current) return
      applyRows(rows)
    } catch (err) {
      if (generation !== loadGenerationRef.current) return
      setError(err instanceof Error ? err.message : 'Erro ao carregar comentários')
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false)
      }
    }
  }, [tarefaId, applyRows])

  useEffect(() => {
    if (!enabled) return
    deletedIdsRef.current.clear()
    void load()
  }, [enabled, load, tarefaId])

  const send = useCallback(
    async (texto: string, autorId: string, autorNome: string) => {
      setSending(true)
      setError(null)
      try {
        const created = await createComentario({
          tarefaId,
          projetoId,
          tarefaNome,
          autorId,
          autorNome,
          texto,
        })
        loadGenerationRef.current += 1
        setComentarios((prev) => [...prev, created])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao enviar comentário')
        throw err
      } finally {
        setSending(false)
      }
    },
    [tarefaId, projetoId, tarefaNome],
  )

  const remove = useCallback(async (comentarioId: string) => {
    setError(null)

    try {
      await softDeleteComentario(comentarioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir comentário')
    } finally {
      deletedIdsRef.current.add(comentarioId)
      setComentarios((prev) => prev.filter((c) => c.id !== comentarioId))
    }
  }, [])

  return { comentarios, loading, sending, error, send, remove, reload: load }
}
