import type { RouteListEntry } from 'hk-bus-eta'
import { describe, expect, it } from 'vitest'

import type { KmbRouteStopLite } from '@/lib/eta/client'
import { computeKmbRouteVariantStops, getStopToTerminusFare } from './kmb-fares'

function variantStopsFor(routeStops: KmbRouteStopLite[]) {
  return computeKmbRouteVariantStops(routeStops)
}

function entryWithFares(fares: unknown): RouteListEntry {
  return { fares } as unknown as RouteListEntry
}

const ROUTE_STOPS: KmbRouteStopLite[] = [
  { co: 'kmb', route: '1', bound: 'O', serviceType: '1', seq: 1, stopId: 'FIRST' },
  { co: 'kmb', route: '1', bound: 'O', serviceType: '1', seq: 2, stopId: 'MID' },
]

describe('getStopToTerminusFare', () => {
  it('prefers the hk-bus-eta per-section fare', () => {
    const fare = getStopToTerminusFare({
      co: 'kmb',
      route: '1',
      dir: 'O',
      serviceType: '1',
      stopId: 'MID',
      byVariantStops: variantStopsFor(ROUTE_STOPS),
      routeVariantIndex: new Map([['kmb|1|O|1', entryWithFares(['9.9', '8.8'])]]),
    })
    expect(fare).toEqual({ hkd: 8.8, source: 'hk-bus-eta' })
  })

  it('falls back to the TD full-journey fare when the entry is missing', () => {
    const fare = getStopToTerminusFare({
      co: 'kmb',
      route: '1',
      dir: 'O',
      serviceType: '1',
      stopId: 'MID',
      byVariantStops: variantStopsFor(ROUTE_STOPS),
      routeVariantIndex: new Map(),
    })
    expect(fare).toEqual({ hkd: 6.7, source: 'td-full-fare' })
  })

  it('falls back to the TD full-journey fare when fares are unusable', () => {
    const fare = getStopToTerminusFare({
      co: 'kmb',
      route: '1',
      dir: 'O',
      serviceType: '1',
      stopId: 'MID',
      byVariantStops: variantStopsFor(ROUTE_STOPS),
      routeVariantIndex: new Map([['kmb|1|O|1', entryWithFares(['', ''])]]),
    })
    expect(fare).toEqual({ hkd: 6.7, source: 'td-full-fare' })
  })

  it('returns null when neither source has a fare', () => {
    const fare = getStopToTerminusFare({
      co: 'kmb',
      route: 'ZZZ',
      dir: 'O',
      serviceType: '1',
      stopId: 'NOWHERE',
      byVariantStops: variantStopsFor(ROUTE_STOPS),
      routeVariantIndex: new Map(),
    })
    expect(fare).toBeNull()
  })
})
