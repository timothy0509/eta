import { describe, expect, it } from 'vitest'

import type { Company, RouteListEntry, StopList } from 'hk-bus-eta'

import {
  buildEtaVariantCandidates,
  groupTdPointsByVariant,
  mapTdCompanyToEtaCos,
  matchTdStopPoint,
  matchTdStopPoints,
  parseTdFeatureCollection,
  parseTdOverrideTable,
  summarizeTdMatches,
  tdOverrideKey,
  tdOverrideKeysForPoint,
  type EtaVariantCandidate,
  type TdMatcherContext,
  type TdStopPoint,
} from './td-stop-matcher'

function makeEntry(params: {
  route: string
  co: Company
  bound: 'O' | 'I'
  serviceType: string
  stopIds: string[]
}): RouteListEntry {
  return {
    route: params.route,
    co: [params.co],
    orig: { en: 'Origin', zh: '起點' },
    dest: { en: 'Destination', zh: '終點' },
    fares: null,
    faresHoliday: null,
    freq: null,
    jt: null,
    seq: 1,
    serviceType: params.serviceType,
    stops: { [params.co]: params.stopIds } as unknown as RouteListEntry['stops'],
    bound: { [params.co]: params.bound } as unknown as RouteListEntry['bound'],
    gtfsId: '',
    nlbId: '',
  }
}

function makeStopList(
  entries: Record<string, { lat: number; lng: number; en: string; zh: string }>
): StopList {
  return Object.fromEntries(
    Object.entries(entries).map(([stopId, stop]) => [
      stopId,
      { location: { lat: stop.lat, lng: stop.lng }, name: { en: stop.en, zh: stop.zh } },
    ])
  ) as StopList
}

function makeTdPoint(overrides: Partial<TdStopPoint> = {}): TdStopPoint {
  return {
    companyCode: 'KMB',
    routeName: '1',
    routeId: 1001,
    routeSeq: 1,
    stopSeq: 1,
    tdStopId: 4001,
    lat: 22.34541,
    lng: 114.19264,
    stopNameC: '竹園邨總站',
    stopNameS: '竹園邨总站',
    stopNameE: 'CHUK YUEN ESTATE BUS TERMINUS',
    ...overrides,
  }
}

function route1Context(): { ctx: TdMatcherContext; variants: EtaVariantCandidate[] } {
  const entry = makeEntry({
    route: '1',
    co: 'kmb',
    bound: 'O',
    serviceType: '1',
    stopIds: ['S1', 'S2'],
  })
  const stopList = makeStopList({
    S1: {
      lat: 22.34541,
      lng: 114.19264,
      en: 'CHUK YUEN ESTATE BUS TERMINUS (WT916)',
      zh: '竹園邨總站 (WT916)',
    },
    S2: { lat: 22.34508, lng: 114.19, en: 'WING YUEN HOUSE (WT418)', zh: '榮園樓 (WT418)' },
  })
  const variants = buildEtaVariantCandidates({ 'kmb-1': entry })
  return { ctx: { stopList, variants }, variants }
}

describe('exact coordinate matches', () => {
  it('links a TD point sitting on the eta stop to its variant and 0-indexed seq', () => {
    const { ctx } = route1Context()
    const match = matchTdStopPoint(makeTdPoint(), ctx)
    expect(match.status).toBe('matched')
    if (match.status !== 'matched') return
    expect(match.confidence).toBe('exact')
    expect(match.eta).toMatchObject({
      co: 'kmb',
      route: '1',
      bound: 'O',
      serviceType: '1',
      stopId: 'S1',
      seq: 0,
    })
    expect(match.entry.route).toBe('1')
    expect(match.distanceKm).toBeLessThanOrEqual(0.03)
  })

  it('reports the second stop of a variant as seq 1', () => {
    const { ctx } = route1Context()
    const match = matchTdStopPoint(
      makeTdPoint({ stopSeq: 2, tdStopId: 4002, lat: 22.34508, lng: 114.19 }),
      ctx
    )
    expect(match.status).toBe('matched')
    if (match.status !== 'matched') return
    expect(match.eta.stopId).toBe('S2')
    expect(match.eta.seq).toBe(1)
  })
})

