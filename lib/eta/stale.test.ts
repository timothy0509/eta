import { describe, expect, it } from 'vitest'
import { isStaleByAge, isStaleByFlagOrAge, formatRelativeAgeLabel } from './stale'

describe('isStaleByAge', () => {
  it('returns false when lastUpdatedAt is undefined', () => {
    expect(isStaleByAge({ mode: 'kmb' })).toBe(false)
  })

  it('returns false when lastUpdatedAt is null', () => {
    expect(isStaleByAge({ mode: 'kmb', lastUpdatedAt: null })).toBe(false)
  })

  it('returns false when data is fresh (kmb)', () => {
    const now = Date.now()
    const lastUpdatedAt = now - 30_000 // 30 seconds ago
    expect(isStaleByAge({ mode: 'kmb', lastUpdatedAt, now })).toBe(false)
  })

  it('returns true when data is stale (kmb)', () => {
    const now = Date.now()
    const lastUpdatedAt = now - 61_000 // 61 seconds ago, threshold is 60s
    expect(isStaleByAge({ mode: 'kmb', lastUpdatedAt, now })).toBe(true)
  })

  it('returns false when data is fresh (mtr)', () => {
    const now = Date.now()
    const lastUpdatedAt = now - 60_000 // 60 seconds ago, threshold is 90s
    expect(isStaleByAge({ mode: 'mtr', lastUpdatedAt, now })).toBe(false)
  })

  it('returns true when data is stale (mtr)', () => {
    const now = Date.now()
    const lastUpdatedAt = now - 91_000 // 91 seconds ago, threshold is 90s
    expect(isStaleByAge({ mode: 'mtr', lastUpdatedAt, now })).toBe(true)
  })

  it('returns false when data is fresh (lrt)', () => {
    const now = Date.now()
    const lastUpdatedAt = now - 60_000
    expect(isStaleByAge({ mode: 'lrt', lastUpdatedAt, now })).toBe(false)
  })

  it('returns true when data is stale (lrt)', () => {
    const now = Date.now()
    const lastUpdatedAt = now - 91_000
    expect(isStaleByAge({ mode: 'lrt', lastUpdatedAt, now })).toBe(true)
  })

  it('accepts Date object for now parameter', () => {
    const now = new Date('2024-01-01T00:02:00.000Z')
    const lastUpdatedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(isStaleByAge({ mode: 'kmb', lastUpdatedAt, now })).toBe(true)
  })

  it('uses Date.now() when now is not provided', () => {
    // Just verify it doesn't throw and returns a boolean
    const result = isStaleByAge({ mode: 'kmb', lastUpdatedAt: Date.now() - 1000 })
    expect(typeof result).toBe('boolean')
  })
})

describe('isStaleByFlagOrAge', () => {
  it('returns true when upstreamStale is true', () => {
    expect(isStaleByFlagOrAge({ upstreamStale: true, mode: 'kmb' })).toBe(true)
  })

  it('returns false when upstreamStale is false and age is fresh', () => {
    expect(isStaleByFlagOrAge({ upstreamStale: false, ageMs: 30_000, mode: 'kmb' })).toBe(false)
  })

  it('returns true when upstreamStale is false but age is stale', () => {
    expect(isStaleByFlagOrAge({ upstreamStale: false, ageMs: 61_000, mode: 'kmb' })).toBe(true)
  })

  it('returns false when ageMs is undefined', () => {
    expect(isStaleByFlagOrAge({ upstreamStale: false, mode: 'kmb' })).toBe(false)
  })

  it('returns false when ageMs is null', () => {
    expect(isStaleByFlagOrAge({ upstreamStale: false, ageMs: null, mode: 'kmb' })).toBe(false)
  })

  it('trusts upstreamStale even when age is fresh', () => {
    expect(isStaleByFlagOrAge({ upstreamStale: true, ageMs: 1000, mode: 'kmb' })).toBe(true)
  })

  it('uses correct threshold for mtr mode', () => {
    expect(isStaleByFlagOrAge({ upstreamStale: false, ageMs: 91_000, mode: 'mtr' })).toBe(true)
    expect(isStaleByFlagOrAge({ upstreamStale: false, ageMs: 89_000, mode: 'mtr' })).toBe(false)
  })

  it('uses correct threshold for lrt mode', () => {
    expect(isStaleByFlagOrAge({ upstreamStale: false, ageMs: 91_000, mode: 'lrt' })).toBe(true)
    expect(isStaleByFlagOrAge({ upstreamStale: false, ageMs: 89_000, mode: 'lrt' })).toBe(false)
  })
})

