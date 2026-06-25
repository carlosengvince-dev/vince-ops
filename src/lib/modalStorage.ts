const debouncers = new Map<string, ReturnType<typeof setTimeout>>()

export function saveModalState(key: string, state: object): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

export function loadModalState<T>(key: string): T | null {
  try {
    const saved = sessionStorage.getItem(key)
    if (!saved) return null
    return JSON.parse(saved) as T
  } catch {
    return null
  }
}

export function clearModalState(key: string): void {
  sessionStorage.removeItem(key)
  const pending = debouncers.get(key)
  if (pending) {
    clearTimeout(pending)
    debouncers.delete(key)
  }
}

export function hasModalState(key: string): boolean {
  return sessionStorage.getItem(key) != null
}

export function debouncedSaveModalState(
  key: string,
  state: object,
  delayMs = 500,
): void {
  const pending = debouncers.get(key)
  if (pending) clearTimeout(pending)

  debouncers.set(
    key,
    setTimeout(() => {
      saveModalState(key, state)
      debouncers.delete(key)
    }, delayMs),
  )
}

/** Cancela debounce pendente e grava imediatamente (ex.: ao trocar aba ou desmontar). */
export function flushModalState(key: string, state: object): void {
  const pending = debouncers.get(key)
  if (pending) {
    clearTimeout(pending)
    debouncers.delete(key)
  }
  saveModalState(key, state)
}
