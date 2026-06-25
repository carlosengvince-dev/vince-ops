import { useEffect, useRef } from 'react'
import { debouncedSaveModalState, flushModalState } from '../lib/modalStorage'

export function useDebouncedModalPersistence<T extends object>(
  key: string | null,
  state: T,
  enabled: boolean,
): void {
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!enabled || !key) return

    debouncedSaveModalState(key, state)

    return () => {
      flushModalState(key, stateRef.current)
    }
  }, [key, state, enabled])

  useEffect(() => {
    if (!enabled || !key) return

    function persistNow() {
      flushModalState(key!, stateRef.current)
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') persistNow()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', persistNow)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', persistNow)
    }
  }, [key, enabled])
}
