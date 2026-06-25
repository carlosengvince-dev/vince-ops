import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CHAT_FEED_PAGE_SIZE,
  fetchChatFeed,
  fetchChatFeedAfter,
  sendChatMensagem,
  softDeleteChatMensagem,
  type ProjectChatFeedItem,
} from '../lib/projectChat'

const POLL_INTERVAL_MS = 30_000

function dedupeById(items: ProjectChatFeedItem[]): ProjectChatFeedItem[] {
  const seen = new Set<string>()
  const result: ProjectChatFeedItem[] = []
  for (const item of items) {
    const key = `${item.tipo}:${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

function sortAsc(items: ProjectChatFeedItem[]): ProjectChatFeedItem[] {
  return [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

function withoutDeletedMensagens(
  items: ProjectChatFeedItem[],
  deletedIds: ReadonlySet<string>,
): ProjectChatFeedItem[] {
  if (deletedIds.size === 0) return items
  return items.filter((item) => !(item.tipo === 'mensagem' && deletedIds.has(item.id)))
}

export function useProjectChat(projetoId: string | undefined, enabled: boolean) {
  const [items, setItems] = useState<ProjectChatFeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef(items)
  const deletedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const applyItems = useCallback((rows: ProjectChatFeedItem[]) => {
    setItems(withoutDeletedMensagens(rows, deletedIdsRef.current))
  }, [])

  const loadInitial = useCallback(async () => {
    if (!projetoId) return
    setLoading(true)
    setError(null)
    try {
      const feed = await fetchChatFeed(projetoId, CHAT_FEED_PAGE_SIZE)
      applyItems(feed)
      setHasMore(feed.length >= CHAT_FEED_PAGE_SIZE)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar chat')
    } finally {
      setLoading(false)
    }
  }, [projetoId, applyItems])

  const loadOlder = useCallback(async () => {
    if (!projetoId || loadingOlder || !hasMore) return
    const current = itemsRef.current
    if (current.length === 0) return

    setLoadingOlder(true)
    setError(null)
    try {
      const before = current[0].created_at
      const older = await fetchChatFeed(projetoId, CHAT_FEED_PAGE_SIZE, before)
      if (older.length === 0) {
        setHasMore(false)
        return
      }
      setItems((prev) =>
        withoutDeletedMensagens(sortAsc(dedupeById([...older, ...prev])), deletedIdsRef.current),
      )
      if (older.length < CHAT_FEED_PAGE_SIZE) {
        setHasMore(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar mensagens anteriores')
    } finally {
      setLoadingOlder(false)
    }
  }, [projetoId, loadingOlder, hasMore])

  const pollNew = useCallback(async () => {
    if (!projetoId) return
    const current = itemsRef.current
    if (current.length === 0) {
      await loadInitial()
      return
    }

    try {
      const after = current[current.length - 1].created_at
      const newer = await fetchChatFeedAfter(projetoId, after)
      if (newer.length === 0) return
      setItems((prev) =>
        withoutDeletedMensagens(sortAsc(dedupeById([...prev, ...newer])), deletedIdsRef.current),
      )
    } catch {
      // polling silencioso
    }
  }, [projetoId, loadInitial])

  const send = useCallback(
    async (texto: string, autorId: string) => {
      if (!projetoId) return null
      setSending(true)
      setError(null)
      try {
        const created = await sendChatMensagem(projetoId, texto, autorId)
        setItems((prev) =>
          withoutDeletedMensagens(sortAsc(dedupeById([...prev, created])), deletedIdsRef.current),
        )
        return created
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
        throw err
      } finally {
        setSending(false)
      }
    },
    [projetoId],
  )

  const deleteMensagem = useCallback(async (id: string) => {
    setError(null)

    try {
      await softDeleteChatMensagem(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a mensagem')
    } finally {
      deletedIdsRef.current.add(id)
      setItems((prev) => prev.filter((item) => !(item.tipo === 'mensagem' && item.id === id)))
    }
  }, [])

  useEffect(() => {
    if (!enabled || !projetoId) {
      setItems([])
      deletedIdsRef.current.clear()
      return
    }
    deletedIdsRef.current.clear()
    void loadInitial()
  }, [enabled, projetoId, loadInitial])

  useEffect(() => {
    if (!enabled || !projetoId) return
    const interval = window.setInterval(() => {
      void pollNew()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [enabled, projetoId, pollNew])

  return {
    items,
    loading,
    loadingOlder,
    hasMore,
    sending,
    error,
    loadOlder,
    send,
    deleteMensagem,
    refresh: loadInitial,
  }
}
