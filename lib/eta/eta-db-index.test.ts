import { describe, expect, it } from 'vitest'

import type { Company, EtaDb } from 'hk-bus-eta'

import {
  assignRouteRegions,
  buildEtaDbIndexes,
  computeRouteRegions,
  deserializeEtaDbIndexes,
  groupRegionStops,
  routeVariantKey,
  serializeEtaDbIndexes,
  variantKeyMatches,
} from './eta-db-index'

function routeEntry(route: string, co: Company[], stopsByCo: Partial<Record<Company, string[]>>) {
  const stops = {} as Record<Company, string[]>
  const bound = {} as Record<Company, 'O'>
  for (const c of co) {
    stops[c] = stopsByCo[c] ?? []
    bound[c] = 'O'
  }
  return {
    route,
    co,
    orig: { en: 'Origin', zh: '起點' },
    dest: { en: 'Destination', zh: '終點' },
    fares: null,
    faresHoliday: null,
    freq: null,
    jt: null,
    seq: 1,
    serviceType: '1',
    stops,
    bound,
    gtfsId: '',
    nlbId: '',
  }
}
function dbWith(entries: Array<ReturnType<typeof routeEntry>>, stopIds: string[]): EtaDb {
  const routeList: EtaDb['routeList'] = {}
  for (const [index, entry] of entries.entries()) {
    routeList[`${entry.route}-${entry.co.join('+')}-${entry.gtfsId}-${index}`] =
      entry as unknown as EtaDb['routeList'][string]
  }
  const stopList: EtaDb['stopList'] = {}
  for (const stopId of stopIds) {
    stopList[stopId] = {
      location: { lat: 22.3, lng: 114.2 },
      name: { en: `Stop ${stopId}`, zh: `站 ${stopId}` },
    }
  }
  return { holidays: [], routeList, stopList, stopMap: {}, serviceDayMap: {} } as unknown as EtaDb
}

describe('buildEtaDbIndexes isKmb derivation', () => {
  it('marks a KMB-only stop as KMB', async () => {
    const db = dbWith([routeEntry('1', ['kmb'], { kmb: ['S1'] })], ['S1'])
    const indexes = await buildEtaDbIndexes(db, { busCompanies: ['kmb', 'ctb'] })
    expect(indexes.kmbStops).toMatchObject([{ stopId: 'S1', isKmb: true }])
  })

  it('marks a CTB-only stop as non-KMB', async () => {
    const db = dbWith([routeEntry('1', ['ctb'], { ctb: ['S2'] })], ['S2'])
    const indexes = await buildEtaDbIndexes(db, { busCompanies: ['kmb', 'ctb'] })
    expect(indexes.kmbStops).toMatchObject([{ stopId: 'S2', isKmb: false }])
  })

  it('marks a joint KMB plus CTB stop as KMB', async () => {
    const db = dbWith(
      [routeEntry('1', ['kmb'], { kmb: ['S3'] }), routeEntry('1', ['ctb'], { ctb: ['S3'] })],
      ['S3']
    )
    const indexes = await buildEtaDbIndexes(db, { busCompanies: ['kmb', 'ctb'] })
    expect(indexes.kmbStops).toMatchObject([{ stopId: 'S3', isKmb: true }])
  })

  it('preserves isKmb through a serialize and deserialize round-trip', async () => {
    const db = dbWith(
      [routeEntry('1', ['kmb'], { kmb: ['S3'] }), routeEntry('1', ['ctb'], { ctb: ['S3'] })],
      ['S3']
    )
    const indexes = await buildEtaDbIndexes(db, { busCompanies: ['kmb', 'ctb'] })
    const roundTripped = deserializeEtaDbIndexes(serializeEtaDbIndexes(indexes))
    expect(roundTripped.kmbStops).toEqual(indexes.kmbStops)
    expect(roundTripped.kmbStops).toMatchObject([{ stopId: 'S3', isKmb: true }])
    expect(
      roundTripped.stopRoutesIndex
        .get('S3')
        ?.map((e) => e.co)
        .sort()
    ).toEqual(['ctb', 'kmb'])
  })
})

