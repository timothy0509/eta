import { describe, expect, it } from 'vitest'

import { formatRelativeMinutes, formatUiLanguageLabel } from './format'

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

describe('formatUiLanguageLabel', () => {
  it('returns the expected labels', () => {
    expect(formatUiLanguageLabel('en')).toBe('EN')
    expect(formatUiLanguageLabel('tc')).toBe('繁')
    expect(formatUiLanguageLabel('sc')).toBe('简')
  })
})
