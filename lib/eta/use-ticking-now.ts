'use client'

import * as React from 'react'

/**
 * Hook that returns a `Date` object updated at a regular interval.
 * Useful for displaying ticking countdowns (e.g. "3 min" → "2 min")
 * without requiring a full data refresh.
 *
 * @param intervalMs How often to update the date. Default 15_000 (15s).
 */
export function useTickingNow(intervalMs = 15_000): Date {
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date())
    }, intervalMs)

    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
