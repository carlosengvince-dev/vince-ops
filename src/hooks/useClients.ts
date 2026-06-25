import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Cliente, Projeto } from '../types'

export interface ClienteWithStats extends Cliente {
  projetosAtivos: number
  projetosTotal: number
}

export interface ClienteFormData {
  nome: string
  contato: string
  email: string
  telefone: string
  cnpj_cpf: string
  observacoes: string
}

export const EMPTY_CLIENTE_FORM: ClienteFormData = {
  nome: '',
  contato: '',
  email: '',
  telefone: '',
  cnpj_cpf: '',
  observacoes: '',
}

function aggregateStats(clientes: Cliente[], projetos: Pick<Projeto, 'cliente_id' | 'status'>[]) {
  const stats = new Map<string, { ativos: number; total: number }>()

  for (const projeto of projetos) {
    if (!projeto.cliente_id) continue
    const current = stats.get(projeto.cliente_id) ?? { ativos: 0, total: 0 }
    current.total += 1
    if (projeto.status === 'ativo' || projeto.status === 'em_revisao') {
      current.ativos += 1
    }
    stats.set(projeto.cliente_id, current)
  }

  return clientes.map((cliente) => {
    const counts = stats.get(cliente.id) ?? { ativos: 0, total: 0 }
    return {
      ...cliente,
      projetosAtivos: counts.ativos,
      projetosTotal: counts.total,
    }
  })
}

function toPayload(data: ClienteFormData) {
  return {
    nome: data.nome.trim(),
    contato: data.contato.trim() || null,
    email: data.email.trim() || null,
    telefone: data.telefone.trim() || null,
    cnpj_cpf: data.cnpj_cpf.trim() || null,
    observacoes: data.observacoes.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

export function useClients(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false
  const [clientes, setClientes] = useState<ClienteWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClientes = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [clientesRes, projetosRes] = await Promise.all([
      supabase
        .from('clientes')
        .select('*')
        .is('deleted_at', null)
        .order('nome', { ascending: true }),
      supabase
        .from('projetos')
        .select('cliente_id, status')
        .is('deleted_at', null),
    ])

    if (clientesRes.error) {
      setError(clientesRes.error.message)
      setClientes([])
      setLoading(false)
      return
    }

    if (projetosRes.error) {
      setError(projetosRes.error.message)
      setClientes([])
      setLoading(false)
      return
    }

    setClientes(
      aggregateStats(
        (clientesRes.data ?? []) as Cliente[],
        (projetosRes.data ?? []) as Pick<Projeto, 'cliente_id' | 'status'>[],
      ),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    if (enabled) {
      void fetchClientes()
    }
  }, [enabled, fetchClientes])

  const createCliente = useCallback(
    async (data: ClienteFormData): Promise<Cliente> => {
      const { data: created, error: insertError } = await supabase
        .from('clientes')
        .insert(toPayload(data))
        .select('*')
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      await fetchClientes()
      return created as Cliente
    },
    [fetchClientes],
  )

  const updateCliente = useCallback(
    async (id: string, data: ClienteFormData): Promise<Cliente> => {
      const { data: updated, error: updateError } = await supabase
        .from('clientes')
        .update(toPayload(data))
        .eq('id', id)
        .select('*')
        .single()

      if (updateError) {
        throw new Error(updateError.message)
      }

      await fetchClientes()
      return updated as Cliente
    },
    [fetchClientes],
  )

  const deleteCliente = useCallback(
    async (id: string): Promise<void> => {
      const { error: deleteError } = await supabase
        .from('clientes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      await fetchClientes()
    },
    [fetchClientes],
  )

  return {
    clientes,
    loading,
    error,
    refresh: fetchClientes,
    createCliente,
    updateCliente,
    deleteCliente,
  }
}