describe('groupRegionStops', () => {
  it('splits disjoint gtfsIds into separate regions', () => {
    const groups = groupRegionStops(
      new Map([
        ['2006408', new Set(['A', 'B'])],
        ['2002337', new Set(['C', 'D'])],
      ])
    )
    expect(groups).toEqual([['2002337'], ['2006408']])
  })

  it('merges gtfsIds sharing a stop (branches and short workings)', () => {
    const groups = groupRegionStops(
      new Map([
        ['2004764', new Set(['A', 'B', 'C'])],
        ['2004763', new Set(['C', 'D'])],
      ])
    )
    expect(groups).toEqual([['2004763', '2004764']])
  })

  it('merges transitively through a shared middle node', () => {
    const groups = groupRegionStops(
      new Map([
        ['1', new Set(['A'])],
        ['2', new Set(['A', 'B'])],
        ['3', new Set(['B'])],
      ])
    )
    expect(groups).toEqual([['1', '2', '3']])
  })

  it('ignores empty stop sets (legacy rows with no stops)', () => {
    const groups = groupRegionStops(
      new Map([
        ['', new Set()],
        ['5', new Set(['A'])],
      ])
    )
    expect(groups).toEqual([['5'], ['']])
  })
})

describe('assignRouteRegions', () => {
  it('labels HKI vs Kowloon GMB 1 as region 1 and 2 in gtfsId order', () => {
    const regions = assignRouteRegions(
      new Map([
        ['2006408', new Set(['A'])],
        ['2002337', new Set(['B'])],
      ]),
      { co: 'gmb', route: '1' }
    )
    expect(regions.get('2002337')).toBe('gmb|1|1')
    expect(regions.get('2006408')).toBe('gmb|1|2')
  })

  it('gives every member of a merged family the same region', () => {
    const regions = assignRouteRegions(
      new Map([
        ['2004764', new Set(['A', 'B'])],
        ['2004763', new Set(['B', 'C'])],
      ]),
      { co: 'gmb', route: '12' }
    )
    expect(regions.get('2004764')).toBe('gmb|12|1')
    expect(regions.get('2004763')).toBe('gmb|12|1')
  })
})

describe('computeRouteRegions', () => {
  it('splits same-number routes with disjoint stops', () => {
    const regions = computeRouteRegions([
      { co: 'gmb', route: '1', stopId: 'A', gtfsId: '2006408' },
      { co: 'gmb', route: '1', stopId: 'B', gtfsId: '2002337' },
    ])
    const family = regions.get('gmb|1')
    expect(family?.get('2006408')).toBe('gmb|1|2')
    expect(family?.get('2002337')).toBe('gmb|1|1')
  })
})

