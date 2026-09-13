import { isKmbRealtime, isLrtRealtime, isMtrRealtime } from '@/lib/eta/realtime'
import { parseRmkFlags } from '@/lib/eta/rmk-flags'
import type { StaleMode } from '@/lib/eta/stale'

export type EtaBadgeKind = 'realtime' | 'scheduled'

export type EtaBadgeInput = {
  mode: StaleMode
  timetype?: string | number | null
  etaSeq?: number | string | null
  rmk_tc?: string | null
  rmk_sc?: string | null
  rmk_en?: string | null
  lastUpdatedAt?: number | null
  dataTimestamp?: string | number | Date | null
  now?: number | Date
}

/**
 * Card-level badge mapping built on the Stream D realtime heuristics.
 * Falls back to scheduled so we never present stale or estimated
 * departures as live.
 */
export function resolveEtaBadge(input: EtaBadgeInput): EtaBadgeKind {
  if (input.mode === 'mtr') {
    return isMtrRealtime(input.timetype) ? 'realtime' : 'scheduled'
  }
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

/** Low-floor/wheelchair flag parsed from KMB `rmk_*` remarks. Hidden when absent. */
export function hasWheelchairAccess(
  rmk_tc?: string | null,
  rmk_sc?: string | null,
  rmk_en?: string | null
): boolean {
  return parseRmkFlags(rmk_tc, rmk_sc, rmk_en).wheelchair
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

/** Window the staged timeline dots are plotted against. */
export const ETA_TIMELINE_MAX_MINUTES = 30

/**
 * Static staged position for a timeline dot, derived from ETA minutes.
 * 1 means arriving now, 0 means at or beyond the window edge.
 * Never backed by GPS, so no speed or distance is implied.
 */
export function timelineFraction(
  minutes: number | null,
  maxMinutes: number = ETA_TIMELINE_MAX_MINUTES
): number {
  if (minutes === null || Number.isNaN(minutes)) return 0
  if (minutes <= 0) return 1
  if (maxMinutes <= 0) return 0
  return Math.min(1, Math.max(0, 1 - minutes / maxMinutes))
}
