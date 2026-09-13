import { describe, expect, it } from 'vitest'
import { isKmbRealtime, isLrtRealtime, isMtrRealtime, isRealtime } from './realtime'

describe('isMtrRealtime', () => {
  it('treats timetype 1 as scheduled', () => {
    expect(isMtrRealtime('1')).toBe(false)
    expect(isMtrRealtime(1)).toBe(false)
  })

  it('treats other timetypes as realtime', () => {
    expect(isMtrRealtime('2')).toBe(true)
    expect(isMtrRealtime('0')).toBe(true)
  })

  it('falls back to scheduled when timetype is missing', () => {
    expect(isMtrRealtime()).toBe(false)
    expect(isMtrRealtime(null)).toBe(false)
    expect(isMtrRealtime('')).toBe(false)
  })
})

describe('isKmbRealtime', () => {
  it('returns true for fresh data with eta_seq present', () => {
    const now = Date.now()
    expect(isKmbRealtime({ etaSeq: 1, lastUpdatedAt: now - 10_000, now })).toBe(true)
  })

  it('returns false when the remark marks a scheduled bus', () => {
    const now = Date.now()
    expect(
      isKmbRealtime({ etaSeq: 1, rmk_en: 'Scheduled Bus', lastUpdatedAt: now - 10_000, now })
    ).toBe(false)
  })

  it('returns false when eta_seq is missing', () => {
    const now = Date.now()
    expect(isKmbRealtime({ lastUpdatedAt: now - 10_000, now })).toBe(false)
    expect(isKmbRealtime({ etaSeq: 0, lastUpdatedAt: now - 10_000, now })).toBe(false)
  })

  it('respects the KMB stale boundary at 60s', () => {
    const now = Date.now()
    expect(isKmbRealtime({ etaSeq: 1, lastUpdatedAt: now - 59_000, now })).toBe(true)
    expect(isKmbRealtime({ etaSeq: 1, lastUpdatedAt: now - 61_000, now })).toBe(false)
  })

  it('accepts dataTimestamp strings', () => {
    const now = Date.now()
    expect(
      isKmbRealtime({ etaSeq: 1, dataTimestamp: new Date(now - 10_000).toISOString(), now })
    ).toBe(true)
  })
})

describe('isLrtRealtime', () => {
  it('returns true for fresh data', () => {
    const now = Date.now()
    expect(isLrtRealtime({ lastUpdatedAt: now - 10_000, now })).toBe(true)
  })

  it('respects the LRT stale boundary at 90s', () => {
    const now = Date.now()
    expect(isLrtRealtime({ lastUpdatedAt: now - 89_000, now })).toBe(true)
    expect(isLrtRealtime({ lastUpdatedAt: now - 91_000, now })).toBe(false)
  })
})

describe('isRealtime dispatcher', () => {
  it('routes by mode', () => {
    const now = Date.now()
    expect(isRealtime({ mode: 'mtr', timetype: '1' })).toBe(false)
    expect(isRealtime({ mode: 'mtr', timetype: '2' })).toBe(true)
    expect(isRealtime({ mode: 'kmb', etaSeq: 1, lastUpdatedAt: now, now })).toBe(true)
    expect(isRealtime({ mode: 'lrt', lastUpdatedAt: now, now })).toBe(true)
  })
})
