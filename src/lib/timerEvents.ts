type TimerStoppedListener = () => void
type TimerStartedListener = () => void
type RegistrosTempoChangedListener = () => void

const stoppedListeners = new Set<TimerStoppedListener>()
const startedListeners = new Set<TimerStartedListener>()
const registrosChangedListeners = new Set<RegistrosTempoChangedListener>()

export function subscribeTimerStopped(listener: TimerStoppedListener): () => void {
  stoppedListeners.add(listener)
  return () => stoppedListeners.delete(listener)
}

export function subscribeTimerStarted(listener: TimerStartedListener): () => void {
  startedListeners.add(listener)
  return () => startedListeners.delete(listener)
}

export function notifyTimerStopped(): void {
  for (const listener of stoppedListeners) {
    listener()
  }
}

export function notifyTimerStarted(): void {
  for (const listener of startedListeners) {
    listener()
  }
}

export function subscribeRegistrosTempoChanged(
  listener: RegistrosTempoChangedListener,
): () => void {
  registrosChangedListeners.add(listener)
  return () => registrosChangedListeners.delete(listener)
}

export function notifyRegistrosTempoChanged(): void {
  for (const listener of registrosChangedListeners) {
    listener()
  }
}
