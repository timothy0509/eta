import { describe, expect, it } from 'vitest'

import { MicroCache } from './cache'

describe('MicroCache', () => {
  it('returns undefined for missing keys', () => {
    const cache = new MicroCache<string>()
    expect(cache.get('missing')).toBeUndefined()
  })

  it('expires entries after TTL', async () => {
    const cache = new MicroCache<string>({ ttlMs: 10 })
    cache.set('key', 'value')

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(cache.get('key')).toBeUndefined()
  })

  it('returns stale entries within max stale age', async () => {
    const cache = new MicroCache<string>({ ttlMs: 10 })
    cache.set('key', 'value')

    await new Promise((resolve) => setTimeout(resolve, 20))
    const stale = cache.getStale('key', 1000)

    expect(stale?.value).toBe('value')
    expect(stale?.meta.createdAt).toBeTypeOf('number')
  })

  it('deduplicates in-flight requests', async () => {
    const cache = new MicroCache<string>({ ttlMs: 1000 })
    let runs = 0

    const fetcher = async () => {
      runs += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return 'value'
    }

    const [first, second] = await Promise.all([
      cache.getOrFetch('key', fetcher),
      cache.getOrFetch('key', fetcher),
    ])

    expect(first).toBe('value')
    expect(second).toBe('value')
    expect(runs).toBe(1)
  })

  it('evicts oldest entries when over max size', () => {
    const cache = new MicroCache<number>({ maxSize: 5 })
    for (let i = 0; i < 6; i += 1) {
      cache.set(`key-${i}`, i)
    }

    expect(cache.stats().size).toBeLessThanOrEqual(5)
  })

  it('returns stale entry with meta within max age', () => {
    const cache = new MicroCache<number>({ ttlMs: 1 })
    cache.set('key', 42)

    const stale = cache.getStale('key', 1000)

    expect(stale?.value).toBe(42)
    expect(stale?.meta.createdAt).toBeTypeOf('number')
    expect(stale?.meta.expiresAt).toBeTypeOf('number')
  })

  it('returns undefined for stale entries beyond max age', async () => {
    const cache = new MicroCache<number>({ ttlMs: 1 })
    cache.set('key', 42)

    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(cache.getStale('key', 1)).toBeUndefined()
  })

  it('stats includes in-flight count', async () => {
    const cache = new MicroCache<string>()
    const fetcher = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return 'value'
    }

    const promise = cache.getOrFetch('key', fetcher)
    expect(cache.stats().inFlightCount).toBe(1)
    await promise
    expect(cache.stats().inFlightCount).toBe(0)
  })
})
