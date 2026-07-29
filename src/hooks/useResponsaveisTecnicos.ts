import { useCallback, useEffect, useState } from 'react'
import {
  deactivateResponsavelTecnico,
  fetchResponsaveisTecnicosAtivos,
  upsertResponsavelTecnicoRpc,
  type UpsertResponsavelTecnicoParams,
} from '../lib/responsavelTecnico'
import type { ResponsavelTecnico } from '../types'

export interface ResponsavelTecnicoFormData {
  nome: string
  documento: string
  registro: string
}

export const EMPTY_RT_FORM: ResponsavelTecnicoFormData = {
  nome: '',
  documento: '',
  registro: '',
}

export function useResponsaveisTecnicos(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false
  const [items, setItems] = useState<ResponsavelTecnico[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchResponsaveisTecnicosAtivos())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar responsáveis técnicos')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])

  const upsert = useCallback(
    async (params: UpsertResponsavelTecnicoParams): Promise<string> => {
      const id = await upsertResponsavelTecnicoRpc(params)
      await load()
      return id
    },
    [load],
  )

  const deactivate = useCallback(
    async (rt: ResponsavelTecnico): Promise<void> => {
      await deactivateResponsavelTecnico(rt)
      await load()
    },
    [load],
  )

  return { items, loading, error, reload: load, upsert, deactivate }
}
