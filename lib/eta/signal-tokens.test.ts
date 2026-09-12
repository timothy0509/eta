import { describe, expect, it } from 'vitest'
import {
  SIGNAL_URGENCY,
  STALE_THRESHOLDS_MS,
  getModeToken,
  getSignalForMinutes,
  getSignalToken,
  getSignalWashToken,
} from './signal-tokens'

describe('SIGNAL_URGENCY', () => {
  it('keeps now and soon cutoffs', () => {
    expect(SIGNAL_URGENCY.NOW_MAX_MIN).toBe(3)
    expect(SIGNAL_URGENCY.SOON_MAX_MIN).toBe(12)
  })
})

describe('STALE_THRESHOLDS_MS re-export', () => {
  it('matches per mode cache ages', () => {
    expect(STALE_THRESHOLDS_MS.kmb).toBe(60_000)
    expect(STALE_THRESHOLDS_MS.mtr).toBe(90_000)
    expect(STALE_THRESHOLDS_MS.lrt).toBe(90_000)
  })
})

describe('getSignalForMinutes', () => {
  it('returns lost when feed is stale', () => {
    expect(getSignalForMinutes(1, true)).toBe('lost')
    expect(getSignalForMinutes(8, true)).toBe('lost')
    expect(getSignalForMinutes(30, true)).toBe('lost')
    expect(getSignalForMinutes(null, true)).toBe('lost')
  })

  it('returns lost when minutes are missing', () => {
    expect(getSignalForMinutes(null, false)).toBe('lost')
    expect(getSignalForMinutes(Number.NaN, false)).toBe('lost')
  })

  it('returns now at or below the now cutoff', () => {
    expect(getSignalForMinutes(0, false)).toBe('now')
    expect(getSignalForMinutes(3, false)).toBe('now')
    expect(getSignalForMinutes(-1, false)).toBe('now')
  })

  it('returns soon above now and at or below the soon cutoff', () => {
    expect(getSignalForMinutes(4, false)).toBe('soon')
    expect(getSignalForMinutes(12, false)).toBe('soon')
  })

  it('returns later above the soon cutoff', () => {
    expect(getSignalForMinutes(13, false)).toBe('later')
    expect(getSignalForMinutes(45, false)).toBe('later')
  })
})

describe('token helpers', () => {
  it('maps each mode to its css var', () => {
    expect(getModeToken('kmb')).toBe('var(--mode-kmb)')
    expect(getModeToken('mtr')).toBe('var(--mode-mtr)')
    expect(getModeToken('lrt')).toBe('var(--mode-lrt)')
  })

  it('maps each signal to text and wash vars', () => {
    expect(getSignalToken('now')).toBe('var(--signal-now)')
    expect(getSignalWashToken('soon')).toBe('var(--signal-soon-wash)')
    expect(getSignalWashToken('alert')).toBe('var(--signal-alert-wash)')
  })
})
