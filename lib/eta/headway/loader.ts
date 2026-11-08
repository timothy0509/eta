import type { DayType, HeadwayIndex, HeadwayWindow, VariantSchedule } from '@/lib/eta/headway/types'

function isDayTypeKey(key: string): key is DayType {
  return key === 'weekday' || key === 'saturday' || key === 'sunday' || key === 'holiday'
}

function isWindow(value: unknown): value is HeadwayWindow {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  )
}

function isDeparturesTable(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!isDayTypeKey(key)) return false
    if (
      !Array.isArray(entry) ||
      !entry.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 2880)
    ) {
      return false
    }
  }
  return true
}

function isSpecialEntry(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.src !== 'string' || typeof record.origin !== 'string') return false
  return isDeparturesTable(record.departures)
}

function isVariantSchedule(value: unknown): value is VariantSchedule {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const { src, span, headway } = record
  if (!Array.isArray(src) || !src.every((s) => typeof s === 'string')) return false
  if (typeof span !== 'object' || span === null) return false
  // headway is optional: span-only entries (peak-only routes with fixed
  // departures) carry first/last times but no frequency windows.
  // departures is optional: fixed first-stop departure minutes per day type.
  // special is optional: per-route fixed extras for days with windows.
  // freqSrc/depBySrc/stopCov are optional per-stop coverage tables.
  if (headway !== undefined && (typeof headway !== 'object' || headway === null)) return false
  const { departures, special, freqSrc, depBySrc, stopCov } = record
  if (departures !== undefined && !isDeparturesTable(departures)) return false
  if (special !== undefined && (!Array.isArray(special) || !special.every(isSpecialEntry))) {
    return false
  }
  if (
    freqSrc !== undefined &&
    (!Array.isArray(freqSrc) || !freqSrc.every((n) => typeof n === 'number' && Number.isFinite(n)))
  ) {
    return false
  }
  if (depBySrc !== undefined) {
    if (typeof depBySrc !== 'object' || depBySrc === null) return false
    for (const entry of Object.values(depBySrc as Record<string, unknown>)) {
      if (typeof entry !== 'object' || entry === null) return false
      const record = entry as Record<string, unknown>
      if (typeof record.origin !== 'string') return false
      if (!isDeparturesTable(record.departures)) return false
    }
  }
  if (stopCov !== undefined) {
    if (typeof stopCov !== 'object' || stopCov === null) return false
    for (const list of Object.values(stopCov as Record<string, unknown>)) {
      if (!Array.isArray(list) || !list.every((n) => typeof n === 'number' && Number.isFinite(n))) {
        return false
      }
    }
  }
  for (const [key, entry] of Object.entries(span as Record<string, unknown>)) {
    if (!isDayTypeKey(key)) return false
    if (!Array.isArray(entry) || entry.length !== 2 || !entry.every((s) => typeof s === 'string')) {
      return false
    }
  }
  if (headway !== undefined) {
    for (const [key, entry] of Object.entries(headway as Record<string, unknown>)) {
      if (!isDayTypeKey(key)) return false
      if (!Array.isArray(entry) || !entry.every(isWindow)) return false
    }
  }
  return true
}

function isHeadwayIndex(value: unknown): value is HeadwayIndex {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.updated !== 'string') return false
  if (!Array.isArray(record.holidays) || !record.holidays.every((h) => typeof h === 'string')) {
    return false
  }
  if (typeof record.variants !== 'object' || record.variants === null) return false
  // The full per-variant walk is the expensive part. The file is generated
  // by our own script and `real-file.test.ts` validates it in depth, so
  // production checks the top-level shape plus one cheap probe per variant:
  // present, object-shaped, with a span table. A truncated deploy or an
  // error page with the right envelope fails here instead of at read time.
  if (process.env.NODE_ENV === 'production') {
    return Object.values(record.variants as Record<string, unknown>).every(
      (v) =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as Record<string, unknown>).span === 'object' &&
        (v as Record<string, unknown>).span !== null
    )
  }
  return Object.values(record.variants as Record<string, unknown>).every(isVariantSchedule)
}

let resolvedCache: HeadwayIndex | null | undefined
let inflight: Promise<HeadwayIndex | null> | undefined

/**
 * Snapshot URL version. Bump when the variant key shape changes so clients
 * that cached the old file with force-cache fetch the new one instead of
 * serving mismatched keys for a day. Key shape v3 is the LWB split.
 */
const HEADWAY_SNAPSHOT_VERSION = 3
const HEADWAY_SNAPSHOT_URL = `/headway/headway.json?v=${HEADWAY_SNAPSHOT_VERSION}`

/**
 * Load the prebuilt headway index from same-origin static JSON.
 * Module-singleton in-flight + resolved cache. Never throws: on any
 * error (network, parse, shape) returns null.
 */
export function loadHeadwayIndex(): Promise<HeadwayIndex | null> {
  if (resolvedCache !== undefined) return Promise.resolve(resolvedCache)
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch(HEADWAY_SNAPSHOT_URL, { cache: 'force-cache' })
      if (!res.ok) return null
      const json: unknown = await res.json()
      return isHeadwayIndex(json) ? json : null
    } catch {
      return null
    }
  })()
  return inflight.then((index) => {
    resolvedCache = index
    inflight = undefined
    return index
  })
}

/** Test hook: clear the module-singleton cache. */
export function __resetHeadwayIndexCacheForTests(): void {
  resolvedCache = undefined
  inflight = undefined
}
