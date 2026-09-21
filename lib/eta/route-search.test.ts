import { describe, expect, it } from 'vitest'

import type { KmbRouteInfoLite, KmbRouteStopLite } from '@/lib/eta/client'
import type { KmbStopSearchItem } from '@/lib/eta/types'
import {
  buildRouteSearchIndex,
  countRoutesByStopName,
  getKeyStops,
  normalizeRouteQuery,
  operatorCounts,
  resolveKeyStopCount,
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

  it('counts joint-operator routes under every operator', () => {
    const index = buildRouteSearchIndex(routes, routeStops, stopsById)
    const entry = index.find((e) => e.key === 'kmb|1A')
    expect(entry).toBeDefined()
    if (!entry) return
    const joint = [{ ...entry, operators: ['kmb', 'ctb'] }]
    const counts = operatorCounts(joint)
    expect(counts.find((c) => c.code === 'kmb')?.count).toBe(1)
    expect(counts.find((c) => c.code === 'ctb')?.count).toBe(1)
    expect(searchRouteIndex(joint, '', { operator: 'ctb' })).toHaveLength(1)
  })
})

describe('variant termini', () => {
  it('matches termini from non-first variants', () => {
    const variants = [
      makeRoute('kmb', '1A', 'Tsim Sha Tsui', 'Kwun Tong', 'O'),
      makeRoute('kmb', '1A', 'Mong Kok', 'Po Tat', 'O', '2'),
    ]
    const index = buildRouteSearchIndex(variants, [], new Map())
    const hits = searchRouteIndex(index, 'Po Tat')
    expect(hits.map((h) => h.entry.key)).toContain('kmb|1A')
    expect(hits[0]?.matchReason?.kind).toBe('terminus')
  })
})

