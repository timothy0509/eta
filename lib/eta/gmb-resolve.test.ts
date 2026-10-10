import { describe, expect, it } from 'vitest'
import type { Company, RouteListEntry } from 'hk-bus-eta'

import { gmbVariantBaseKey, resolveGmbEtaVariant, resolveGmbStopQueries } from './gmb-resolve'
import type { GmbTdStopPoint } from './direct/gmb-td'

function makeEntry(overrides: {
  route: string
  bound: string
  serviceType?: string
  stops?: string[]
}): RouteListEntry {
  const companies: Company[] = [
    'kmb',
    'nlb',
    'ctb',
    'lrtfeeder',
    'gmb',
    'lightRail',
    'mtr',
    'sunferry',
    'hkkf',
    'fortuneferry',
  ]
  const bound = Object.fromEntries(
    companies.map((co) => [co, 'O'])
  ) as unknown as RouteListEntry['bound']
  bound.gmb = overrides.bound as RouteListEntry['bound'][Company]
  const stops = Object.fromEntries(
    companies.map((co) => [co, []])
  ) as unknown as RouteListEntry['stops']
  stops.gmb = overrides.stops ?? []
  return {
    route: overrides.route,
    co: ['gmb'],
    bound,
    serviceType: overrides.serviceType ?? '1',
    orig: { en: 'A', zh: 'A' },
    dest: { en: 'B', zh: 'B' },
    stops,
    fares: null,
    faresHoliday: null,
    freq: null,
    jt: null,
    seq: 1,
    nlbId: '',
    gtfsId: 'gtfs-1',
  }
}

function tdStop(stopSeq: number): GmbTdStopPoint {
  return {
    routeId: 2000511,
    routeName: { en: '69X', tc: '69X', sc: '69X' },
    routeSeq: 1,
    stopSeq,
    stopId: 20000000 + stopSeq,
    stopPickDrop: 3,
    stopName: { en: `Stop ${stopSeq}`, tc: `站${stopSeq}`, sc: `站${stopSeq}` },
    lat: 22.25,
    lng: 114.12,
  }
}

describe('resolveGmbEtaVariant', () => {
  it('matches by route number and bound from routeSeq', () => {
    const entry = makeEntry({ route: '69X', bound: 'O', stops: ['S1', 'S2'] })
    const other = makeEntry({ route: '69X', bound: 'I', stops: ['S9'] })
    const resolved = resolveGmbEtaVariant({
      routeName: '69x',
      routeSeq: 1,
      tdStopCount: 2,
      indexes: { kmbRouteListEntries: [entry, other] },
    })
    expect(resolved?.entry).toBe(entry)
    expect(resolved?.ambiguous).toBe(false)
  })

  it('returns null when no realtime variant matches', () => {
    const resolved = resolveGmbEtaVariant({
      routeName: '999',
      routeSeq: 1,
      tdStopCount: 5,
      indexes: { kmbRouteListEntries: [makeEntry({ route: '69X', bound: 'O' })] },
    })
    expect(resolved).toBeNull()
  })

  it('prefers the closest stop count and flags ambiguity', () => {
    const near = makeEntry({ route: '69X', bound: 'O', serviceType: '1', stops: ['A', 'B'] })
    const far = makeEntry({
      route: '69X',
      bound: 'O',
      serviceType: '2',
      stops: ['A', 'B', 'C', 'D', 'E', 'F'],
    })
    const resolved = resolveGmbEtaVariant({
      routeName: '69X',
      routeSeq: 1,
      tdStopCount: 2,
      indexes: { kmbRouteListEntries: [far, near] },
    })
    expect(resolved?.entry).toBe(near)
    expect(resolved?.ambiguous).toBe(true)
    expect(resolved?.candidateCount).toBe(2)
  })

  it('falls back to combined OI entries', () => {
    const entry = makeEntry({ route: '69X', bound: 'OI', stops: ['A'] })
    const resolved = resolveGmbEtaVariant({
      routeName: '69X',
      routeSeq: 2,
      tdStopCount: 1,
      indexes: { kmbRouteListEntries: [entry] },
    })
    expect(resolved?.entry).toBe(entry)
  })
})

describe('resolveGmbStopQueries', () => {
  it('maps stops positionally and flags overflow instead of guessing', () => {
    const entry = makeEntry({ route: '69X', bound: 'O', stops: ['ETA1', 'ETA2'] })
    const resolved = resolveGmbEtaVariant({
      routeName: '69X',
      routeSeq: 1,
      tdStopCount: 3,
      indexes: { kmbRouteListEntries: [entry] },
    })
    const queries = resolveGmbStopQueries([tdStop(1), tdStop(2), tdStop(3)], resolved)
    expect(queries[0]).toMatchObject({ etaStopId: 'ETA1', seq: 0, unresolved: false })
    expect(queries[1]).toMatchObject({ etaStopId: 'ETA2', seq: 1, unresolved: false })
    expect(queries[2]).toMatchObject({ etaStopId: null, seq: 2, unresolved: true })
  })

  it('marks every stop unresolved without a realtime variant', () => {
    const queries = resolveGmbStopQueries([tdStop(1)], null)
    expect(queries[0]?.unresolved).toBe(true)
    expect(queries[0]?.etaStopId).toBeNull()
  })

  it('builds the shared variant filter key', () => {
    const entry = makeEntry({ route: '69X', bound: 'O', serviceType: '1' })
    const resolved = resolveGmbEtaVariant({
      routeName: '69X',
      routeSeq: 1,
      tdStopCount: 0,
      indexes: { kmbRouteListEntries: [entry] },
    })
    expect(resolved ? gmbVariantBaseKey({ ...resolved, route: '69x' }) : null).toBe('gmb|69X|O|1')
  })
})
