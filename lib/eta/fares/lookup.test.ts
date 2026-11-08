import { describe, expect, it } from 'vitest'

import {
  fareForIndices,
  hasSectionalFares,
  mapRouteStopsToFareIndices,
  resolveFareVariant,
} from '@/lib/eta/fares/lookup'
import type { FareIndex, VariantFares } from '@/lib/eta/fares/types'

const fare: VariantFares = {
  stops: ['A', 'B', 'C', 'D'],
  fares: [
    [
      [2, 4.9],
      [3, 7.3],
    ],
    [[3, 4.9]],
    null,
    null,
  ],
}

function indexWith(variant: VariantFares): FareIndex {
  return { updated: '2026-11-02', variants: { 'gmb|36A|O|1|2010863': variant } }
}

describe('fareForIndices', () => {
  it('returns the fare for an earlier alighting stop', () => {
    expect(fareForIndices(fare, 0, 1)).toBe(4.9)
    expect(fareForIndices(fare, 0, 2)).toBe(4.9)
    expect(fareForIndices(fare, 0, 3)).toBe(7.3)
  })

  it('returns null for the same stop, backwards travel, or a missing row', () => {
    expect(fareForIndices(fare, 1, 1)).toBeNull()
    expect(fareForIndices(fare, 3, 0)).toBeNull()
    expect(fareForIndices(fare, 2, 3)).toBeNull()
    expect(fareForIndices(fare, 0, 99)).toBeNull()
  })
})

describe('hasSectionalFares', () => {
  it('is true when a boarding stop has more than one fare stage', () => {
    expect(hasSectionalFares(fare)).toBe(true)
  })

  it('is false for a flat fare table', () => {
    expect(hasSectionalFares({ stops: ['A', 'B'], fares: [[[1, 6.7]], null] })).toBe(false)
  })
})

describe('mapRouteStopsToFareIndices', () => {
  it('uses identity when the stop order matches', () => {
    const stops = ['A', 'B', 'C', 'D'].map((stopId) => ({ stopId }))
    expect(mapRouteStopsToFareIndices(fare, stops)).toEqual([0, 1, 2, 3])
  })

  it('maps by stop id when the app list carries extra stops', () => {
    const stops = ['A', 'X', 'B', 'C', 'D'].map((stopId) => ({ stopId }))
    expect(mapRouteStopsToFareIndices(fare, stops)).toEqual([0, -1, 1, 2, 3])
  })

  it('matches repeated stops in occurrence order', () => {
    const circular: VariantFares = {
      stops: ['A', 'B', 'A', 'C'],
      fares: [null, null, null, null],
    }
    const stops = ['A', 'B', 'A', 'C'].map((stopId) => ({ stopId }))
    expect(mapRouteStopsToFareIndices(circular, stops)).toEqual([0, 1, 2, 3])
  })
})

describe('resolveFareVariant', () => {
  it('prefers the exact key', () => {
    expect(resolveFareVariant(indexWith(fare), 'gmb|36A|O|1|2010863')).toBe(fare)
  })

  it('falls back to the same gtfsId with a different service type', () => {
    expect(resolveFareVariant(indexWith(fare), 'gmb|36A|O|2|2010863')).toBe(fare)
  })

  it('does not match another gtfsId or bound', () => {
    const index = indexWith(fare)
    expect(resolveFareVariant(index, 'gmb|36A|O|1|999')).toBeNull()
    expect(resolveFareVariant(index, 'gmb|36A|I|1|2010863')).toBeNull()
  })
})
