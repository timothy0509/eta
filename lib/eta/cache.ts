/**
 * Simple in-memory cache with TTL for real-time API responses.
 * Designed for short-lived caching (10-20s) to reduce upstream load
 * while keeping data fresh enough for ETA displays.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  /** Timestamp when this entry was created */
  createdAt: number;
};

type InFlightEntry<T> = {
  promise: Promise<T>;
  createdAt: number;
};

const DEFAULT_TTL_MS = 15_000; // 15 seconds
const MAX_INFLIGHT_AGE_MS = 30_000; // 30 seconds max for in-flight dedup

export class MicroCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private inFlight = new Map<string, InFlightEntry<T>>();
  private ttlMs: number;
  private maxSize: number;

  constructor(options: { ttlMs?: number; maxSize?: number } = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxSize = options.maxSize ?? 500;
  }

  /**
   * Get a cached value if it exists and hasn't expired.
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in the cache.
   */
  set(key: string, value: T, ttlMs?: number): void {
    // Evict oldest entries if we're at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + (ttlMs ?? this.ttlMs),
      createdAt: now,
    });
  }

  /**
   * Delete a specific key from the cache.
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.inFlight.delete(key);
  }

  /**
   * Clear all cached values.
   */
  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  /**
   * Get or fetch: returns cached value if fresh, otherwise calls fetcher.
   * Deduplicates in-flight requests for the same key.
   */
  async getOrFetch(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
    // Check cache first
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Check for in-flight request (dedupe)
    const existing = this.inFlight.get(key);
    if (existing && Date.now() - existing.createdAt < MAX_INFLIGHT_AGE_MS) {
      return existing.promise;
    }

    // Create new request
    const promise = fetcher()
      .then((value) => {
        this.set(key, value, ttlMs);
        this.inFlight.delete(key);
        return value;
      })
      .catch((error) => {
        this.inFlight.delete(key);
        throw error;
      });

    this.inFlight.set(key, { promise, createdAt: Date.now() });
    return promise;
  }

  /**
   * Get cache stats for debugging/monitoring.
   */
  stats(): { size: number; inFlightCount: number } {
    return {
      size: this.cache.size,
      inFlightCount: this.inFlight.size,
    };
  }

  private evictOldest(): void {
    // Remove ~20% of oldest entries
    const entriesToRemove = Math.max(1, Math.floor(this.maxSize * 0.2));
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, entriesToRemove);

    for (const [key] of entries) {
      this.cache.delete(key);
    }
  }
}

// Singleton caches for each provider
export const kmbStopEtaCache = new MicroCache<unknown>({ ttlMs: 15_000, maxSize: 500 });
export const mtrScheduleCache = new MicroCache<unknown>({ ttlMs: 12_000, maxSize: 200 });
export const lrtScheduleCache = new MicroCache<unknown>({ ttlMs: 12_000, maxSize: 100 });
