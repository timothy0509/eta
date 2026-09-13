import { describe, expect, it } from 'vitest'
import {
  isKmbRealtime,
  isLrtRealtime,
  isRealtime,
  mtrTimeTypeOf,
  parseMtrTimeType,
} from './realtime'

describe('parseMtrTimeType', () => {
  it('maps A to arrival and D to departure', () => {
    expect(parseMtrTimeType('A')).toBe('arrival')
    expect(parseMtrTimeType('D')).toBe('departure')
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(parseMtrTimeType(' a ')).toBe('arrival')
    expect(parseMtrTimeType('d')).toBe('departure')
  })

  it('returns null for anything else, including legacy digits', () => {
    expect(parseMtrTimeType('1')).toBeNull()
    expect(parseMtrTimeType('2')).toBeNull()
    expect(parseMtrTimeType('')).toBeNull()
    expect(parseMtrTimeType(null)).toBeNull()
    expect(parseMtrTimeType()).toBeNull()
  })
})

describe('mtrTimeTypeOf', () => {
  it('prefers the official timeType field', () => {
    expect(mtrTimeTypeOf({ timeType: 'A' })).toBe('arrival')
    expect(mtrTimeTypeOf({ timeType: 'D' })).toBe('departure')
  })

  it('falls back to the legacy timetype key', () => {
    expect(mtrTimeTypeOf({ timetype: 'A' })).toBe('arrival')
    expect(mtrTimeTypeOf({})).toBeNull()
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
    expect(isRealtime({ mode: 'kmb', etaSeq: 1, lastUpdatedAt: now, now })).toBe(true)
    expect(isRealtime({ mode: 'lrt', lastUpdatedAt: now, now })).toBe(true)
  })
})
