import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Organizacao } from '../types'

const ORG_SLUG = 'vince'

export function useOrganizacao(slug = ORG_SLUG) {
  const [organizacao, setOrganizacao] = useState<Pick<Organizacao, 'nome' | 'created_at'> | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrganizacao = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('organizacoes')
      .select('nome, created_at')
      .eq('slug', slug)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    if (queryError) {
      setError(queryError.message)
      setOrganizacao(null)
    } else {
      setOrganizacao(data as Pick<Organizacao, 'nome' | 'created_at'> | null)
    }

    setLoading(false)
  }, [slug])

  useEffect(() => {
    void fetchOrganizacao()
  }, [fetchOrganizacao])

  return { organizacao, loading, error, refresh: fetchOrganizacao }
}

function formatOrgCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

export function formatOrganizacaoCreatedAt(createdAt: string | undefined): string {
  if (!createdAt) return '—'
  const formatted = formatOrgCreatedAt(createdAt)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}
