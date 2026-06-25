import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DocumentoProjeto, Papel, Projeto, Tarefa } from '../types'
import type { ProjectHomeCliente } from '../components/projects/ProjectHomePanel'

export interface ProjectDetailData {
  projeto: Projeto & {
    cliente_nome: string | null
    cliente: ProjectHomeCliente | null
  }
  tarefas: Tarefa[]
  documentos: DocumentoProjeto[]
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

export function useProjectDetail(projectId: string | undefined) {
  const [data, setData] = useState<ProjectDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!projectId) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [projetoRes, tarefasRes, documentosRes] = await Promise.all([
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
    ])

    if (projetoRes.error) {
      setError(projetoRes.error.message)
      setData(null)
      setLoading(false)
      return
    }

    if (!projetoRes.data) {
      setError('Projeto não encontrado')
      setData(null)
      setLoading(false)
      return
    }

    const row = projetoRes.data as Record<string, unknown>
    const clienteRow = row.clientes as {
      nome: string
      cnpj_cpf: string | null
      contato: string | null
      email: string | null
    } | null

    setData({
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
      tarefas: (tarefasRes.data ?? []).map((raw) => {
        const t = raw as Record<string, unknown>
        const profile = t.profiles as { nome: string; papel: Papel } | null
        const { profiles: _profiles, ...rest } = t
        return {
          ...(rest as unknown as Tarefa),
          responsavel_nome: profile?.nome ?? null,
          responsavel_papel: profile?.papel ?? null,
        }
      }),
      documentos: (documentosRes.data ?? []) as DocumentoProjeto[],
    })
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail])

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
    loading,
    error,
    refresh: fetchDetail,
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
