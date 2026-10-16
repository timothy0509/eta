'use client'

import * as React from 'react'

import { loadHeadwayIndex } from '@/lib/eta/headway/loader'
import { getScheduleForVariant } from '@/lib/eta/headway/lookup'
import type { HeadwayIndex, ScheduledFallback } from '@/lib/eta/headway/types'
import { useTickingNow } from '@/lib/eta/use-ticking-now'

/** Load the headway index once; returns null until loaded or on failure. */
export function useHeadwayIndex(): HeadwayIndex | null {
  const [index, setIndex] = React.useState<HeadwayIndex | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void loadHeadwayIndex().then((loaded) => {
      if (!cancelled) setIndex(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return index
}

function minuteOf(timestamp: number): number {
  return Math.floor(timestamp / 60_000)
}

/**
 * Scheduled fallbacks for many variant keys at once. Returns a map of
 * baseKey -> fallback for keys that resolve; missing keys are absent.
 * Recomputed when the index, key set, or current minute changes.
 */
export function useHeadwaySchedules(baseKeys: string[]): Record<string, ScheduledFallback> {
  const index = useHeadwayIndex()
  const tick = useTickingNow(60_000)
  const minuteKey = minuteOf(tick)
  const keysKey = baseKeys.join(',')

  return React.useMemo(() => {
    const out: Record<string, ScheduledFallback> = {}
    if (!index) return out
    const now = new Date(minuteKey * 60_000)
    const seen = new Set<string>()
    for (const baseKey of keysKey.split(',')) {
      const key = baseKey.trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      const schedule = getScheduleForVariant(index, key, now)
      if (schedule) out[key] = schedule
    }
    return out
  }, [index, keysKey, minuteKey])
}

/**
 * Scheduled fallback for a variant key, recomputed when the index, baseKey,
 * or current minute changes. Ticks at minute granularity (60s interval).
 * Pass `when` to pin the lookup to an explicit time (e.g. in tests).
 */
export function useHeadwaySchedule(baseKey: string | null, when?: Date): ScheduledFallback | null {
  const index = useHeadwayIndex()
  const tick = useTickingNow(60_000)
  const minuteKey = when ? when.getTime() : minuteOf(tick)

  return React.useMemo(() => {
    if (!index || !baseKey) return null
    const now = when ?? new Date(minuteKey * 60_000)
    return getScheduleForVariant(index, baseKey, now)
  }, [index, baseKey, when, minuteKey])
}
