import { idbGet, idbSet } from '@/lib/eta/cache/idb'
import type { CachePolicy } from '@/lib/eta/cache/policy'
import { createMetaForPolicy, isFresh, isWithinStale } from '@/lib/eta/cache/policy'
import { MicroCache } from '@/lib/eta/cache/micro-cache'

type CacheRecord<T> = {
  value: T
  createdAt: number
  expiresAt: number
}

type MemoryCaches<T> = {
  fresh: MicroCache<T>
  inFlight: MicroCache<Promise<T>>
}

const cacheByPolicy = new Map<string, MemoryCaches<unknown>>()

function getCaches<T>(policyKey: string, policy: CachePolicy): MemoryCaches<T> {
  const existing = cacheByPolicy.get(policyKey)
  if (existing) return existing as MemoryCaches<T>

  const fresh = new MicroCache<T>({ ttlMs: policy.ttlMs, maxSize: 300 })
  const inFlight = new MicroCache<Promise<T>>({ ttlMs: 30_000, maxSize: 200 })
  const caches = { fresh, inFlight } as MemoryCaches<T>
  cacheByPolicy.set(policyKey, caches as MemoryCaches<unknown>)
  return caches
}

export async function getCachedValue<T>(params: {
  key: string
  policyKey: string
  policy: CachePolicy
  fetcher: () => Promise<T>
  allowStale?: boolean
  staleMaxMs?: number
}): Promise<{ value: T; cached: boolean; stale: boolean; ageMs: number | null }> {
  const { key, policyKey, policy, fetcher, allowStale = false } = params
  const caches = getCaches<T>(policyKey, policy)
  const now = Date.now()
  const staleMaxMs = params.staleMaxMs ?? policy.maxStaleMs ?? 0
  const memoryStale =
    allowStale && staleMaxMs > 0 ? caches.fresh.getStale(key, staleMaxMs) : undefined

  if (memoryStale && isFresh(memoryStale.meta, now)) {
    return { value: memoryStale.value, cached: true, stale: false, ageMs: 0 }
  }

  if (!memoryStale) {
    const memoryValue = caches.fresh.get(key)
    if (memoryValue !== undefined) {
      return { value: memoryValue, cached: true, stale: false, ageMs: 0 }
    }
  }

  const stored = policy.persist ? await idbGet<T>(key) : null
  if (stored && isFresh(stored, now)) {
    const remainingTtlMs = stored.expiresAt - now
    if (remainingTtlMs > 0) {
      caches.fresh.set(key, stored.value, remainingTtlMs)
    }
    return { value: stored.value, cached: true, stale: false, ageMs: 0 }
  }

  const inFlight = caches.inFlight.get(key)
  if (inFlight) {
    const value = await inFlight
    return { value, cached: true, stale: false, ageMs: 0 }
  }

  const fetchPromise = fetcher()
    .then(async (value) => {
      caches.fresh.set(key, value, policy.ttlMs)
      if (policy.persist) {
        const meta = createMetaForPolicy(policy)
        await idbSet(key, { value, ...meta })
      }
      caches.inFlight.delete(key)
      return value
    })
    .catch((error) => {
      caches.inFlight.delete(key)
      throw error
    })

  caches.inFlight.set(key, fetchPromise, 30_000)

  try {
    const value = await fetchPromise
    return { value, cached: false, stale: false, ageMs: null }
  } catch (error) {
    if (allowStale && staleMaxMs > 0) {
      const staleNow = Date.now()
      const candidates: Array<{ value: T; meta: { createdAt: number; expiresAt: number } }> = []

      if (memoryStale && staleNow > memoryStale.meta.expiresAt) {
        candidates.push({ value: memoryStale.value, meta: memoryStale.meta })
      }

      if (stored && isWithinStale(stored, staleMaxMs, staleNow)) {
        candidates.push({
          value: stored.value,
          meta: { createdAt: stored.createdAt, expiresAt: stored.expiresAt },
        })
      }

      if (candidates.length > 0) {
        const selected = candidates.reduce((latest, current) =>
          current.meta.createdAt > latest.meta.createdAt ? current : latest
        )
        return {
          value: selected.value,
          cached: true,
          stale: true,
          ageMs: staleNow - selected.meta.createdAt,
        }
      }
    }
    throw error
  }
}

export function normalizeDirection(direction: string): 'I' | 'O' | string {
  if (direction === 'inbound') return 'I'
  if (direction === 'outbound') return 'O'
  return direction
}

export function mapRecord<T>(record: CacheRecord<T> | null): T | null {
  return record?.value ?? null
}
