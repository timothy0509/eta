import { parseRmkFlags } from '@/lib/eta/rmk-flags'
import { STALE_THRESHOLDS_MS, type StaleMode } from '@/lib/eta/stale'

/**
 * MTR `timetype` mapping: '1' means scheduled, anything else means realtime.
 * A missing timetype falls back to scheduled so we never invent live data.
 */
export function isMtrRealtime(timetype?: string | number | null): boolean {
  if (timetype === undefined || timetype === null) return false
  const normalized = String(timetype).trim()
  if (normalized === '') return false
  return normalized !== '1'
}

function toTimestampMs(value: string | number | Date | null | undefined): number | null {
  if (value === undefined || value === null) return null
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isNaN(ms) ? null : ms
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

function normalizeNowMs(now?: number | Date): number {
  if (now instanceof Date) return now.getTime()
  if (typeof now === 'number') return now
  return Date.now()
}

function isFresh(params: {
  mode: StaleMode
  lastUpdatedAt?: number | null
  dataTimestamp?: string | number | Date | null
  now?: number | Date
}): boolean {
  const timestampMs =
    params.lastUpdatedAt ??
    toTimestampMs(params.dataTimestamp ?? null) ??
    normalizeNowMs(params.now)
  const ageMs = normalizeNowMs(params.now) - timestampMs
  if (!Number.isFinite(ageMs) || ageMs < 0) return true
  return ageMs <= STALE_THRESHOLDS_MS[params.mode]
}

function hasEtaSeq(etaSeq?: number | string | null): boolean {
  if (etaSeq === undefined || etaSeq === null) return false
  const seq = typeof etaSeq === 'string' ? Number(etaSeq.trim()) : etaSeq
  return typeof seq === 'number' && Number.isFinite(seq) && seq > 0
}

export type KmbRealtimeParams = {
  etaSeq?: number | string | null
  rmk_tc?: string | null
  rmk_sc?: string | null
  rmk_en?: string | null
  lastUpdatedAt?: number | null
  dataTimestamp?: string | number | Date | null
  now?: number | Date
}

/**
 * KMB heuristic: a scheduled remark always wins, otherwise realtime needs
 * a present `eta_seq` plus fresh data within the KMB stale threshold.
 */
export function isKmbRealtime(params: KmbRealtimeParams): boolean {
  const flags = parseRmkFlags(params.rmk_tc, params.rmk_sc, params.rmk_en)
  if (flags.scheduled) return false
  if (!hasEtaSeq(params.etaSeq)) return false
  return isFresh({
    mode: 'kmb',
    lastUpdatedAt: params.lastUpdatedAt,
    dataTimestamp: params.dataTimestamp,
    now: params.now,
  })
}

export type LrtRealtimeParams = {
  lastUpdatedAt?: number | null
  dataTimestamp?: string | number | Date | null
  now?: number | Date
}

/**
 * LRT heuristic: no scheduled marker exists in the feed, so freshness
 * within the LRT stale threshold decides realtime vs scheduled display.
 */
export function isLrtRealtime(params: LrtRealtimeParams = {}): boolean {
  return isFresh({
    mode: 'lrt',
    lastUpdatedAt: params.lastUpdatedAt,
    dataTimestamp: params.dataTimestamp,
    now: params.now,
  })
}

export type RealtimeParams = {
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

/** Mode dispatcher for Streams B/C ETA badges. */
export function isRealtime(params: RealtimeParams): boolean {
  if (params.mode === 'mtr') return isMtrRealtime(params.timetype)
  if (params.mode === 'lrt')
    return isLrtRealtime({
      lastUpdatedAt: params.lastUpdatedAt,
      dataTimestamp: params.dataTimestamp,
      now: params.now,
    })
  return isKmbRealtime({
    etaSeq: params.etaSeq,
    rmk_tc: params.rmk_tc,
    rmk_sc: params.rmk_sc,
    rmk_en: params.rmk_en,
    lastUpdatedAt: params.lastUpdatedAt,
    dataTimestamp: params.dataTimestamp,
    now: params.now,
  })
}
