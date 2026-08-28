'use client'

import * as React from 'react'

/**
 * Hook that returns a timestamp (epoch ms) updated at a regular interval.
 * Useful for displaying ticking countdowns (e.g. "3 min" → "2 min")
 * without requiring a full data refresh.
 *
 * @param intervalMs How often to update the timestamp. Default 15_000 (15s).
 */
export function useTickingNow(intervalMs = 15_000): number {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined

    const start = () => {
      if (id) return
      id = setInterval(() => {
        if (document.visibilityState === 'visible') {
          setNow(Date.now())
        }
      }, intervalMs)
    }

    const stop = () => {
      if (id) {
        clearInterval(id)
        id = undefined
      }
    }

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now())
        start()
      } else {
        stop()
      }
    }

    start()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [intervalMs])

  return now
}
