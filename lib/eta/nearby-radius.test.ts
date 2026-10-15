import { describe, expect, it } from 'vitest'

import { NEARBY_RADIUS_MAX_KM, NEARBY_RADIUS_MIN_KM, clampNearbyRadiusKm } from './nearby-radius'

describe('clampNearbyRadiusKm', () => {
  it('passes through in-band values quantized to 250 m steps', () => {
    expect(clampNearbyRadiusKm(2)).toBe(2)
    expect(clampNearbyRadiusKm(1.3)).toBe(1.25)
    expect(clampNearbyRadiusKm(0.75)).toBe(0.75)
  })

  it('clamps out-of-band values', () => {
    expect(clampNearbyRadiusKm(0)).toBe(NEARBY_RADIUS_MIN_KM)
    expect(clampNearbyRadiusKm(-3)).toBe(NEARBY_RADIUS_MIN_KM)
    expect(clampNearbyRadiusKm(50)).toBe(NEARBY_RADIUS_MAX_KM)
  })

  it('defaults non-finite input sanely', () => {
    expect(clampNearbyRadiusKm(Number.NaN)).toBe(2)
    expect(clampNearbyRadiusKm(Number.POSITIVE_INFINITY)).toBe(NEARBY_RADIUS_MAX_KM)
    expect(clampNearbyRadiusKm(Number.NEGATIVE_INFINITY)).toBe(NEARBY_RADIUS_MIN_KM)
  })
})
