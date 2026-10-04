import { describe, expect, it } from 'vitest'

import { FARE_SECTION_COLORS, FARE_UNKNOWN_COLOR, getFareSectionColor } from './fare-colors'

describe('getFareSectionColor', () => {
  it('returns the palette entry for the section index', () => {
    expect(getFareSectionColor(0)).toBe(FARE_SECTION_COLORS[0])
    expect(getFareSectionColor(2)).toBe(FARE_SECTION_COLORS[2])
  })

  it('cycles when there are more sections than colors', () => {
    expect(getFareSectionColor(FARE_SECTION_COLORS.length)).toBe(FARE_SECTION_COLORS[0])
  })

  it('exposes a neutral unknown color', () => {
    expect(typeof FARE_UNKNOWN_COLOR).toBe('string')
  })
})
