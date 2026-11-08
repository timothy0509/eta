import { describe, expect, it } from 'vitest'

import {
  fareForIndices,
  mapRouteStopsToFareIndices,
  resolveFareVariant,
  resolveFareVariantForStop,
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

describe('resolveFareVariantForStop', () => {
  const other: VariantFares = {
    stops: ['X', 'Y'],
    fares: [[[1, 5.2]], null],
  }
  const serviceThree: VariantFares = {
    stops: ['A', 'B', 'C', 'D'],
    fares: [[[3, 8.4]], [[3, 8.4]], null, null],
  }
  const index: FareIndex = {
    updated: '2026-11-02',
    variants: {
      'kmb|1|O|1|1001': fare,
      'kmb|1|O|2|2002': other,
      'kmb|1|O|3|3003': serviceThree,
    },
  }

  it('uses the exact key when it resolves', () => {
    expect(resolveFareVariantForStop(index, 'kmb|1|O|1|1001', 'Z')).toBe(fare)
  })

  it('picks the region containing the stop when the key has no gtfsId', () => {
    expect(resolveFareVariantForStop(index, 'kmb|1|O|1', 'Y')).toBe(other)
    expect(resolveFareVariantForStop(index, 'kmb|1|O|1', 'C')).toBe(fare)
  })

  it('prefers the matching service type', () => {
    expect(resolveFareVariantForStop(index, 'kmb|1|O|3', 'C')).toBe(serviceThree)
  })

  it('returns null when no region serves the stop', () => {
    expect(resolveFareVariantForStop(index, 'kmb|1|O|1', 'missing')).toBeNull()
    expect(resolveFareVariantForStop(index, 'kmb|2|O|1', 'C')).toBeNull()
  })
})
