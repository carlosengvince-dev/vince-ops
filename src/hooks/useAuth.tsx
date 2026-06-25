import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

const PROFILE_MISSING_MESSAGE =
  'Perfil não encontrado. Solicite convite ao gestor do escritório.'

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error(PROFILE_MISSING_MESSAGE)
  }

  if (!data.ativo) {
    throw new Error('Usuário desativado. Entre em contato com o gestor.')
  }

  return data as Profile
}

export async function login(email: string, password: string): Promise<Profile> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data.user) {
    throw new Error('Falha ao autenticar usuário.')
  }

  try {
    return await getProfile(data.user.id)
  } catch (profileError) {
    await supabase.auth.signOut()
    throw profileError instanceof Error ? profileError : new Error(PROFILE_MISSING_MESSAGE)
  }
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }
}

export interface UseAuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<Profile>
  logout: () => Promise<void>
  refreshProfile: () => Promise<Profile | null>
  clearError: () => void
}

const AuthContext = createContext<UseAuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const loaded = await getProfile(userId)
      setProfile(loaded)
      setError(null)
      return loaded
    } catch (err) {
      const message = err instanceof Error ? err.message : PROFILE_MISSING_MESSAGE
      setProfile(null)
      setError(message)
      return null
    }
  }, [])

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    if (!session?.user) {
      setProfile(null)
      return null
    }
    return loadProfile(session.user.id)
  }, [loadProfile, session?.user])

  useEffect(() => {
    let mounted = true

    async function initSession() {
      const { data, error: sessionError } = await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError) {
        setError(sessionError.message)
        setLoading(false)
        return
      }

      const currentSession = data.session
      setSession(currentSession)

      if (currentSession?.user) {
        await loadProfile(currentSession.user.id)
      } else {
        setProfile(null)
      }

      setLoading(false)
    }

    void initSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return

      setSession(nextSession)

      if (nextSession?.user) {
        setLoading(true)
        await loadProfile(nextSession.user.id)
        setLoading(false)
      } else {
        setProfile(null)
        setError(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const handleLogin = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)

    try {
      const loadedProfile = await login(email, password)
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setProfile(loadedProfile)
      return loadedProfile
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login.'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const handleLogout = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      await logout()
      setSession(null)
      setProfile(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao sair.'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value = useMemo<UseAuthState>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      loading,
      error,
      login: handleLogin,
      logout: handleLogout,
      refreshProfile,
      clearError,
    }),
    [
      session,
      profile,
      loading,
      error,
      handleLogin,
      handleLogout,
      refreshProfile,
      clearError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): UseAuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  }
  return context
}
