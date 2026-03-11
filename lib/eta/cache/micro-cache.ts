type CacheEntry<T> = {
  value: T
  expiresAt: number
  createdAt: number
}

export type CacheEntryMeta = {
  expiresAt: number
  createdAt: number
}

type InFlightEntry<T> = {
  promise: Promise<T>
  createdAt: number
}

const DEFAULT_TTL_MS = 15_000
const MAX_INFLIGHT_AGE_MS = 30_000

export class MicroCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private inFlight = new Map<string, InFlightEntry<T>>()
  private ttlMs: number
  private maxSize: number

  constructor(options: { ttlMs?: number; maxSize?: number } = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
    this.maxSize = options.maxSize ?? 500
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value
  }

  getStale(key: string, maxStaleAgeMs: number): { value: T; meta: CacheEntryMeta } | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    const now = Date.now()
    if (now > entry.expiresAt + maxStaleAgeMs) return undefined

    return {
      value: entry.value,
      meta: {
        createdAt: entry.createdAt,
        expiresAt: entry.expiresAt,
      },
    }
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    const now = Date.now()
    this.cache.set(key, {
      value,
      expiresAt: now + (ttlMs ?? this.ttlMs),
      createdAt: now,
    })
  }

  delete(key: string): void {
    this.cache.delete(key)
    this.inFlight.delete(key)
  }

  clear(): void {
    this.cache.clear()
    this.inFlight.clear()
  }

  async getOrFetch(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get(key)
    if (cached !== undefined) {
      return cached
    }

    const existing = this.inFlight.get(key)
    if (existing && Date.now() - existing.createdAt < MAX_INFLIGHT_AGE_MS) {
      return existing.promise
    }

    const promise = fetcher()
      .then((value) => {
        this.set(key, value, ttlMs)
        this.inFlight.delete(key)
        return value
      })
      .catch((error) => {
        this.inFlight.delete(key)
        throw error
      })

    this.inFlight.set(key, { promise, createdAt: Date.now() })
    return promise
  }

  stats(): { size: number; inFlightCount: number } {
    return {
      size: this.cache.size,
      inFlightCount: this.inFlight.size,
    }
  }

  private evictOldest(): void {
    const entriesToRemove = Math.max(1, Math.floor(this.maxSize * 0.2))
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, entriesToRemove)

    for (const [key] of entries) {
      this.cache.delete(key)
    }
  }
}