describe('formatRelativeAgeLabel', () => {
  it('returns null when lastUpdatedAt is undefined', () => {
    expect(formatRelativeAgeLabel({ lang: 'en' })).toBeNull()
  })

  it('returns null when lastUpdatedAt is null', () => {
    expect(formatRelativeAgeLabel({ lang: 'en', lastUpdatedAt: null })).toBeNull()
  })

  it('returns "just now" for recent updates (en)', () => {
    const now = new Date('2024-01-01T00:00:20.000Z')
    const lastUpdatedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(formatRelativeAgeLabel({ lang: 'en', lastUpdatedAt, now })).toBe('just now')
  })

  it('returns "剛剛" for recent updates (tc)', () => {
    const now = new Date('2024-01-01T00:00:20.000Z')
    const lastUpdatedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(formatRelativeAgeLabel({ lang: 'tc', lastUpdatedAt, now })).toBe('剛剛')
  })

  it('returns "刚刚" for recent updates (sc)', () => {
    const now = new Date('2024-01-01T00:00:20.000Z')
    const lastUpdatedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(formatRelativeAgeLabel({ lang: 'sc', lastUpdatedAt, now })).toBe('刚刚')
  })

  it('returns minutes label for updates within an hour (en)', () => {
    const now = new Date('2024-01-01T00:05:00.000Z')
    const lastUpdatedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(formatRelativeAgeLabel({ lang: 'en', lastUpdatedAt, now })).toBe('5 min ago')
  })

  it('returns minutes label for updates within an hour (tc)', () => {
    const now = new Date('2024-01-01T00:05:00.000Z')
    const lastUpdatedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(formatRelativeAgeLabel({ lang: 'tc', lastUpdatedAt, now })).toBe('5 分鐘前')
  })

  it('returns minutes label for updates within an hour (sc)', () => {
    const now = new Date('2024-01-01T00:05:00.000Z')
    const lastUpdatedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(formatRelativeAgeLabel({ lang: 'sc', lastUpdatedAt, now })).toBe('5 分钟前')
  })

  it('returns hours label for updates over an hour (en)', () => {
    const now = new Date('2024-01-01T02:00:00.000Z')
    const lastUpdatedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(formatRelativeAgeLabel({ lang: 'en', lastUpdatedAt, now })).toBe('2 hrs ago')
  })

  it('returns "1 hr ago" for singular hour (en)', () => {
    const now = new Date('2024-01-01T01:00:00.000Z')
    const lastUpdatedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(formatRelativeAgeLabel({ lang: 'en', lastUpdatedAt, now })).toBe('1 hr ago')
  })

  it('returns hours label for updates over an hour (tc)', () => {
    const now = new Date('2024-01-01T02:00:00.000Z')
    const lastUpdatedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(formatRelativeAgeLabel({ lang: 'tc', lastUpdatedAt, now })).toBe('2 小時前')
  })

  it('returns hours label for updates over an hour (sc)', () => {
    const now = new Date('2024-01-01T02:00:00.000Z')
    const lastUpdatedAt = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(formatRelativeAgeLabel({ lang: 'sc', lastUpdatedAt, now })).toBe('2 小时前')
  })

  it('returns null for future timestamps', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const lastUpdatedAt = new Date('2024-01-01T00:01:00.000Z').getTime()
    expect(formatRelativeAgeLabel({ lang: 'en', lastUpdatedAt, now })).toBeNull()
  })

  it('returns null for invalid timestamps', () => {
    expect(formatRelativeAgeLabel({ lang: 'en', lastUpdatedAt: NaN })).toBeNull()
  })

  it('uses current time when now is not provided', () => {
    // Just verify it doesn't throw and returns a string or null
    const result = formatRelativeAgeLabel({
      lang: 'en',
      lastUpdatedAt: Date.now() - 60_000,
    })
    expect(typeof result === 'string' || result === null).toBe(true)
  })
})
