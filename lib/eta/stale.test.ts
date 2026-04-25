import { describe, expect, it } from 'vitest'

import { formatRelativeAgeLabel, isStaleByAge, STALE_THRESHOLDS_MS } from './stale'

describe('isStaleByAge', () => {
  it('returns false when lastUpdatedAt is undefined', () => {
    expect(isStaleByAge({ lastUpdatedAt: undefined, mode: 'kmb' })).toBe(false)
  })

  it('returns false when lastUpdatedAt is null', () => {
    expect(isStaleByAge({ lastUpdatedAt: null, mode: 'kmb' })).toBe(false)
  })

  it('returns false for fresh data (below threshold)', () => {
    const now = 1000000
    const lastUpdatedAt = now - 60000 // 1 minute ago
    expect(isStaleByAge({ lastUpdatedAt, mode: 'kmb', now })).toBe(false)
  })

  it('returns true for stale data (above threshold)', () => {
    const now = 1000000
    const threshold = STALE_THRESHOLDS_MS.kmb
    const lastUpdatedAt = now - threshold - 1000 // Just past threshold
    expect(isStaleByAge({ lastUpdatedAt, mode: 'kmb', now })).toBe(true)
  })

  it('returns true for kmb mode when age exceeds 60 seconds', () => {
    const now = 1000000
    const lastUpdatedAt = now - 70000 // 70 seconds ago
    expect(isStaleByAge({ lastUpdatedAt, mode: 'kmb', now })).toBe(true)
  })

  it('returns true for mtr mode when age exceeds 90 seconds', () => {
    const now = 1000000
    const lastUpdatedAt = now - 100000 // 100 seconds ago
    expect(isStaleByAge({ lastUpdatedAt, mode: 'mtr', now })).toBe(true)
  })

  it('returns true for lrt mode when age exceeds 90 seconds', () => {
    const now = 1000000
    const lastUpdatedAt = now - 100000 // 100 seconds ago
    expect(isStaleByAge({ lastUpdatedAt, mode: 'lrt', now })).toBe(true)
  })

  it('returns false for mtr mode at 60 seconds (below 90s threshold)', () => {
    const now = 1000000
    const lastUpdatedAt = now - 60000 // 60 seconds ago
    expect(isStaleByAge({ lastUpdatedAt, mode: 'mtr', now })).toBe(false)
  })

  it('accepts Date object for now parameter', () => {
    const lastUpdatedAt = 1000000
    const now = new Date(lastUpdatedAt + 200000)
    expect(isStaleByAge({ lastUpdatedAt, mode: 'kmb', now })).toBe(true)
  })
})

describe('formatRelativeAgeLabel', () => {
  it('returns null when lastUpdatedAt is undefined', () => {
    expect(formatRelativeAgeLabel({ lastUpdatedAt: undefined, lang: 'en' })).toBe(null)
  })

  it('returns null when lastUpdatedAt is null', () => {
    expect(formatRelativeAgeLabel({ lastUpdatedAt: null, lang: 'en' })).toBe(null)
  })

  it('returns null for NaN date', () => {
    expect(formatRelativeAgeLabel({ lastUpdatedAt: Number.NaN, lang: 'en' })).toBe(null)
  })

  it('returns null for future dates (negative diff)', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const lastUpdatedAt = now.getTime() + 60000 // 1 minute in future
    expect(formatRelativeAgeLabel({ lastUpdatedAt, lang: 'en', now })).toBe(null)
  })

  it("returns 'just now' for very recent updates (< 30s)", () => {
    const now = new Date('2024-01-01T00:00:15.000Z')
    const lastUpdatedAt = now.getTime() - 10000 // 10 seconds ago
    expect(formatRelativeAgeLabel({ lastUpdatedAt, lang: 'en', now })).toBe('just now')
  })

  it("returns '刚刚' for very recent updates in sc", () => {
    const now = new Date('2024-01-01T00:00:15.000Z')
    const lastUpdatedAt = now.getTime() - 10000
    expect(formatRelativeAgeLabel({ lastUpdatedAt, lang: 'sc', now })).toBe('刚刚')
  })

  it("returns '剛剛' for very recent updates in tc", () => {
    const now = new Date('2024-01-01T00:00:15.000Z')
    const lastUpdatedAt = now.getTime() - 10000
    expect(formatRelativeAgeLabel({ lastUpdatedAt, lang: 'tc', now })).toBe('剛剛')
  })

  it('returns minutes ago for updates within an hour', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const lastUpdatedAt = now.getTime() - 5 * 60000 // 5 minutes ago
    expect(formatRelativeAgeLabel({ lastUpdatedAt, lang: 'en', now })).toBe('5 min ago')
  })

  it("returns '分钟前' for updates within an hour in sc", () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const lastUpdatedAt = now.getTime() - 10 * 60000
    expect(formatRelativeAgeLabel({ lastUpdatedAt, lang: 'sc', now })).toBe('10 分钟前')
  })

  it("returns '分鐘前' for updates within an hour in tc", () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const lastUpdatedAt = now.getTime() - 15 * 60000
    expect(formatRelativeAgeLabel({ lastUpdatedAt, lang: 'tc', now })).toBe('15 分鐘前')
  })

  it('returns hours ago for updates over an hour', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const lastUpdatedAt = now.getTime() - 90 * 60000 // 90 minutes ago
    expect(formatRelativeAgeLabel({ lastUpdatedAt, lang: 'en', now })).toBe('2 hrs ago')
  })

  it("returns '1 hr ago' for singular hour", () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const lastUpdatedAt = now.getTime() - 60 * 60000 // 60 minutes ago
    expect(formatRelativeAgeLabel({ lastUpdatedAt, lang: 'en', now })).toBe('1 hr ago')
  })

  it("returns '小时前' for hours in sc", () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const lastUpdatedAt = now.getTime() - 120 * 60000
    expect(formatRelativeAgeLabel({ lastUpdatedAt, lang: 'sc', now })).toBe('2 小时前')
  })

  it("returns '小時前' for hours in tc", () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const lastUpdatedAt = now.getTime() - 180 * 60000
    expect(formatRelativeAgeLabel({ lastUpdatedAt, lang: 'tc', now })).toBe('3 小時前')
  })
})
