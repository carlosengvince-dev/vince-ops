import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchActiveTimers,
  fetchMyActiveTimer,
  startTimerRegistro,
  stopTimerRegistro,
  type ActiveTimerRow,
  type MyActiveTimer,
} from '../lib/timer'
import { notifyTimerStarted, notifyTimerStopped } from '../lib/timerEvents'
import { bumpHorasChartVersion } from '../lib/horasChartVersion'
import type { Tarefa } from '../types'
import { useAuth } from './useAuth'

const POLL_INTERVAL_MS = 30_000

interface TimerContextValue {
  activeTimers: ActiveTimerRow[]
  activeTimersLoading: boolean
  myActiveTimer: MyActiveTimer | null
  operating: boolean
  refreshTimers: () => Promise<void>
  startTimer: (tarefa: Pick<Tarefa, 'id' | 'projeto_id' | 'disciplina'>) => Promise<void>
  stopMyTimer: () => Promise<void>
  isTimerActiveOnTarefa: (tarefaId: string) => boolean
}

const TimerContext = createContext<TimerContextValue | null>(null)

export function TimerProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [activeTimers, setActiveTimers] = useState<ActiveTimerRow[]>([])
  const [activeTimersLoading, setActiveTimersLoading] = useState(true)
  const [myActiveTimer, setMyActiveTimer] = useState<MyActiveTimer | null>(null)
  const [operating, setOperating] = useState(false)

  const refreshTimers = useCallback(async () => {
    const [all, mine] = await Promise.all([
      fetchActiveTimers(),
      profile ? fetchMyActiveTimer(profile.id) : Promise.resolve(null),
    ])
    setActiveTimers(all)
    setMyActiveTimer(mine)
    setActiveTimersLoading(false)
  }, [profile])

  useEffect(() => {
    setActiveTimersLoading(true)
    void refreshTimers().catch(() => setActiveTimersLoading(false))
  }, [refreshTimers])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshTimers()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [refreshTimers])

  const stopMyTimer = useCallback(async () => {
    if (!myActiveTimer) return

    setOperating(true)
    try {
      await stopTimerRegistro(myActiveTimer.id, myActiveTimer.inicio)
      setMyActiveTimer(null)
      await refreshTimers()
      notifyTimerStopped()
      bumpHorasChartVersion()
    } finally {
      setOperating(false)
    }
  }, [myActiveTimer, refreshTimers])

  const startTimer = useCallback(
    async (tarefa: Pick<Tarefa, 'id' | 'projeto_id' | 'disciplina'>) => {
      if (!profile) throw new Error('Usuário não autenticado')

      setOperating(true)
      try {
        if (myActiveTimer && myActiveTimer.tarefaId !== tarefa.id) {
          await stopTimerRegistro(myActiveTimer.id, myActiveTimer.inicio)
          notifyTimerStopped()
          bumpHorasChartVersion()
        } else if (myActiveTimer?.tarefaId === tarefa.id) {
          return
        }

        const started = await startTimerRegistro(tarefa, profile.id)
        setMyActiveTimer(started)
        await refreshTimers()
        notifyTimerStarted()
      } finally {
        setOperating(false)
      }
    },
    [profile, myActiveTimer, refreshTimers],
  )

  const isTimerActiveOnTarefa = useCallback(
    (tarefaId: string) => myActiveTimer?.tarefaId === tarefaId,
    [myActiveTimer],
  )

  const value = useMemo(
    () => ({
      activeTimers,
      activeTimersLoading,
      myActiveTimer,
      operating,
      refreshTimers,
      startTimer,
      stopMyTimer,
      isTimerActiveOnTarefa,
    }),
    [
      activeTimers,
      activeTimersLoading,
      myActiveTimer,
      operating,
      refreshTimers,
      startTimer,
      stopMyTimer,
      isTimerActiveOnTarefa,
    ],
  )

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext)
  if (!ctx) {
    throw new Error('useTimer deve ser usado dentro de TimerProvider')
  }
  return ctx
}
