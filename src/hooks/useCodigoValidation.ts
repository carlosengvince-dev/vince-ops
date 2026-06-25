import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface UseCodigoValidationOptions {
  /** Ignorar o próprio projeto na edição futura */
  excludeProjectId?: string
  debounceMs?: number
}

export function useCodigoValidation(
  codigo: string,
  options: UseCodigoValidationOptions = {},
) {
  const { excludeProjectId, debounceMs = 350 } = options
  const [checking, setChecking] = useState(false)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<number | null>(null)

  const validateNow = useCallback(async (): Promise<boolean> => {
    const normalized = codigo.trim().toUpperCase()

    if (!normalized) {
      setIsDuplicate(false)
      setError(null)
      setChecking(false)
      return true
    }

    setChecking(true)
    setError(null)

    let query = supabase
      .from('projetos')
      .select('id')
      .eq('codigo', normalized)
      .is('deleted_at', null)
      .limit(1)

    if (excludeProjectId) {
      query = query.neq('id', excludeProjectId)
    }

    const { data, error: queryError } = await query

    if (queryError) {
      setError(queryError.message)
      setIsDuplicate(false)
      setChecking(false)
      return false
    }

    const duplicate = (data?.length ?? 0) > 0
    setIsDuplicate(duplicate)
    setChecking(false)
    return !duplicate
  }, [codigo, excludeProjectId])

  const validate = useCallback(
    async (value: string) => {
      const normalized = value.trim().toUpperCase()

      if (!normalized) {
        setIsDuplicate(false)
        setError(null)
        setChecking(false)
        return
      }

      setChecking(true)
      setError(null)

      let query = supabase
        .from('projetos')
        .select('id')
        .eq('codigo', normalized)
        .is('deleted_at', null)
        .limit(1)

      if (excludeProjectId) {
        query = query.neq('id', excludeProjectId)
      }

      const { data, error: queryError } = await query

      if (queryError) {
        setError(queryError.message)
        setIsDuplicate(false)
        setChecking(false)
        return
      }

      setIsDuplicate((data?.length ?? 0) > 0)
      setChecking(false)
    },
    [excludeProjectId],
  )

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }

    debounceRef.current = window.setTimeout(() => {
      void validate(codigo)
    }, debounceMs)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [codigo, debounceMs, validate])

  return {
    checking,
    isDuplicate,
    error,
    validateNow,
    duplicateMessage: isDuplicate ? 'Código já utilizado em outro projeto' : null,
  }
}
