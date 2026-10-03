export type CachePolicy = {
  ttlMs: number
  maxStaleMs?: number
  persist?: boolean
}

export type CacheEntryMeta = {
  createdAt: number
  expiresAt: number
}

export const CACHE_POLICIES = {
  // Live ETA responses stay fresh across the default 15s poll (and 10s
  // option) so repeat polls are served from memory instead of upstream.
  // maxStaleMs matches the UI stale thresholds in lib/eta/stale.ts so a
  // failed refresh can still show stale data rather than erroring.
  kmbStopEta: { ttlMs: 30_000, maxStaleMs: 60_000, persist: false },
  mtrSchedule: { ttlMs: 30_000, maxStaleMs: 90_000, persist: false },
  lrtSchedule: { ttlMs: 30_000, maxStaleMs: 90_000, persist: false },
  lrtRouteEta: { ttlMs: 30_000, maxStaleMs: 90_000, persist: false },
  etaDb: { ttlMs: 24 * 60 * 60 * 1000, persist: true },
  kmbStaticList: { ttlMs: 24 * 60 * 60 * 1000, persist: true },
  kmbRouteGeometry: {
    ttlMs: 30 * 24 * 60 * 60 * 1000,
    maxStaleMs: 90 * 24 * 60 * 60 * 1000,
    persist: true,
  },
} as const satisfies Record<string, CachePolicy>

export function createCacheMeta(ttlMs: number, now = Date.now()): CacheEntryMeta {
  return {
    createdAt: now,
    expiresAt: now + ttlMs,
  }
}

export function createMetaForPolicy(policy: CachePolicy, now = Date.now()): CacheEntryMeta {
  return createCacheMeta(policy.ttlMs, now)
}

export function isFresh(meta: CacheEntryMeta, now = Date.now()): boolean {
  return now <= meta.expiresAt
}

export function isWithinStale(meta: CacheEntryMeta, maxStaleMs: number, now = Date.now()): boolean {
  return now <= meta.expiresAt + maxStaleMs
}
