import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ProjetoFaseOverride } from '../lib/faseConfig'
import { mergeTarefasFromRemote } from '../lib/projectTasks'
import type { DocumentoProjeto, Papel, Projeto, Tarefa } from '../types'
import type { ProjectHomeCliente } from '../components/projects/ProjectHomePanel'

const detailCache = new Map<string, ProjectDetailData>()
const TAREFAS_POLL_INTERVAL_MS = 30_000
const TAREFAS_POLL_AUTH_RETRY_MS = 1_000

function isTransientAuthError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('jwt') ||
    lower.includes('unauthorized') ||
    lower.includes('not authenticated') ||
    lower.includes('invalid claim') ||
    lower.includes('refresh_token') ||
    lower.includes('401') ||
    lower.includes('pgrst301') ||
    (lower.includes('session') && (lower.includes('expired') || lower.includes('missing')))
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export interface ProjectDetailData {
  projeto: Projeto & {
    cliente_nome: string | null
    cliente: ProjectHomeCliente | null
  }
  tarefas: Tarefa[]
  documentos: DocumentoProjeto[]
  projetoFaseOverrides: ProjetoFaseOverride[]
}

type ProjetoPatch = Partial<
  Pick<
    Projeto,
    | 'endereco'
    | 'tipo_edificacao'
    | 'cliente_id'
    | 'metadata'
    | 'disciplinas'
    | 'metodologia'
    | 'fases_atuais'
    | 'status'
    | 'data_conclusao_real'
    | 'justificativa_cancelamento'
    | 'snapshot_fechamento'
  >
> & {
  cliente_nome?: string | null
  cliente?: ProjectHomeCliente | null
}

function mapTarefaRow(raw: Record<string, unknown>): Tarefa {
  const profile = raw.profiles as { nome: string; papel: Papel } | null
  const { profiles: _profiles, ...rest } = raw
  return {
    ...(rest as unknown as Tarefa),
    responsavel_nome: profile?.nome ?? null,
    responsavel_papel: profile?.papel ?? null,
  }
}

async function fetchTarefasForProjeto(projectId: string): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from('tarefas')
    .select('*, profiles!responsavel_id(nome, papel)')
    .eq('projeto_id', projectId)
    .is('deleted_at', null)
    .order('ordem', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((raw) => mapTarefaRow(raw as Record<string, unknown>))
}

