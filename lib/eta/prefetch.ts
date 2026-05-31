import { getEtaDbIndexes } from '@/lib/eta/direct/eta-db'

let prefetched = false

function scheduleIdle(callback: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback, { timeout: 2000 })
  } else {
    setTimeout(callback, 0)
  }
}

export function prefetchEtaDb(): void {
  if (prefetched) return
  prefetched = true

  scheduleIdle(() => {
    getEtaDbIndexes().catch(() => {
      // Prefetch failure is silent — the pane will retry on mount
      prefetched = false
    })
  })
}
