import { useCallback, useEffect, useState } from 'react'
import { fetchActiveProfiles, type ActiveProfile } from '../lib/profiles'

let cachedProfiles: ActiveProfile[] | null = null
let fetchPromise: Promise<ActiveProfile[]> | null = null

async function loadProfiles(): Promise<ActiveProfile[]> {
  if (cachedProfiles) return cachedProfiles
  if (!fetchPromise) {
    fetchPromise = fetchActiveProfiles()
      .then((rows) => {
        cachedProfiles = rows
        return rows
      })
      .finally(() => {
        fetchPromise = null
      })
  }
  return fetchPromise
}

export function useActiveProfiles(enabled = true) {
  const [profiles, setProfiles] = useState<ActiveProfile[]>(cachedProfiles ?? [])
  const [loading, setLoading] = useState(enabled && !cachedProfiles)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    cachedProfiles = null
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchActiveProfiles()
      cachedProfiles = rows
      setProfiles(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (cachedProfiles) {
      setProfiles(cachedProfiles)
      setLoading(false)
      return
    }
    setLoading(true)
    void loadProfiles()
      .then(setProfiles)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar usuários')
      })
      .finally(() => setLoading(false))
  }, [enabled])

  return { profiles, loading, error, reload }
}

export function invalidateActiveProfilesCache(): void {
  cachedProfiles = null
}
