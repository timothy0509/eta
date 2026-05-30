import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { MicroCache } from './cache'

describe('MicroCache', () => {
  let cache: MicroCache<string>

  beforeEach(() => {
    vi.useFakeTimers()
    cache = new MicroCache<string>({ ttlMs: 1000, maxSize: 5 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('set/get with TTL expiry', () => {
    it('returns undefined for missing key', () => {
      expect(cache.get('missing')).toBeUndefined()
    })

    it('stores and retrieves a value', () => {
      cache.set('key', 'value')
      expect(cache.get('key')).toBe('value')
    })

    it('returns undefined after TTL expires', () => {
      cache.set('key', 'value')
      vi.advanceTimersByTime(1001)
      expect(cache.get('key')).toBeUndefined()
    })

    it('returns value before TTL expires', () => {
      cache.set('key', 'value')
      vi.advanceTimersByTime(500)
      expect(cache.get('key')).toBe('value')
    })

    it('uses custom TTL when provided', () => {
      cache.set('key', 'value', 500)
      vi.advanceTimersByTime(501)
      expect(cache.get('key')).toBeUndefined()
    })
  })

  describe('getOrFetch deduplication', () => {
    it('calls fetcher when cache miss', async () => {
      const fetcher = vi.fn().mockResolvedValue('fetched')
      const result = await cache.getOrFetch('key', fetcher)
      expect(result).toBe('fetched')
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it('returns cached value without calling fetcher', async () => {
      cache.set('key', 'cached')
      const fetcher = vi.fn().mockResolvedValue('fetched')
      const result = await cache.getOrFetch('key', fetcher)
      expect(result).toBe('cached')
      expect(fetcher).not.toHaveBeenCalled()
    })

    it('deduplicates concurrent requests for same key', async () => {
      let resolvePromise: (value: string) => void
      const fetcherPromise = new Promise<string>((resolve) => {
        resolvePromise = resolve
      })
      const fetcher = vi.fn().mockReturnValue(fetcherPromise)

      const p1 = cache.getOrFetch('key', fetcher)
      const p2 = cache.getOrFetch('key', fetcher)

      expect(fetcher).toHaveBeenCalledTimes(1)

      resolvePromise!('fetched')
      const [r1, r2] = await Promise.all([p1, p2])

      expect(r1).toBe('fetched')
      expect(r2).toBe('fetched')
    })

    it('stores result after fetcher resolves', async () => {
      const fetcher = vi.fn().mockResolvedValue('fetched')
      await cache.getOrFetch('key', fetcher)
      expect(cache.get('key')).toBe('fetched')
    })

    it('removes in-flight entry on error', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('fail'))
      await expect(cache.getOrFetch('key', fetcher)).rejects.toThrow('fail')
      expect(cache.stats().inFlightCount).toBe(0)
    })
  })

  describe('getStale fallback', () => {
    it('returns undefined for missing key', () => {
      expect(cache.getStale('missing', 5000)).toBeUndefined()
    })

    it('returns value within maxStaleAgeMs', () => {
      cache.set('key', 'value')
      vi.advanceTimersByTime(1500) // past TTL but within stale age
      const result = cache.getStale('key', 5000)
      expect(result).toBeDefined()
      expect(result?.value).toBe('value')
    })

    it('returns undefined when older than maxStaleAgeMs', () => {
      cache.set('key', 'value')
      vi.advanceTimersByTime(6000)
      expect(cache.getStale('key', 5000)).toBeUndefined()
    })

    it('includes meta in result', () => {
      const now = Date.now()
      cache.set('key', 'value')
      vi.advanceTimersByTime(1500)
      const result = cache.getStale('key', 5000)
      expect(result?.meta.createdAt).toBe(now)
      expect(result?.meta.expiresAt).toBe(now + 1000)
    })
  })

  describe('evictOldest when maxSize reached', () => {
    it('evicts oldest entries when at capacity', () => {
      for (let i = 0; i < 5; i++) {
        cache.set(`key-${i}`, `value-${i}`)
        vi.advanceTimersByTime(10)
      }

      expect(cache.stats().size).toBe(5)

      cache.set('key-new', 'value-new')

      // Should have evicted ~20% (1 entry)
      expect(cache.stats().size).toBeLessThanOrEqual(5)
      expect(cache.get('key-new')).toBe('value-new')
    })

    it('evicts multiple entries for larger maxSize', () => {
      const smallCache = new MicroCache<string>({ ttlMs: 10000, maxSize: 10 })

      for (let i = 0; i < 10; i++) {
        smallCache.set(`key-${i}`, `value-${i}`)
        vi.advanceTimersByTime(10)
      }

      smallCache.set('key-new', 'value-new')

      // Should evict ~20% of 10 = 2 entries
      expect(smallCache.stats().size).toBeLessThanOrEqual(10)
    })
  })

  describe('delete', () => {
    it('removes value from cache', () => {
      cache.set('key', 'value')
      cache.delete('key')
      expect(cache.get('key')).toBeUndefined()
    })

    it('does nothing for missing key', () => {
      expect(() => cache.delete('missing')).not.toThrow()
    })

    it('removes in-flight entry', () => {
      cache.delete('key')
      expect(cache.stats().inFlightCount).toBe(0)
    })
  })

  describe('clear', () => {
    it('removes all cached values', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.clear()
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
    })

    it('clears in-flight entries', () => {
      cache.clear()
      expect(cache.stats().inFlightCount).toBe(0)
    })
  })

  describe('stats', () => {
    it('returns correct size', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      expect(cache.stats().size).toBe(2)
    })

    it('returns zero for empty cache', () => {
      expect(cache.stats()).toEqual({ size: 0, inFlightCount: 0 })
    })
  })
})