describe('buildEtaDbIndexes regions', () => {
  function gmbEntry(route: string, gtfsId: string, stops: string[]) {
    const entry = routeEntry(route, ['gmb'], { gmb: stops })
    entry.gtfsId = gtfsId
    return entry
  }

  it('keys same-number GMB routes by gtfsId and labels regions', async () => {
    const db = dbWith(
      [gmbEntry('1', '2006408', ['HKI1', 'HKI2']), gmbEntry('1', '2002337', ['KLN1', 'KLN2'])],
      ['HKI1', 'HKI2', 'KLN1', 'KLN2']
    )
    const indexes = await buildEtaDbIndexes(db, { busCompanies: ['gmb'] })
    expect(indexes.routeVariantIndex.get('gmb|1|O|1|2006408')).toBeDefined()
    expect(indexes.routeVariantIndex.get('gmb|1|O|1|2002337')).toBeDefined()
    expect(indexes.stopRoutesIndex.get('HKI1')).toMatchObject([
      { gtfsId: '2006408', region: 'gmb|1|2' },
    ])
    expect(indexes.stopRoutesIndex.get('KLN1')).toMatchObject([
      { gtfsId: '2002337', region: 'gmb|1|1' },
    ])
    expect(indexes.kmbRouteStops).toMatchObject([
      { stopId: 'HKI1', gtfsId: '2006408', region: 'gmb|1|2' },
      { stopId: 'HKI2', gtfsId: '2006408', region: 'gmb|1|2' },
      { stopId: 'KLN1', gtfsId: '2002337', region: 'gmb|1|1' },
      { stopId: 'KLN2', gtfsId: '2002337', region: 'gmb|1|1' },
    ])
    // Precomputed maps survive serialization for cached indexes.
    const roundTripped = deserializeEtaDbIndexes(serializeEtaDbIndexes(indexes))
    expect(roundTripped.regionIndex.get('gmb|1')?.get('2006408')).toBe('gmb|1|2')
    expect(roundTripped.regionByVariantKey.get('gmb|1|O|1|2002337')).toBe('gmb|1|1')
  })

  it('builds distinct variant keys via routeVariantKey', () => {
    expect(routeVariantKey({ co: 'gmb', route: '1', bound: 'O', serviceType: '1' })).toBe(
      'gmb|1|O|1|'
    )
    expect(
      routeVariantKey({ co: 'gmb', route: '1', bound: 'O', serviceType: '1', gtfsId: '2006408' })
    ).toBe('gmb|1|O|1|2006408')
  })

  it('deserializes blobs written before region fields existed', () => {
    const legacy = {
      kmbRouteListEntries: [],
      kmbStops: [],
      kmbRouteStops: [],
      mtrRoutes: [],
      lrtRoutes: [],
      stationToRouteIndex: [],
      routeStopSeqIndex: [],
      stopRoutesIndex: [],
      routeVariantIndex: [],
    } as unknown as Parameters<typeof deserializeEtaDbIndexes>[0]
    const indexes = deserializeEtaDbIndexes(legacy)
    expect(indexes.regionIndex).toEqual(new Map())
    expect(indexes.regionByVariantKey).toEqual(new Map())
  })

  it('resolves legacy lookups deterministically to the smallest gtfsId', async () => {
    const db = dbWith(
      [gmbEntry('1', '2006408', ['HKI1']), gmbEntry('1', '2002337', ['KLN1'])],
      ['HKI1', 'KLN1']
    )
    const indexes = await buildEtaDbIndexes(db, { busCompanies: ['gmb'] })
    const { findRouteEntryByFamily } = await import('./eta-db-index')
    const entry = findRouteEntryByFamily(indexes.routeVariantIndex, {
      co: 'gmb',
      route: '1',
      bound: 'O',
      serviceType: '1',
    })
    expect(entry?.gtfsId).toBe('2002337')
  })
})

describe('variantKeyMatches', () => {
  it('matches a KMB filter with gtfsId against an official ETA without gtfsId', () => {
    expect(variantKeyMatches('kmb|1A|O|1|1053', 'kmb|1A|O|1|')).toBe(true)
  })

  it('matches a legacy empty-gtfsId filter against an indexed entry with gtfsId', () => {
    expect(variantKeyMatches('kmb|1A|O|1|', 'kmb|1A|O|1|1053')).toBe(true)
  })

  it('keeps different GMB regions separate', () => {
    expect(variantKeyMatches('gmb|1|O|1|2006408', 'gmb|1|O|1|2002337')).toBe(false)
  })

  it('matches exact keys and legacy 4-part family keys', () => {
    expect(variantKeyMatches('gmb|1|O|1|2006408', 'gmb|1|O|1|2006408')).toBe(true)
    expect(variantKeyMatches('kmb|1|O|1', 'kmb|1|O|1|1053')).toBe(true)
  })

  it('rejects different bounds within the same family', () => {
    expect(variantKeyMatches('kmb|1A|O|1|1053', 'kmb|1A|I|1|')).toBe(false)
  })
})
