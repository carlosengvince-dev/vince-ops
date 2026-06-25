type HorasChartListener = () => void

let version = 0
const listeners = new Set<HorasChartListener>()

export function getHorasChartVersion(): number {
  return version
}

export function bumpHorasChartVersion(): void {
  version += 1
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeHorasChartVersion(listener: HorasChartListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
