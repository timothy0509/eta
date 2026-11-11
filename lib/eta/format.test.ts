import { describe, expect, it } from 'vitest'

import {
  formatExactHms,
  formatFareHkd,
  formatIsoToExactHms,
  formatMinutesFromNowToExactHms,
  formatMtrExactForTrain,
  formatMtrTimeToExactHms,
  formatRelativeMinutes,
  formatRelativeMinutesWithDrift,
  formatUiLanguageLabel,
  minsToDisplay,
} from './format'

describe('formatRelativeMinutes', () => {
  it('returns rounded minutes difference', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const target = '2024-01-01T00:05:00.000Z'

    expect(formatRelativeMinutes(target, now)).toBe(5)
  })

  it('handles negative differences', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const target = '2023-12-31T23:58:00.000Z'

    expect(formatRelativeMinutes(target, now)).toBe(-2)
  })
})

describe('formatRelativeMinutesWithDrift', () => {
  it('returns same as formatRelativeMinutes when no data timestamp', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const target = '2024-01-01T00:05:00.000Z'

    expect(formatRelativeMinutesWithDrift(target, undefined, now)).toBe(5)
  })

  it('subtracts data age from ETA', () => {
    const now = new Date('2024-01-01T00:00:30.000Z')
    const target = '2024-01-01T00:03:00.000Z' // 2.5 min from now
    const dataTimestamp = '2024-01-01T00:00:00.000Z' // data is 30s old

    // Without drift: 2.5 min -> rounds to 3
    // With drift: 2.5 - 0.5 = 2.0 min -> rounds to 2
    expect(formatRelativeMinutesWithDrift(target, dataTimestamp, now)).toBe(2)
  })

  it('handles arriving buses correctly with drift', () => {
    const now = new Date('2024-01-01T00:00:45.000Z')
    const target = '2024-01-01T00:01:00.000Z' // 15s from now
    const dataTimestamp = '2024-01-01T00:00:00.000Z' // data is 45s old

    // Bus was 1 min away 45s ago, so it should be arriving now
    expect(formatRelativeMinutesWithDrift(target, dataTimestamp, now)).toBe(0)
  })
})

describe('formatUiLanguageLabel', () => {
  it('returns the expected labels', () => {
    expect(formatUiLanguageLabel('en')).toBe('EN')
    expect(formatUiLanguageLabel('tc')).toBe('繁')
    expect(formatUiLanguageLabel('sc')).toBe('简')
  })
})

describe('formatFareHkd', () => {
  it('formats finite fares with one decimal', () => {
    expect(formatFareHkd(5.2)).toBe('HK$ 5.2')
  })

  it('returns null for missing or non-numeric fares', () => {
    expect(formatFareHkd(undefined)).toBeNull()
    expect(formatFareHkd('5.2')).toBeNull()
    expect(formatFareHkd(NaN)).toBeNull()
  })
})

describe('exact ETA time', () => {
  it('formats an ISO ETA as hh:mm:ss in Hong Kong time', () => {
    // 08:05:06 HKT is 00:05:06 UTC.
    expect(formatIsoToExactHms('2024-01-01T00:05:06.000Z')).toBe('08:05:06')
  })

  it('returns null for invalid ISO input', () => {
    expect(formatIsoToExactHms('not-a-date')).toBeNull()
  })

  it('parses the MTR space-separated wall-clock form', () => {
    expect(formatMtrTimeToExactHms('2024-01-01 08:05:06')).toBe('08:05:06')
    expect(formatMtrTimeToExactHms('2024-01-01 08:05')).toBe('08:05:00')
  })

  it('rejects missing MTR time input', () => {
    expect(formatMtrTimeToExactHms(undefined)).toBeNull()
    expect(formatMtrTimeToExactHms('')).toBeNull()
    expect(formatMtrTimeToExactHms('tomorrow-ish')).toBeNull()
  })

  it('renders minutes-from-now as an hh:mm:ss wall clock', () => {
    const now = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(formatMinutesFromNowToExactHms(5, now)).toBe('08:05:00')
  })

  it('zeroes seconds for minute-granularity sources', () => {
    // 37 seconds past the minute must not leak into the display.
    const now = new Date('2024-01-01T00:00:37.000Z').getTime()
    expect(formatMinutesFromNowToExactHms(5, now)).toBe('08:05:00')
  })

  it('returns null for non-finite minutes-from-now input', () => {
    const now = new Date('2024-01-01T00:00:00.000Z').getTime()
    expect(formatMinutesFromNowToExactHms(Number.NaN, now)).toBeNull()
    expect(formatMinutesFromNowToExactHms(Number.POSITIVE_INFINITY, now)).toBeNull()
    expect(formatMinutesFromNowToExactHms(5, Number.NaN)).toBeNull()
  })

  it('pads single digits in hh:mm:ss output', () => {
    expect(formatExactHms(new Date('2024-01-01T00:01:02.000Z'))).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})

describe('formatMtrExactForTrain', () => {
  it('prefers the API time field over ttnt', () => {
    expect(formatMtrExactForTrain({ time: '2024-01-01 08:05:06', ttnt: '3' })).toBe('08:05:06')
  })

  it('falls back to now plus ttnt minutes with zeroed seconds', () => {
    const now = new Date('2024-01-01T00:00:37.000Z').getTime()
    expect(formatMtrExactForTrain({ ttnt: '5' }, now)).toBe('08:05:00')
  })

  it('returns null when neither time nor ttnt resolves', () => {
    expect(formatMtrExactForTrain({})).toBeNull()
    expect(formatMtrExactForTrain({ ttnt: '0' })).toBeNull()
    expect(formatMtrExactForTrain({ ttnt: 'soon' })).toBeNull()
    expect(formatMtrExactForTrain({ time: 'tomorrow-ish', ttnt: '' })).toBeNull()
  })
})

describe('minsToDisplay', () => {
  it('formats minutes since midnight as HH:MM', () => {
    expect(minsToDisplay(335)).toBe('05:35')
    expect(minsToDisplay(0)).toBe('00:00')
  })

  it('wraps after-midnight windows past 1440', () => {
    expect(minsToDisplay(1470)).toBe('00:30')
  })
})
