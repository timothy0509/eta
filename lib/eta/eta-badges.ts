import { isKmbRealtime, isLrtRealtime } from '@/lib/eta/realtime'
import type { StaleMode } from '@/lib/eta/stale'

export type EtaBadgeKind = 'realtime' | 'scheduled'

export type EtaBadgeInput = {
  mode: Exclude<StaleMode, 'mtr'>
  etaSeq?: number | string | null
  rmk_tc?: string | null
  rmk_sc?: string | null
  rmk_en?: string | null
  lastUpdatedAt?: number | null
  dataTimestamp?: string | number | Date | null
  now?: number | Date
}

/**
 * Card-level badge mapping for KMB (scheduled remark) and LRT (freshness).
 * MTR has no scheduled-vs-realtime signal, so it never gets a badge here.
 * Falls back to scheduled so we never present stale or estimated
 * departures as live.
 */
export function resolveEtaBadge(input: EtaBadgeInput): EtaBadgeKind {
  if (input.mode === 'lrt') {
    const realtime = isLrtRealtime({
      lastUpdatedAt: input.lastUpdatedAt,
      dataTimestamp: input.dataTimestamp,
      now: input.now,
    })
    return realtime ? 'realtime' : 'scheduled'
  }
  const realtime = isKmbRealtime({
    etaSeq: input.etaSeq,
    rmk_tc: input.rmk_tc,
    rmk_sc: input.rmk_sc,
    rmk_en: input.rmk_en,
    lastUpdatedAt: input.lastUpdatedAt,
    dataTimestamp: input.dataTimestamp,
    now: input.now,
  })
  return realtime ? 'realtime' : 'scheduled'
}

/** Stable soonest-first sort. Entries without a time sink to the bottom. */
export function sortBySoonestMinutes<T>(
  items: readonly T[],
  getMinutes: (item: T) => number | null
): T[] {
  return [...items].sort((a, b) => {
    const minutesA = getMinutes(a)
    const minutesB = getMinutes(b)
    if (minutesA === null && minutesB === null) return 0
    if (minutesA === null) return 1
    if (minutesB === null) return -1
    return minutesA - minutesB
  })
}