describe('near-coordinate plus name matches', () => {
  it('matches a nearby point when trilingual names agree', () => {
    const { ctx } = route1Context()
    // About 78 m south of S1: past exact range, inside the near ceiling.
    const match = matchTdStopPoint(makeTdPoint({ lat: 22.34541 - 0.0007 }), ctx)
    expect(match.status).toBe('matched')
    if (match.status !== 'matched') return
    expect(match.eta.stopId).toBe('S1')
    expect(match.confidence).toBe('high')
    expect(match.nameMatched).toBe(true)
  })

  it('still matches without a name hit, at lower confidence', () => {
    const { ctx } = route1Context()
    const match = matchTdStopPoint(
      makeTdPoint({
        lat: 22.34541 - 0.0007,
        stopNameC: '某小學',
        stopNameS: '某小学',
        stopNameE: 'SOME SCHOOL',
      }),
      ctx
    )
    expect(match.status).toBe('matched')
    if (match.status !== 'matched') return
    expect(match.eta.stopId).toBe('S1')
    expect(match.confidence).toBe('medium')
    expect(match.nameMatched).toBe(false)
  })
})

describe('unresolved outcomes', () => {
  it('flags equidistant stops as ambiguous instead of picking one', () => {
    const entry = makeEntry({
      route: '9',
      co: 'kmb',
      bound: 'O',
      serviceType: '1',
      stopIds: ['A', 'B'],
    })
    const stopList = makeStopList({
      A: { lat: 22.3, lng: 114.17, en: 'STOP A', zh: '站A' },
      B: { lat: 22.3, lng: 114.17015, en: 'STOP B', zh: '站B' },
    })
    const ctx: TdMatcherContext = {
      stopList,
      variants: buildEtaVariantCandidates({ 'kmb-9': entry }),
    }
    const match = matchTdStopPoint(
      makeTdPoint({
        companyCode: 'KMB',
        routeName: '9',
        routeId: 1009,
        lat: 22.3,
        lng: 114.170075,
        stopNameC: '站A',
        stopNameS: '站A',
        stopNameE: 'STOP A',
      }),
      ctx
    )
    expect(match.status).toBe('unresolved')
    if (match.status !== 'unresolved') return
    expect(match.reason).toBe('ambiguous')
  })

  it('reports distant stops as out of range, never mislinked', () => {
    const { ctx } = route1Context()
    const match = matchTdStopPoint(makeTdPoint({ lat: 22.35, lng: 114.19264 }), ctx)
    expect(match.status).toBe('unresolved')
    if (match.status !== 'unresolved') return
    expect(match.reason).toBe('no-candidate-in-range')
    expect(match.distanceKm).not.toBeNull()
  })

  it('reports unknown routes as having no variant', () => {
    const { ctx } = route1Context()
    const match = matchTdStopPoint(makeTdPoint({ routeName: 'ZZZ' }), ctx)
    expect(match.status).toBe('unresolved')
    if (match.status !== 'unresolved') return
    expect(match.reason).toBe('no-variant')
  })

  it('reports companies without hk-bus-eta coverage as unsupported', () => {
    const { ctx } = route1Context()
    const match = matchTdStopPoint(makeTdPoint({ companyCode: 'XB' }), ctx)
    expect(match.status).toBe('unresolved')
    if (match.status !== 'unresolved') return
    expect(match.reason).toBe('unsupported-company')
  })

  it('matches duplicate entries serving the same physical stop without ambiguity', () => {
    const first = makeEntry({
      route: '69',
      co: 'gmb',
      bound: 'O',
      serviceType: '1',
      stopIds: ['G1', 'G2'],
    })
    const second = makeEntry({
      route: '69',
      co: 'gmb',
      bound: 'O',
      serviceType: '1',
      stopIds: ['G1', 'G3'],
    })
    const stopList = makeStopList({
      G1: { lat: 22.261913, lng: 114.13015, en: 'CYBERPORT PTI', zh: '數碼港交匯處' },
      G2: { lat: 22.27, lng: 114.14, en: 'ELSEWHERE', zh: '別處' },
      G3: { lat: 22.25, lng: 114.12, en: 'OTHER', zh: '另一處' },
    })
    const ctx: TdMatcherContext = {
      stopList,
      variants: buildEtaVariantCandidates({ 'gmb-69-a': first, 'gmb-69-b': second }),
    }
    const match = matchTdStopPoint(
      makeTdPoint({
        companyCode: 'GMB',
        routeName: '69',
        routeId: 2000410,
        lat: 22.261913,
        lng: 114.13015,
        stopNameC: '數碼港公共運輸交匯處',
        stopNameS: '数码港公共运输交汇处',
        stopNameE: 'Cyberport Public Transport Interchange',
      }),
      ctx
    )
    expect(match.status).toBe('matched')
    if (match.status !== 'matched') return
    expect(match.eta.stopId).toBe('G1')
  })
})