describe('getKeyStops', () => {
  it('skips termini names', () => {
    const localStops = new Map<string, KmbStopSearchItem>([
      ['s1', makeStop('s1', 'Mong Kok', '旺角')],
      ['s2', makeStop('s2', 'Wong Tai Sin', '黃大仙')],
      ['s3', makeStop('s3', 'Mid Stop', '中站')],
      ['s4', makeStop('s4', 'Other Stop', '他站')],
    ])
    const localRouteStops: KmbRouteStopLite[] = [
      { co: 'kmb', route: '1A', bound: 'O', serviceType: '1', seq: 1, stopId: 's1' },
      { co: 'kmb', route: '1A', bound: 'O', serviceType: '1', seq: 2, stopId: 's3' },
      { co: 'kmb', route: '1A', bound: 'O', serviceType: '1', seq: 3, stopId: 's4' },
      { co: 'kmb', route: '1A', bound: 'O', serviceType: '1', seq: 4, stopId: 's2' },
    ]
    const localRoutes = [
      makeRoute('kmb', '1A', 'Tsim Sha Tsui', 'Kwun Tong', 'O'),
      makeRoute('kmb', '1A', 'Kwun Tong', 'Tsim Sha Tsui', 'I'),
    ]
    const index = buildRouteSearchIndex(localRoutes, localRouteStops, localStops)
    const entry = index.find((e) => e.key === 'kmb|1A')
    expect(entry).toBeDefined()
    if (!entry) return
    const keys = getKeyStops(entry, localStops, 'tc')
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.join(' ')).not.toContain('Kwun Tong繁')
    expect(keys.join(' ')).not.toContain('Mong Kok')
  })

  it('caps at max=1 without NaN', () => {
    const localStops = new Map<string, KmbStopSearchItem>([
      ['s1', makeStop('s1', 'Mong Kok', '旺角')],
      ['s2', makeStop('s2', 'Wong Tai Sin', '黃大仙')],
      ['s3', makeStop('s3', 'Mid Stop', '中站')],
      ['s4', makeStop('s4', 'Other Stop', '他站')],
    ])
    const localRouteStops: KmbRouteStopLite[] = [
      { co: 'kmb', route: '1A', bound: 'O', serviceType: '1', seq: 1, stopId: 's1' },
      { co: 'kmb', route: '1A', bound: 'O', serviceType: '1', seq: 2, stopId: 's3' },
      { co: 'kmb', route: '1A', bound: 'O', serviceType: '1', seq: 3, stopId: 's4' },
      { co: 'kmb', route: '1A', bound: 'O', serviceType: '1', seq: 4, stopId: 's2' },
    ]
    const localRoutes = [
      makeRoute('kmb', '1A', 'Tsim Sha Tsui', 'Kwun Tong', 'O'),
      makeRoute('kmb', '1A', 'Kwun Tong', 'Tsim Sha Tsui', 'I'),
    ]
    const index = buildRouteSearchIndex(localRoutes, localRouteStops, localStops)
    const entry = index.find((e) => e.key === 'kmb|1A')
    expect(entry).toBeDefined()
    if (!entry) return
    expect(getKeyStops(entry, localStops, 'tc', 1)).toHaveLength(1)
  })

  it('never shows the first or last stop', () => {
    const stops = new Map<string, KmbStopSearchItem>([
      ['a', makeStop('a', 'Stop A')],
      ['b', makeStop('b', 'Stop B')],
      ['c', makeStop('c', 'Stop C')],
    ])
    const variants = [makeRoute('kmb', 'X1', 'Stop A', 'Stop C', 'O')]
    const localRouteStops: KmbRouteStopLite[] = [
      { co: 'kmb', route: 'X1', bound: 'O', serviceType: '1', seq: 1, stopId: 'a' },
      { co: 'kmb', route: 'X1', bound: 'O', serviceType: '1', seq: 2, stopId: 'b' },
      { co: 'kmb', route: 'X1', bound: 'O', serviceType: '1', seq: 3, stopId: 'c' },
    ]
    const index = buildRouteSearchIndex(variants, localRouteStops, stops)
    const entry = index.find((e) => e.key === 'kmb|X1')
    expect(entry).toBeDefined()
    if (!entry) return
    expect(getKeyStops(entry, stops, 'tc')).toEqual(['Stop B'])
  })

  it('prefers the busy stop in a 5-stop route', () => {
    const names = ['Stop A', 'Stop B', 'Stop C', 'Stop D', 'Stop E']
    const stops = new Map<string, KmbStopSearchItem>(
      names.map((n, i) => [`s${i}`, makeStop(`s${i}`, n)])
    )
    const variants = [makeRoute('kmb', 'X2', 'Stop A', 'Stop E', 'O')]
    const localRouteStops: KmbRouteStopLite[] = names.map((_, i) => ({
      co: 'kmb',
      route: 'X2',
      bound: 'O',
      serviceType: '1',
      seq: i + 1,
      stopId: `s${i}`,
    }))
    // Extra routes through s3 (Stop D) so it counts as the busy group.
    const extraRoutes: KmbRouteStopLite[] = [1, 2, 3].map((n) => ({
      co: 'kmb',
      route: `B${n}`,
      bound: 'O',
      serviceType: '1',
      seq: 1,
      stopId: 's3',
    }))
    const index = buildRouteSearchIndex(variants, localRouteStops, stops)
    const entry = index.find((e) => e.key === 'kmb|X2')
    expect(entry).toBeDefined()
    if (!entry) return
    const usage = countRoutesByStopName([...localRouteStops, ...extraRoutes], stops, 'tc')
    expect(getKeyStops(entry, stops, 'tc', 7, usage)).toEqual(['Stop D'])
  })

  it('scales the via count with route length', () => {
    expect(resolveKeyStopCount(2)).toBe(0)
    expect(resolveKeyStopCount(4)).toBe(1)
    expect(resolveKeyStopCount(10)).toBe(2)
    expect(resolveKeyStopCount(18)).toBe(3)
    expect(resolveKeyStopCount(28)).toBe(4)
    expect(resolveKeyStopCount(40)).toBe(5)
    expect(resolveKeyStopCount(60)).toBe(6)
    expect(resolveKeyStopCount(80)).toBe(7)
  })

  it('spreads picks across a long route', () => {
    const total = 30
    const stops = new Map<string, KmbStopSearchItem>()
    for (let i = 0; i < total; i += 1) stops.set(`s${i}`, makeStop(`s${i}`, `Stop ${i}`))
    const variants = [makeRoute('kmb', 'X3', 'Stop 0', `Stop ${total - 1}`, 'O')]
    const localRouteStops: KmbRouteStopLite[] = Array.from({ length: total }, (_, i) => ({
      co: 'kmb',
      route: 'X3',
      bound: 'O',
      serviceType: '1',
      seq: i + 1,
      stopId: `s${i}`,
    }))
    const index = buildRouteSearchIndex(variants, localRouteStops, stops)
    const entry = index.find((e) => e.key === 'kmb|X3')
    expect(entry).toBeDefined()
    if (!entry) return
    const keys = getKeyStops(entry, stops, 'tc')
    expect(keys.length).toBeGreaterThan(1)
    const positions = keys.map((name) => Number(name.replace('Stop ', '')))
    expect(Math.min(...positions)).toBeGreaterThan(0)
    expect(Math.max(...positions)).toBeLessThan(total - 1)
    for (let i = 1; i < positions.length; i += 1) {
      expect((positions[i] ?? 0) - (positions[i - 1] ?? 0)).toBeGreaterThan(1)
    }
  })
})
