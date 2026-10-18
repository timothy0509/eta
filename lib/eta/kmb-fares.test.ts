import { describe, expect, it } from 'vitest'
import type { Company, RouteListEntry } from 'hk-bus-eta'

import type { KmbRouteStopLite } from '@/lib/eta/client'
import { routeVariantKey } from '@/lib/eta/eta-db-index'
import { computeEtaLeg, computeKmbRouteVariantStops, getStopToTerminusFare } from './kmb-fares'

function routeStop(
  co: Company,
  route: string,
  bound: string,
  serviceType: string,
  gtfsId: string,
  stopId: string,
  seq: number
): KmbRouteStopLite {
  return { co, route, bound, serviceType, seq, stopId, gtfsId, region: '' }
}

function routeEntry(
  co: Company,
  route: string,
  bound: string,
  serviceType: string,
  gtfsId: string,
  stops: string[],
  fares: string[]
): RouteListEntry {
  const companies: Company[] = ['kmb', 'ctb', 'nlb', 'lrtfeeder', 'gmb', 'lightRail', 'mtr']
  const boundMap = Object.fromEntries(companies.map((c) => [c, 'O'])) as RouteListEntry['bound']
  boundMap[co] = bound as RouteListEntry['bound'][Company]
  const stopMap = Object.fromEntries(
    companies.map((c) => [c, []])
  ) as unknown as RouteListEntry['stops']
  stopMap[co] = stops
  return {
    route,
    co: [co],
    orig: { en: 'O', zh: 'O' },
    dest: { en: 'D', zh: 'D' },
    stops: stopMap,
    bound: boundMap,
    serviceType,
    fares,
    faresHoliday: null,
    freq: null,
    jt: null,
    seq: 1,
    nlbId: '',
    gtfsId,
  }
}

describe('getStopToTerminusFare region handling', () => {
  it('resolves KMB fares without a gtfsId via the family fallback', () => {
    // Regression: KMB ETAs from the official API carry no gtfsId while the
    // variant index is keyed with one. The lookup must fall back to the
    // family instead of returning null.
    const stops = [
      routeStop('kmb', '1A', 'O', '1', '1053', 'S1', 1),
      routeStop('kmb', '1A', 'O', '1', '1053', 'S2', 2),
    ]
    const byVariantStops = computeKmbRouteVariantStops(stops)
    const entry = routeEntry('kmb', '1A', 'O', '1', '1053', ['S1', 'S2'], ['8.2', '5.0'])
    const routeVariantIndex = new Map([
      [
        routeVariantKey({ co: 'kmb', route: '1A', bound: 'O', serviceType: '1', gtfsId: '1053' }),
        entry,
      ],
    ])
    const fare = getStopToTerminusFare({
      co: 'kmb',
      route: '1A',
      dir: 'O',
      serviceType: '1',
      stopId: 'S1',
      byVariantStops,
      routeVariantIndex,
    })
    expect(fare).toEqual({ hkd: 8.2, source: 'hk-bus-eta' })
  })

  it('picks the family variant holding the stop, not just the smallest gtfsId', () => {
    // KMB 83X I 1 pattern: two gtfsIds, one stop served only by the larger.
    const stops = [
      routeStop('kmb', '83X', 'I', '1', '1348', 'SHARED', 1),
      routeStop('kmb', '83X', 'I', '1', '8492', 'SHARED', 1),
      routeStop('kmb', '83X', 'I', '1', '8492', 'BRANCH', 2),
    ]
    const byVariantStops = computeKmbRouteVariantStops(stops)
    const small = routeEntry('kmb', '83X', 'I', '1', '1348', ['SHARED'], ['4.0'])
    const large = routeEntry('kmb', '83X', 'I', '1', '8492', ['SHARED', 'BRANCH'], ['9.0', '6.0'])
    const routeVariantIndex = new Map([
      [
        routeVariantKey({ co: 'kmb', route: '83X', bound: 'I', serviceType: '1', gtfsId: '1348' }),
        small,
      ],
      [
        routeVariantKey({ co: 'kmb', route: '83X', bound: 'I', serviceType: '1', gtfsId: '8492' }),
        large,
      ],
    ])
    const fare = getStopToTerminusFare({
      co: 'kmb',
      route: '83X',
      dir: 'I',
      serviceType: '1',
      stopId: 'BRANCH',
      byVariantStops,
      routeVariantIndex,
    })
    // Seq 2 in the 8492 fare table, not the 1348 table.
    expect(fare).toEqual({ hkd: 6.0, source: 'hk-bus-eta' })
  })

  it('returns null for a stop in no family variant', () => {
    const stops = [routeStop('kmb', '1A', 'O', '1', '1053', 'S1', 1)]
    const byVariantStops = computeKmbRouteVariantStops(stops)
    const entry = routeEntry('kmb', '1A', 'O', '1', '1053', ['S1'], ['8.2'])
    const routeVariantIndex = new Map([
      [
        routeVariantKey({ co: 'kmb', route: '1A', bound: 'O', serviceType: '1', gtfsId: '1053' }),
        entry,
      ],
    ])
    expect(
      getStopToTerminusFare({
        co: 'kmb',
        route: '1A',
        dir: 'O',
        serviceType: '1',
        stopId: 'NOWHERE',
        byVariantStops,
        routeVariantIndex,
      })
    ).toBeNull()
  })
})

describe('computeEtaLeg region handling', () => {
  it('resolves legs without a gtfsId via the stop-aware family fallback', () => {
    const stops = [
      routeStop('kmb', 'C1', 'O', '1', '100', 'LOOP', 1),
      routeStop('kmb', 'C1', 'O', '1', '200', 'LOOP', 1),
      routeStop('kmb', 'C1', 'O', '1', '200', 'LOOP', 9),
    ]
    const byVariantStops = computeKmbRouteVariantStops(stops)
    // LOOP appears twice only in the larger-gtfsId variant; without a
    // gtfsId the leg must come from that variant, not the smallest.
    expect(
      computeEtaLeg({
        co: 'kmb',
        route: 'C1',
        dir: 'O',
        serviceType: '1',
        stopId: 'LOOP',
        etaSeq: 8,
        byVariantStops,
      })
    ).toBe('B')
    expect(
      computeEtaLeg({
        co: 'kmb',
        route: 'C1',
        dir: 'O',
        serviceType: '1',
        stopId: 'LOOP',
        etaSeq: 2,
        byVariantStops,
      })
    ).toBe('A')
  })
})
