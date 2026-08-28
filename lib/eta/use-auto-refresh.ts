'use client'

import * as React from 'react'

/**
 * Add jitter to refresh intervals to prevent synchronized bursts.
 * Returns a value between 0.9x and 1.1x of the base interval.
 */
function addJitter(baseMs: number): number {
  const jitterFactor = 0.9 + Math.random() * 0.2 // 0.9 to 1.1
  return Math.round(baseMs * jitterFactor)
}

export function useAutoRefresh(refreshMs: number, refresh: () => void) {
  React.useEffect(() => {
    if (!refreshMs) return

    let timeout: ReturnType<typeof setTimeout> | undefined
    let lastRefreshTime = Date.now()

    const refreshWithTimestamp = () => {
      refresh()
      lastRefreshTime = Date.now()
    }

    const clear = () => {
      if (timeout) {
        clearTimeout(timeout)
        timeout = undefined
      }
    }

    const scheduleNext = () => {
      clear()
      const nextMs = addJitter(refreshMs)
      timeout = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          refreshWithTimestamp()
        }
        scheduleNext()
      }, nextMs)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastRefreshTime
        if (elapsed > refreshMs * 0.3) {
          refreshWithTimestamp()
        }
        // Re-anchor timer so we don't fire immediately after resume
        scheduleNext()
      } else {
        clear()
      }
    }

    scheduleNext()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clear()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshMs, refresh])
}
