import { describe, expect, it } from 'vitest'

import {
  OPERATOR_COLOR_FALLBACK,
  getOperatorColor,
  getOperatorStripBackground,
  normalizeOperator,
} from '@/lib/eta/operator-colors'

describe('normalizeOperator', () => {
  it('trims and lowercases codes', () => {
    expect(normalizeOperator(' Ctb ')).toBe('ctb')
    expect(normalizeOperator('KMB')).toBe('kmb')
  })

  it('defaults undefined to kmb', () => {
    expect(normalizeOperator(undefined)).toBe('kmb')
  })
})

describe('getOperatorColor', () => {
  it('maps known operators to brand colors', () => {
    expect(getOperatorColor('kmb')).toBe('#d13b31')
    expect(getOperatorColor('lwb')).toBe('#f58220')
    expect(getOperatorColor('ctb')).toBe('#f0dd4d')
    expect(getOperatorColor('nwfb')).toBe('#f0dd4d')
    expect(getOperatorColor('lrtfeeder')).toBe('#1a2b4e')
    expect(getOperatorColor('nlb')).toBe('#559f9a')
    expect(getOperatorColor('gmb')).toBe('#d9fcd1')
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(getOperatorColor('KMB')).toBe('#d13b31')
    expect(getOperatorColor(' Ctb ')).toBe('#f0dd4d')
  })

  it('defaults undefined to KMB', () => {
    expect(getOperatorColor(undefined)).toBe('#d13b31')
  })

  it('falls back for ferry and unknown operators', () => {
    expect(getOperatorColor('sunferry')).toBe(OPERATOR_COLOR_FALLBACK)
    expect(getOperatorColor('hkkf')).toBe(OPERATOR_COLOR_FALLBACK)
    expect(getOperatorColor('fortuneferry')).toBe(OPERATOR_COLOR_FALLBACK)
    expect(getOperatorColor('unknown')).toBe(OPERATOR_COLOR_FALLBACK)
    expect(getOperatorColor('')).toBe(OPERATOR_COLOR_FALLBACK)
  })
})

describe('getOperatorStripBackground', () => {
  it('returns a solid color for a single operator', () => {
    expect(getOperatorStripBackground(['kmb'])).toBe('#d13b31')
    expect(getOperatorStripBackground(['ctb'])).toBe('#f0dd4d')
  })

  it('splits joint operators evenly top to bottom', () => {
    expect(getOperatorStripBackground(['kmb', 'ctb'])).toBe(
      'linear-gradient(180deg, #d13b31 0% 50%, #f0dd4d 50% 100%)'
    )
  })

  it('splits three operators into thirds', () => {
    expect(getOperatorStripBackground(['kmb', 'ctb', 'nlb'])).toBe(
      'linear-gradient(180deg, #d13b31 0% 33.33%, #f0dd4d 33.33% 66.67%, #559f9a 66.67% 100%)'
    )
  })

  it('normalizes codes before coloring', () => {
    expect(getOperatorStripBackground(['KMB'])).toBe('#d13b31')
    expect(getOperatorStripBackground(['kmb', ' CTB '])).toBe(
      'linear-gradient(180deg, #d13b31 0% 50%, #f0dd4d 50% 100%)'
    )
  })

  it('falls back when the operator list is empty', () => {
    expect(getOperatorStripBackground([], 'ctb')).toBe('#f0dd4d')
    expect(getOperatorStripBackground([])).toBe('#d13b31')
  })
})
