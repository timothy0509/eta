import { describe, expect, it } from 'vitest'

import { OPERATOR_COLOR_FALLBACK, getOperatorColor } from '@/lib/eta/operator-colors'

describe('getOperatorColor', () => {
  it('maps known operators to brand colors', () => {
    expect(getOperatorColor('kmb')).toBe('#d13b31')
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
