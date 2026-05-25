import { describe, expect, it } from 'vitest'

import { isStaleByFlagOrAge, STALE_THRESHOLDS_MS } from './stale'

describe('isStaleByFlagOrAge', () => {
  it('returns true when upstream is stale', () => {
    expect(isStaleByFlagOrAge({ upstreamStale: true, mode: 'kmb' })).toBe(true)
  })

  it('returns false when age is missing', () => {
    expect(isStaleByFlagOrAge({ mode: 'kmb' })).toBe(false)
  })

  it('returns true when age exceeds threshold', () => {
    const ageMs = STALE_THRESHOLDS_MS.kmb + 1
    expect(isStaleByFlagOrAge({ mode: 'kmb', ageMs })).toBe(true)
  })

  it('returns false when age is below threshold', () => {
    const ageMs = STALE_THRESHOLDS_MS.kmb - 1
    expect(isStaleByFlagOrAge({ mode: 'kmb', ageMs })).toBe(false)
  })

  it('returns false when upstream is false and age is undefined', () => {
    expect(isStaleByFlagOrAge({ upstreamStale: false, mode: 'kmb' })).toBe(false)
  })
})