describe('company mapping', () => {
  it('maps joint operations to both companies', () => {
    expect(mapTdCompanyToEtaCos('KMB+CTB')).toEqual(['kmb', 'ctb'])
  })

  it('serves Long Win routes under kmb', () => {
    expect(mapTdCompanyToEtaCos('LWB')).toEqual(['kmb'])
    const entry = makeEntry({
      route: 'A41',
      co: 'kmb',
      bound: 'O',
      serviceType: '1',
      stopIds: ['S1'],
    })
    const ctx: TdMatcherContext = {
      stopList: makeStopList({
        S1: { lat: 22.34541, lng: 114.19264, en: 'TERMINUS', zh: '總站' },
      }),
      variants: buildEtaVariantCandidates({ 'kmb-A41': entry }),
    }
    const match = matchTdStopPoint(
      makeTdPoint({ companyCode: 'LWB', routeName: 'A41', routeId: 5001 }),
      ctx
    )
    expect(match.status).toBe('matched')
  })

  it('matches a joint TD point against either operator variant', () => {
    const kmbEntry = makeEntry({
      route: '102P',
      co: 'kmb',
      bound: 'O',
      serviceType: '1',
      stopIds: ['K1'],
    })
    const ctbEntry = makeEntry({
      route: '102P',
      co: 'ctb',
      bound: 'O',
      serviceType: '1',
      stopIds: ['C1'],
    })
    const ctx: TdMatcherContext = {
      stopList: makeStopList({
        K1: { lat: 22.28, lng: 114.22, en: 'SHAU KEI WAN', zh: '筲箕灣' },
        C1: { lat: 22.29, lng: 114.23, en: 'OI YIN STREET', zh: '愛賢街' },
      }),
      variants: buildEtaVariantCandidates({ 'kmb-102P': kmbEntry, 'ctb-102P': ctbEntry }),
    }
    const match = matchTdStopPoint(
      makeTdPoint({
        companyCode: 'KMB+CTB',
        routeName: '102P',
        routeId: 1006,
        lat: 22.29,
        lng: 114.23,
        stopNameC: '愛賢街',
        stopNameS: '爱贤街',
        stopNameE: 'OI YIN STREET',
      }),
      ctx
    )
    expect(match.status).toBe('matched')
    if (match.status !== 'matched') return
    expect(match.eta).toMatchObject({ co: 'ctb', stopId: 'C1' })
  })
})

describe('override table precedence', () => {
  it('prefers the override over the automatic match', () => {
    const { ctx } = route1Context()
    const point = makeTdPoint()
    const auto = matchTdStopPoint(point, ctx)
    expect(auto.status).toBe('matched')
    if (auto.status !== 'matched') return
    expect(auto.eta.stopId).toBe('S1')

    const withOverride: TdMatcherContext = {
      ...ctx,
      overrides: {
        [tdOverrideKey(point)]: {
          type: 'match',
          ref: { co: 'kmb', route: '1', bound: 'O', serviceType: '1', stopId: 'S2', seq: 1 },
        },
      },
    }
    const match = matchTdStopPoint(point, withOverride)
    expect(match.status).toBe('matched')
    if (match.status !== 'matched') return
    expect(match.confidence).toBe('override')
    expect(match.eta).toMatchObject({ stopId: 'S2', seq: 1 })
  })

  it('lets an override force unresolved even when the automatic match hits', () => {
    const { ctx } = route1Context()
    const point = makeTdPoint()
    const match = matchTdStopPoint(point, {
      ...ctx,
      overrides: {
        [tdOverrideKey(point)]: { type: 'unresolved', reason: 'Stops moved in 2026 rebuild.' },
      },
    })
    expect(match.status).toBe('unresolved')
    if (match.status !== 'unresolved') return
    expect(match.reason).toBe('override-forced')
  })

  it('prefers the routeId-specific key over the generic key', () => {
    const { ctx } = route1Context()
    const point = makeTdPoint()
    const specific = `KMB|1|1001|1|1`
    expect(tdOverrideKeysForPoint(point)).toEqual([specific, 'KMB|1|1|1'])
    const match = matchTdStopPoint(point, {
      ...ctx,
      overrides: {
        'KMB|1|1|1': {
          type: 'match',
          ref: { co: 'kmb', route: '1', bound: 'O', serviceType: '1', stopId: 'S1', seq: 0 },
        },
        [specific]: {
          type: 'match',
          ref: { co: 'kmb', route: '1', bound: 'O', serviceType: '1', stopId: 'S2', seq: 1 },
        },
      },
    })
    expect(match.status).toBe('matched')
    if (match.status !== 'matched') return
    expect(match.eta.stopId).toBe('S2')
  })

  it('falls back to the generic key when routeId churns between dataset releases', () => {
    const { ctx } = route1Context()
    const match = matchTdStopPoint(makeTdPoint({ routeId: 9999 }), {
      ...ctx,
      overrides: {
        'KMB|1|1|1': {
          type: 'match',
          ref: { co: 'kmb', route: '1', bound: 'O', serviceType: '1', stopId: 'S2', seq: 1 },
        },
      },
    })
    expect(match.status).toBe('matched')
    if (match.status !== 'matched') return
    expect(match.confidence).toBe('override')
    expect(match.eta.stopId).toBe('S2')
  })

  it('reports a stale override target as unresolved instead of throwing', () => {
    const { ctx } = route1Context()
    const point = makeTdPoint()
    const match = matchTdStopPoint(point, {
      ...ctx,
      overrides: {
        [tdOverrideKey(point)]: {
          type: 'match',
          ref: { co: 'ctb', route: '1', bound: 'O', serviceType: '1', stopId: 'C9', seq: 0 },
        },
      },
    })
    expect(match.status).toBe('unresolved')
    if (match.status !== 'unresolved') return
    expect(match.reason).toBe('stale-override')
  })
})

