import { describe, expect, it } from 'vitest'

import {
  formatRelativeMinutes,
  formatRelativeMinutesWithDrift,
  formatUiLanguageLabel,
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
