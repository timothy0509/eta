import { getEtaDbIndexes } from '@/lib/eta/direct/eta-db'
import { markPerf, timeAsync } from '@/lib/eta/perf'

let prefetched = false

function scheduleIdle(callback: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback, { timeout: 2000 })
  } else {
    setTimeout(callback, 0)
  }
}

function shouldDeferPrefetch(): boolean {
  if (typeof navigator === 'undefined') return false
  const connection = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }
  const net = connection.connection
  if (net?.saveData) return true
  const effectiveType = net?.effectiveType ?? ''
  return effectiveType.includes('2g')
}

export function prefetchEtaDb(): void {
  if (prefetched) return
  // Skip early prefetch on saveData or 2G until the first search needs it.
  if (shouldDeferPrefetch()) return
  prefetched = true

  scheduleIdle(() => {
    markPerf('eta-db:prefetch-start')
    void timeAsync('eta-db:prefetch', () => getEtaDbIndexes()).catch(() => {
      // Prefetch failure is silent — the pane will retry on mount
      prefetched = false
    })
  })
}
