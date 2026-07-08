import { useCallback, useEffect, useState } from 'react'
import { deleteClienteRpc, fetchClienteById, upsertClienteRpc } from '../lib/clienteRpc'
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

function toRpcParams(data: ClienteFormData, id: string | null = null) {
  return {
    p_id: id,
    p_nome: data.nome.trim(),
    p_contato: data.contato.trim() || null,
    p_email: data.email.trim() || null,
    p_telefone: data.telefone.trim() || null,
    p_cnpj_cpf: data.cnpj_cpf.trim() || null,
    p_observacoes: data.observacoes.trim() || null,
    p_metadata: {},
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
      const id = await upsertClienteRpc(toRpcParams(data))
      const created = await fetchClienteById(id)
      await fetchClientes()
      return created
    },
    [fetchClientes],
  )

  const updateCliente = useCallback(
    async (id: string, data: ClienteFormData): Promise<Cliente> => {
      await upsertClienteRpc(toRpcParams(data, id))
      const updated = await fetchClienteById(id)
      await fetchClientes()
      return updated
    },
    [fetchClientes],
  )

  const deleteCliente = useCallback(
    async (id: string): Promise<void> => {
      await deleteClienteRpc(id)
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
