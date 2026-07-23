import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

const PROFILE_MISSING_MESSAGE =
  'Perfil não encontrado. Solicite convite ao gestor do escritório.'

const PASSWORD_RECOVERY_KEY = 'vince_password_recovery'

export function isPasswordRecoveryPending(): boolean {
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_KEY) === '1'
  } catch {
    return false
  }
}

function markPasswordRecovery(): void {
  try {
    sessionStorage.setItem(PASSWORD_RECOVERY_KEY, '1')
  } catch {
    /* ignore */
  }
}

function clearPasswordRecoveryStorage(): void {
  try {
    sessionStorage.removeItem(PASSWORD_RECOVERY_KEY)
  } catch {
    /* ignore */
  }
}

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
  profileLoading: boolean
  passwordRecovery: boolean
  error: string | null
  login: (email: string, password: string) => Promise<Profile>
  logout: () => Promise<void>
  refreshProfile: () => Promise<Profile | null>
  clearError: () => void
  clearPasswordRecovery: () => void
}

const AuthContext = createContext<UseAuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(() => isPasswordRecoveryPending())
  const [error, setError] = useState<string | null>(null)

  const clearPasswordRecovery = useCallback(() => {
    clearPasswordRecoveryStorage()
    setPasswordRecovery(false)
  }, [])

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
    setProfileLoading(true)
    try {
      return await loadProfile(session.user.id)
    } finally {
      setProfileLoading(false)
    }
  }, [loadProfile, session?.user])

  // Bootstrap da sessão: listener ANTES de getSession (evita deadlock supabase-js).
  // NUNCA await/chamadas supabase dentro do callback (deadlock conhecido).
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        markPasswordRecovery()
        setPasswordRecovery(true)
      }

      setSession(nextSession)
      setLoading(false)

      if (!nextSession?.user) {
        setProfile(null)
        setProfileLoading(false)
        setError(null)
        clearPasswordRecoveryStorage()
        setPasswordRecovery(false)
      }
    })

    void supabase.auth.getSession().then(({ data: { session: currentSession }, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message)
      }
      setSession(currentSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Profile fora do callback de auth — reage a mudanças de usuário na sessão.
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    let cancelled = false
    setProfileLoading(true)

    void loadProfile(userId).finally(() => {
      if (!cancelled) {
        setProfileLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [loadProfile, session?.user?.id])

  // Failsafe: nunca deixar o boot preso em "Carregando...".
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 6000)
    return () => clearTimeout(timeout)
  }, [])

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      setLoading(true)
      setError(null)
      clearPasswordRecovery()

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
    },
    [clearPasswordRecovery],
  )

  const handleLogout = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      await logout()
      setSession(null)
      setProfile(null)
      clearPasswordRecovery()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao sair.'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [clearPasswordRecovery])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value = useMemo<UseAuthState>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      loading,
      profileLoading,
      passwordRecovery,
      error,
      login: handleLogin,
      logout: handleLogout,
      refreshProfile,
      clearError,
      clearPasswordRecovery,
    }),
    [
      session,
      profile,
      loading,
      profileLoading,
      passwordRecovery,
      error,
      handleLogin,
      handleLogout,
      refreshProfile,
      clearError,
      clearPasswordRecovery,
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
