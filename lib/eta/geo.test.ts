import { describe, expect, it } from 'vitest'

import { computeNearbyStops, formatDistanceKm, haversineDistanceKm } from './geo'

describe('haversineDistanceKm', () => {
  it('returns a known distance between Hong Kong Central and Tsim Sha Tsui', () => {
    const central = { lat: 22.2819, lng: 114.1581 }
    const tst = { lat: 22.2958, lng: 114.1723 }

    const distance = haversineDistanceKm(central, tst)

    // Expected ~2.1 km. Allow a small tolerance for floating point math.
    expect(distance).toBeGreaterThan(1.9)
    expect(distance).toBeLessThan(2.3)
  })

  it('returns zero for identical points', () => {
    const point = { lat: 22.3193, lng: 114.1694 }
    expect(haversineDistanceKm(point, point)).toBe(0)
  })
})

describe('formatDistanceKm', () => {
  it('formats metres when distance is below 1 km', () => {
    expect(formatDistanceKm(0.45, 'en')).toBe('450 m')
    expect(formatDistanceKm(0.45, 'tc')).toBe('450 米')
  })

  it('formats kilometres when distance is 1 km or more', () => {
    expect(formatDistanceKm(1.2, 'en')).toBe('1.2 km')
    expect(formatDistanceKm(2.0, 'en')).toBe('2 km')
    expect(formatDistanceKm(5.55, 'tc')).toBe('5.6 公里')
  })
})

describe('computeNearbyStops', () => {
  it('sorts stops by distance and respects the limit', () => {
    const user = { lat: 0, lng: 0 }
    const stops = [
      { id: 'far', lat: 0.1, lng: 0.1 },
      { id: 'near', lat: 0.001, lng: 0.001 },
      { id: 'mid', lat: 0.01, lng: 0.01 },
    ]

    const result = computeNearbyStops(user, stops, 2)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('near')
    expect(result[1].id).toBe('mid')
  })

  it('returns all stops sorted when no limit is provided', () => {
    const user = { lat: 0, lng: 0 }
    const stops = [
      { name: 'mid', lat: 0.05, lng: 0 },
      { name: 'near', lat: 0.001, lng: 0 },
      { name: 'far', lat: 0.2, lng: 0 },
    ]

    const result = computeNearbyStops(user, stops)

    expect(result).toHaveLength(3)
    expect(result.map((s) => s.name)).toEqual(['near', 'mid', 'far'])
  })
})