export function useProjectDetail(projectId: string | undefined) {
  const [data, setData] = useState<ProjectDetailData | null>(() =>
    projectId ? (detailCache.get(projectId) ?? null) : null,
  )
  const [initialLoading, setInitialLoading] = useState(
    () => (projectId ? !detailCache.has(projectId) : false),
  )
  const [error, setError] = useState<string | null>(null)
  const [tarefasSyncing, setTarefasSyncing] = useState(false)
  const pollInFlightRef = useRef(false)
  const dataRef = useRef(data)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  const fetchDetail = useCallback(async () => {
    if (!projectId) {
      setData(null)
      setInitialLoading(false)
      return
    }

    const hasCache = detailCache.has(projectId)
    if (!hasCache) setInitialLoading(true)
    setError(null)

    const [projetoRes, tarefasRes, documentosRes, projetoFasesRes] = await Promise.all([
      supabase
        .from('projetos')
        .select('*, clientes(nome, cnpj_cpf, contato, email)')
        .eq('id', projectId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('tarefas')
        .select('*, profiles!responsavel_id(nome, papel)')
        .eq('projeto_id', projectId)
        .is('deleted_at', null)
        .order('ordem', { ascending: true }),
      supabase
        .from('documentos_projeto')
        .select('*')
        .eq('projeto_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('projeto_fases')
        .select('fase_config_id, ativa, fases_config(codigo)')
        .eq('projeto_id', projectId),
    ])

    if (projetoRes.error) {
      setError(projetoRes.error.message)
      if (!hasCache) setData(null)
      setInitialLoading(false)
      return
    }

    if (!projetoRes.data) {
      setError('Projeto não encontrado')
      if (!hasCache) setData(null)
      setInitialLoading(false)
      return
    }

    const row = projetoRes.data as Record<string, unknown>
    const clienteRow = row.clientes as {
      nome: string
      cnpj_cpf: string | null
      contato: string | null
      email: string | null
    } | null

    const nextData: ProjectDetailData = {
      projeto: {
        ...(row as unknown as Projeto),
        cliente_nome: clienteRow?.nome ?? null,
        cliente: clienteRow
          ? {
              nome: clienteRow.nome,
              cnpj_cpf: clienteRow.cnpj_cpf,
              contato: clienteRow.contato,
              email: clienteRow.email,
            }
          : null,
      },
      tarefas: (tarefasRes.data ?? []).map((raw) => mapTarefaRow(raw as Record<string, unknown>)),
      documentos: (documentosRes.data ?? []) as DocumentoProjeto[],
      projetoFaseOverrides: (projetoFasesRes.data ?? []).map((raw) => {
        const overrideRow = raw as Record<string, unknown>
        const fase = overrideRow.fases_config as { codigo: string } | null
        return {
          fase_config_id: overrideRow.fase_config_id as string,
          codigo: (fase?.codigo ?? '') as ProjetoFaseOverride['codigo'],
          ativa: Boolean(overrideRow.ativa),
        }
      }),
    }

    detailCache.set(projectId, nextData)
    setData(nextData)
    setInitialLoading(false)
  }, [projectId])

  const pollTarefas = useCallback(async () => {
    if (!projectId || pollInFlightRef.current) return
    if (!dataRef.current) return

    pollInFlightRef.current = true
    setTarefasSyncing(true)

    const applyRemote = (remote: Tarefa[]) => {
      setData((prev) => {
        if (!prev || prev.projeto.id !== projectId) return prev
        const merged = mergeTarefasFromRemote(prev.tarefas, remote)
        if (merged === prev.tarefas) return prev
        const next = { ...prev, tarefas: merged }
        detailCache.set(projectId, next)
        return next
      })
    }

    try {
      try {
        const remote = await fetchTarefasForProjeto(projectId)
        applyRemote(remote)
      } catch (err) {
        // Foco do browser dispara refresh de token + poll juntos — retry silencioso 1x.
        if (!isTransientAuthError(err)) return
        await sleep(TAREFAS_POLL_AUTH_RETRY_MS)
        if (!dataRef.current || dataRef.current.projeto.id !== projectId) return
        const remote = await fetchTarefasForProjeto(projectId)
        applyRemote(remote)
      }
    } catch {
      // polling silencioso
    } finally {
      pollInFlightRef.current = false
      setTarefasSyncing(false)
    }
  }, [projectId])

  const restartPollTimerRef = useRef<(() => void) | null>(null)

  const refreshTarefas = useCallback(async () => {
    await pollTarefas()
    if (document.visibilityState === 'visible') {
      restartPollTimerRef.current?.()
    }
  }, [pollTarefas])

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail])

  // Polling de tarefas (30s) com pause em background + fetch imediato ao focar.
  useEffect(() => {
    if (!projectId || initialLoading) return

    let intervalId: number | null = null

    const clear = () => {
      if (intervalId != null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    const start = () => {
      clear()
      intervalId = window.setInterval(() => {
        void pollTarefas()
      }, TAREFAS_POLL_INTERVAL_MS)
    }

    restartPollTimerRef.current = start

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clear()
        return
      }
      void pollTarefas()
      start()
    }

    if (document.visibilityState === 'visible') {
      start()
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clear()
      restartPollTimerRef.current = null
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [projectId, initialLoading, pollTarefas])

  const patchTarefa = useCallback((tarefaId: string, patch: Partial<Tarefa>) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        tarefas: prev.tarefas.map((t) => (t.id === tarefaId ? { ...t, ...patch } : t)),
      }
    })
  }, [])

  const patchFasesAtuais = useCallback((fasesAtuais: Projeto['fases_atuais']) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        projeto: { ...prev.projeto, fases_atuais: fasesAtuais },
      }
    })
  }, [])

  const appendTarefas = useCallback((newTarefas: Tarefa[]) => {
    setData((prev) => {
      if (!prev || newTarefas.length === 0) return prev
      return {
        ...prev,
        tarefas: [...prev.tarefas, ...newTarefas],
      }
    })
  }, [])

  const appendTarefa = useCallback((tarefa: Tarefa) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        tarefas: [...prev.tarefas, tarefa],
      }
    })
  }, [])

  const removeTarefa = useCallback((tarefaId: string) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        tarefas: prev.tarefas.filter((t) => t.id !== tarefaId),
      }
    })
  }, [])

  const patchTarefasOrdem = useCallback((updates: { id: string; ordem: number }[]) => {
    setData((prev) => {
      if (!prev) return prev
      const ordemMap = new Map(updates.map((u) => [u.id, u.ordem]))
      return {
        ...prev,
        tarefas: prev.tarefas.map((t) =>
          ordemMap.has(t.id) ? { ...t, ordem: ordemMap.get(t.id)! } : t,
        ),
      }
    })
  }, [])

  const patchProjetoMetadata = useCallback((metadata: Record<string, unknown>) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        projeto: { ...prev.projeto, metadata },
      }
    })
  }, [])

  const patchProjeto = useCallback((patch: ProjetoPatch) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        projeto: { ...prev.projeto, ...patch },
      }
    })
  }, [])

  const removeTarefasByIds = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    setData((prev) => {
      if (!prev || ids.length === 0) return prev
      return {
        ...prev,
        tarefas: prev.tarefas.filter((t) => !idSet.has(t.id)),
      }
    })
  }, [])

  const patchDocumento = useCallback((docId: string, patch: Partial<DocumentoProjeto>) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        documentos: prev.documentos.map((d) => (d.id === docId ? { ...d, ...patch } : d)),
      }
    })
  }, [])

  const appendDocumento = useCallback((doc: DocumentoProjeto) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        documentos: [...prev.documentos, doc],
      }
    })
  }, [])

  const removeDocumento = useCallback((docId: string) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        documentos: prev.documentos.filter((d) => d.id !== docId),
      }
    })
  }, [])

  return {
    data,
    loading: initialLoading,
    initialLoading,
    error,
    tarefasSyncing,
    refresh: fetchDetail,
    refreshTarefas,
    patchTarefa,
    patchFasesAtuais,
    appendTarefas,
    appendTarefa,
    removeTarefa,
    patchTarefasOrdem,
    patchProjetoMetadata,
    patchProjeto,
    removeTarefasByIds,
    patchDocumento,
    appendDocumento,
    removeDocumento,
  }
}