describe('parsing', () => {
  const feature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [114.192446, 22.345353] },
    properties: {
      routeId: 1001,
      companyCode: 'KMB',
      routeNameC: '1',
      routeNameS: '1',
      routeNameE: '1',
      routeSeq: 1,
      stopSeq: 1,
      stopId: 4001,
      stopNameC: '竹園邨總站',
      stopNameS: '竹园邨总站',
      stopNameE: 'CHUK YUEN ESTATE BUS TERMINUS',
    },
  }

  it('parses a TD FeatureCollection and skips malformed features', () => {
    const points = parseTdFeatureCollection({
      type: 'FeatureCollection',
      features: [feature, { type: 'Feature' }, null, 'nope'],
    })
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({
      companyCode: 'KMB',
      routeName: '1',
      routeId: 1001,
      routeSeq: 1,
      stopSeq: 1,
      tdStopId: 4001,
      lat: 22.345353,
      lng: 114.192446,
      stopNameE: 'CHUK YUEN ESTATE BUS TERMINUS',
    })
  })

  it('returns an empty list for non-collections', () => {
    expect(parseTdFeatureCollection(null)).toEqual([])
    expect(parseTdFeatureCollection({})).toEqual([])
  })

  it('loads a persisted override table and skips invalid entries', () => {
    const table = parseTdOverrideTable({
      'KMB|1|1|1': {
        type: 'match',
        ref: { co: 'kmb', route: '1', bound: 'O', serviceType: '1', stopId: 'S2', seq: 1 },
      },
      'KMB|9|1|4': { type: 'unresolved', reason: 'Demolished stop.' },
      broken: { type: 'match', ref: { co: 'kmb' } },
      nonsense: 42,
    })
    expect(Object.keys(table).sort()).toEqual(['KMB|1|1|1', 'KMB|9|1|4'])
    expect(parseTdOverrideTable(null)).toEqual({})
  })
})

describe('batch matching', () => {
  it('matches a batch in order and summarizes the outcome', () => {
    const { ctx } = route1Context()
    const matches = matchTdStopPoints(
      [
        makeTdPoint(),
        makeTdPoint({ stopSeq: 2, tdStopId: 4002, lat: 22.34508, lng: 114.19 }),
        makeTdPoint({ stopSeq: 9, tdStopId: 4999, lat: 23, lng: 115 }),
      ],
      ctx
    )
    expect(matches.map((match) => match.status)).toEqual(['matched', 'matched', 'unresolved'])
    const summary = summarizeTdMatches(matches)
    expect(summary).toMatchObject({ total: 3, matched: 2, unresolved: 1 })
    expect(summary.byConfidence.exact).toBe(2)
    expect(summary.byReason['no-candidate-in-range']).toBe(1)
  })

  it('groups points by TD route variant', () => {
    const groups = groupTdPointsByVariant([
      makeTdPoint(),
      makeTdPoint({ stopSeq: 2, tdStopId: 4002 }),
      makeTdPoint({ routeSeq: 2, stopSeq: 1, tdStopId: 4025 }),
    ])
    expect(groups.size).toBe(2)
    expect(groups.get('KMB|1|1001|1')).toHaveLength(2)
    expect(groups.get('KMB|1|1001|2')).toHaveLength(1)
  })
})
