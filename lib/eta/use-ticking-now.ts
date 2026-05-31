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
    const id = setInterval(() => {
      setNow(Date.now())
    }, intervalMs)

    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
