import { describe, expect, it } from 'vitest'

import {
  extractGmbRoutes,
  extractGmbStops,
  filterGmbRoutes,
  gmbDetailUrl,
  parseGmbCutoffDate,
  parseGmbRouteListFile,
  sortGmbRoutes,
  type GmbRouteEntry,
} from './gmb'

function entry(overrides: Partial<GmbRouteEntry> = {}): GmbRouteEntry {
  return {
    routeId: 2000410,
    district: 'HKI',
    name: { en: '69', tc: '69', sc: '69' },
    serviceMode: 'T',
    specialType: 1,
    journeyTime: 54,
    origin: { en: 'Cyberport', tc: '數碼港', sc: '数码港' },
    destination: {
      en: 'Quarry Bay (Shipyard Lane) (Circular)',
      tc: '鰂魚涌(船塢里)(循環線)',
      sc: '鲗鱼涌(船坞里)(循环线)',
    },
    fullFare: 14.5,
    lastUpdateDate: '2026-09-27T00:00:00',
    stopCount: 42,
    ...overrides,
  }
}

function feature(routeId: number, seq: number, props: Record<string, unknown> = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [114.1, 22.2] },
    properties: {
      routeId,
      companyCode: 'GMB',
      district: 'HKI',
      routeNameC: '69',
      routeNameS: '69',
      routeNameE: '69',
      routeType: 2,
      serviceMode: 'T',
      specialType: 1,
      journeyTime: 54,
      locStartNameC: '數碼港',
      locStartNameS: '数码港',
      locStartNameE: 'Cyberport',
      locEndNameC: '鰂魚涌(船塢里)(循環線)',
      locEndNameS: '鲗鱼涌(船坞里)(循环线)',
      locEndNameE: 'Quarry Bay (Shipyard Lane) (Circular)',
      hyperlinkC: 'https://example.invalid/tc',
      hyperlinkS: 'https://example.invalid/sc',
      hyperlinkE: 'https://example.invalid/en',
      fullFare: 14.5,
      lastUpdateDate: '2026-09-27T00:00:00',
      routeSeq: seq,
      stopSeq: 1,
      stopId: 20003337,
      ...props,
    },
  }
}

describe('extractGmbRoutes', () => {
  it('returns one entry per route id with a stop count', () => {
    const routes = extractGmbRoutes({
      type: 'FeatureCollection',
      features: [feature(2000410, 1), feature(2000410, 1), feature(2000511, 1)],
    })
    expect(routes).toHaveLength(2)
    const first = routes.find((r) => r.routeId === 2000410)
    expect(first?.stopCount).toBe(2)
    expect(first?.origin.en).toBe('Cyberport')
    expect(first?.destination.tc).toBe('鰂魚涌(船塢里)(循環線)')
    expect(first?.fullFare).toBe(14.5)
  })

  it('skips malformed features without throwing', () => {
    expect(extractGmbRoutes(null)).toEqual([])
    expect(
      extractGmbRoutes({ features: [null, { properties: null }, { properties: {} }] })
    ).toEqual([])
    expect(extractGmbRoutes({ features: [feature(1, 1, { district: 'XX' })] })).toEqual([])
  })
})

describe('extractGmbStops', () => {
  const stopProps = (overrides: Record<string, unknown> = {}) => ({
    stopPickDrop: 3,
    stopNameC: '第一站',
    stopNameS: '第一站',
    stopNameE: 'First',
    ...overrides,
  })

  it('groups stops by route id and routeSeq in stopSeq order', () => {
    const routes = extractGmbStops({
      type: 'FeatureCollection',
      features: [
        feature(2000410, 1, stopProps({ stopSeq: 2, stopId: 20007719 })),
        feature(2000410, 1, stopProps({ stopSeq: 1, stopId: 20003337 })),
        feature(2000410, 2, stopProps({ stopSeq: 1, stopId: 20009999 })),
      ],
    })
    expect(routes).toHaveLength(1)
    expect(routes[0]?.v.map((v) => v.q)).toEqual([1, 2])
    expect(routes[0]?.v[0]?.s.map((s) => s[0])).toEqual([1, 2])
    expect(routes[0]?.v[0]?.s[0]).toEqual([
      1,
      20003337,
      3,
      22.2,
      114.1,
      'First',
      '第一站',
      '第一站',
    ])
    expect(routes[0]?.n).toEqual(['69', '69', '69'])
    expect(routes[0]?.v[0]?.o).toEqual(['Cyberport', '數碼港', '数码港'])
  })

  it('skips malformed features without throwing', () => {
    expect(extractGmbStops(null)).toEqual([])
    expect(
      extractGmbStops({
        features: [
          null,
          { properties: null },
          feature(1, 1, stopProps({ routeSeq: 9 })),
          feature(1, 1, stopProps({ stopPickDrop: 9 })),
          feature(1, 1, { ...stopProps(), stopId: null }),
        ],
      })
    ).toEqual([])
  })
})

