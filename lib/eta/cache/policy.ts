export type CachePolicy = {
  ttlMs: number;
  maxStaleMs?: number;
  persist?: boolean;
};

export type CacheEntryMeta = {
  createdAt: number;
  expiresAt: number;
};

export const CACHE_POLICIES = {
  kmbStopEta: { ttlMs: 15_000, maxStaleMs: 30_000, persist: false },
  mtrSchedule: { ttlMs: 12_000, persist: false },
  lrtSchedule: { ttlMs: 12_000, persist: false },
  etaDb: { ttlMs: 24 * 60 * 60 * 1000, persist: true },
} as const satisfies Record<string, CachePolicy>;

export function createCacheMeta(ttlMs: number, now = Date.now()): CacheEntryMeta {
  return {
    createdAt: now,
    expiresAt: now + ttlMs,
  };
}

export function createMetaForPolicy(policy: CachePolicy, now = Date.now()): CacheEntryMeta {
  return createCacheMeta(policy.ttlMs, now);
}

export function isFresh(meta: CacheEntryMeta, now = Date.now()): boolean {
  return now <= meta.expiresAt;
}

export function isWithinStale(meta: CacheEntryMeta, maxStaleMs: number, now = Date.now()): boolean {
  return now - meta.createdAt <= maxStaleMs;
}
