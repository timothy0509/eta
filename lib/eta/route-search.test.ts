import { describe, expect, it } from 'vitest'

import type { KmbRouteInfoLite, KmbRouteStopLite } from '@/lib/eta/client'
import type { KmbStopSearchItem } from '@/lib/eta/types'
import {
  buildRouteSearchIndex,
  getKeyStops,
  normalizeRouteQuery,
  operatorCounts,
  searchRouteIndex,
} from '@/lib/eta/route-search'

function makeRoute(
  co: string,
  route: string,
  origin: string,
  dest: string,
  bound = 'O',
  serviceType = '1'
): KmbRouteInfoLite {
  return {
    co: co as 'kmb',
    route,
    bound,
    serviceType,
    origin: { en: origin, tc: `${origin}繁`, sc: `${origin}简` },
    destination: { en: dest, tc: `${dest}繁`, sc: `${dest}简` },
  }
}

function makeStop(stopId: string, en: string, tc = '', sc = ''): KmbStopSearchItem {
  return { stopId, nameEn: en, nameTc: tc || en, nameSc: sc || en, lat: 22, lng: 114, isKmb: true }
}

const routes = [
  makeRoute('kmb', '1A', 'Tsim Sha Tsui', 'Kwun Tong', 'O'),
  makeRoute('kmb', '1A', 'Kwun Tong', 'Tsim Sha Tsui', 'I'),
  makeRoute('kmb', '1', 'Chuk Yuen Estate', 'Tsim Sha Tsui', 'O'),
  makeRoute('ctb', '1', 'Happy Valley', 'Central', 'O'),
  makeRoute('kmb', '13M', 'Kwun Tong', 'Po Tat', 'O'),
]

const stopsById = new Map<string, KmbStopSearchItem>([
  ['s1', makeStop('s1', 'Mong Kok', '旺角')],
  ['s2', makeStop('s2', 'Wong Tai Sin', '黃大仙')],
  ['s3', makeStop('s3', 'Ngau Tau Kok', '牛頭角')],
])

const routeStops: KmbRouteStopLite[] = [
  { co: 'kmb', route: '1A', bound: 'O', serviceType: '1', seq: 1, stopId: 's1' },
  { co: 'kmb', route: '1A', bound: 'O', serviceType: '1', seq: 2, stopId: 's2' },
  { co: 'kmb', route: '13M', bound: 'O', serviceType: '1', seq: 1, stopId: 's3' },
]

describe('normalizeRouteQuery', () => {
  it('strips inner spaces for number compare', () => {
    expect(normalizeRouteQuery('1 A').number).toBe('1A')
    expect(normalizeRouteQuery('  13m ').upper).toBe('13M')
  })
})

describe('buildRouteSearchIndex', () => {
  it('dedupes variants into one entry per co|route', () => {
    const index = buildRouteSearchIndex(routes, routeStops, stopsById)
    const keys = index.map((e) => e.key)
    expect(keys).toContain('kmb|1A')
    expect(keys).toContain('kmb|1')
    expect(keys).toContain('ctb|1')
    expect(keys.filter((k) => k === 'kmb|1A')).toHaveLength(1)
    const entry = index.find((e) => e.key === 'kmb|1A')
    expect(entry?.variantCount).toBe(2)
    expect(entry?.directions).toEqual(expect.arrayContaining(['O', 'I']))
  })

  it('sorts empty results numerically', () => {
    const index = buildRouteSearchIndex(routes, routeStops, stopsById)
    expect(index.map((e) => `${e.co}:${e.route}`).slice(0, 2)).toEqual(['ctb:1', 'kmb:1'])
  })
})

describe('searchRouteIndex', () => {
  const index = buildRouteSearchIndex(routes, routeStops, stopsById)

  it('ranks exact number first (1A over 13M for "1A")', () => {
    const hits = searchRouteIndex(index, '1A')
    expect(hits[0]?.entry.route).toBe('1A')
    expect(hits[0]?.entry.key).toBe('kmb|1A')
  })

  it('treats "1 A" like "1A"', () => {
    const hits = searchRouteIndex(index, '1 A')
    expect(hits[0]?.entry.route).toBe('1A')
  })

  it('ranks number prefix before terminus includes', () => {
    const hits = searchRouteIndex(index, '1')
    const routesFound = hits.map((h) => h.entry.key)
    expect(routesFound.slice(0, 3)).toContain('kmb|1')
    expect(routesFound.slice(0, 3)).toContain('ctb|1')
  })

  it('matches terminus in English', () => {
    const hits = searchRouteIndex(index, 'Kwun Tong')
    expect(hits.map((h) => h.entry.key)).toContain('kmb|1A')
    expect(hits[0]?.matchReason?.kind).toBe('terminus')
  })

  it('matches terminus in Traditional Chinese', () => {
    const hits = searchRouteIndex(index, 'Kwun Tong繁')
    expect(hits.map((h) => h.entry.key)).toContain('kmb|1A')
  })

  it('matches mid-route stop names', () => {
    const hits = searchRouteIndex(index, 'Mong Kok')
    expect(hits.map((h) => h.entry.key)).toContain('kmb|1A')
    const hit = hits.find((h) => h.entry.key === 'kmb|1A')
    expect(hit?.matchReason?.kind).toBe('stop')
  })

  it('matches stop names in Chinese', () => {
    const hits = searchRouteIndex(index, '旺角')
    expect(hits.map((h) => h.entry.key)).toContain('kmb|1A')
  })

  it('filters by operator', () => {
    const hits = searchRouteIndex(index, '1', { operator: 'ctb' })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.entry.operators.includes('ctb'))).toBe(true)
  })

  it('returns empty for nonsense', () => {
    expect(searchRouteIndex(index, 'zzz-no-such-place')).toHaveLength(0)
  })
})

describe('operatorCounts', () => {
  it('counts entries per primary operator', () => {
    const index = buildRouteSearchIndex(routes, routeStops, stopsById)
    const counts = operatorCounts(index)
    expect(counts.find((c) => c.code === 'kmb')?.count).toBe(3)
    expect(counts.find((c) => c.code === 'ctb')?.count).toBe(1)
  })
})

describe('getKeyStops', () => {
  it('skips termini names', () => {
    const index = buildRouteSearchIndex(routes, routeStops, stopsById)
    const entry = index.find((e) => e.key === 'kmb|1A')
    expect(entry).toBeDefined()
    if (!entry) return
    const keys = getKeyStops(entry, stopsById, 'tc')
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.join(' ')).not.toContain('Kwun Tong繁')
  })
})