describe('sortGmbRoutes', () => {
  it('orders route numbers numerically', () => {
    const routes = [
      entry({ routeId: 3, name: { en: '101', tc: '101', sc: '101' } }),
      entry({ routeId: 1, name: { en: '9', tc: '9', sc: '9' } }),
      entry({ routeId: 2, name: { en: '40A', tc: '40A', sc: '40A' } }),
    ]
    expect(sortGmbRoutes(routes).map((r) => r.name.en)).toEqual(['9', '40A', '101'])
  })
})

describe('filterGmbRoutes', () => {
  const routes = [
    entry({ routeId: 1, district: 'HKI' }),
    entry({
      routeId: 2,
      district: 'NT',
      name: { en: '40A', tc: '40A', sc: '40A' },
      origin: { en: 'Tsz Lun Road', tc: '紫麟路', sc: '紫麟路' },
      destination: {
        en: 'Tuen Mun Town Centre',
        tc: '屯門市中心',
        sc: '屯门市中心',
      },
    }),
  ]

  it('matches route numbers case-insensitively', () => {
    expect(filterGmbRoutes(routes, { query: '40a' })).toHaveLength(1)
  })

  it('matches termini in any language', () => {
    expect(filterGmbRoutes(routes, { query: '屯門' })).toHaveLength(1)
    expect(filterGmbRoutes(routes, { query: 'tuen mun' })).toHaveLength(1)
    expect(filterGmbRoutes(routes, { query: 'Cyberport' })).toHaveLength(1)
  })

  it('filters by district', () => {
    expect(filterGmbRoutes(routes, { district: 'NT' })).toHaveLength(1)
    expect(filterGmbRoutes(routes, { district: 'all', query: '' })).toHaveLength(2)
  })
})

describe('gmbDetailUrl', () => {
  it('picks the TD language variant per UI language', () => {
    expect(gmbDetailUrl(2000410, 'tc')).toContain('lang=TC&route_id=2000410')
    expect(gmbDetailUrl(2000410, 'sc')).toContain('lang=SC&route_id=2000410')
    expect(gmbDetailUrl(2000410, 'en')).toContain('lang=EN&route_id=2000410')
  })
})

describe('parseGmbRouteListFile', () => {
  it('accepts a well-formed file', () => {
    const parsed = parseGmbRouteListFile({
      meta: { source: 's', dataset: 'd', cutoffDate: '2026-09-30', generatedAt: 'g', count: 1 },
      routes: [entry()],
    })
    expect(parsed.routes).toHaveLength(1)
    expect(parsed.meta.cutoffDate).toBe('2026-09-30')
  })

  it('rejects malformed files', () => {
    expect(() => parseGmbRouteListFile(null)).toThrow()
    expect(() => parseGmbRouteListFile({ meta: {}, routes: [] })).toThrow()
    expect(() =>
      parseGmbRouteListFile({
        meta: { source: 's', dataset: 'd', cutoffDate: 'c', generatedAt: 'g', count: 1 },
        routes: [{ routeId: 'nope' }],
      })
    ).toThrow()
  })
})

describe('parseGmbCutoffDate', () => {
  it('reads the date line past the BOM header', () => {
    const csv = '﻿數據修正截止日期 / 数据修正截止日期 / Data revision cut-off date\r\n2026-09-30'
    expect(parseGmbCutoffDate(csv)).toBe('2026-09-30')
  })

  it('returns null for unrecognized content', () => {
    expect(parseGmbCutoffDate('no dates here')).toBeNull()
    expect(parseGmbCutoffDate(null)).toBeNull()
  })
})
