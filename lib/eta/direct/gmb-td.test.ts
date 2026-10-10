import { describe, expect, it } from 'vitest'

import { gmbPickDropKey, gmbRouteSeqToBound, parseGmbStopsFile } from './gmb-td'

function stop(
  overrides: Partial<{
    seq: number
    id: number
    pickDrop: number
    lat: number
    lng: number
    en: string
    tc: string
    sc: string
  }> = {}
): unknown {
  const {
    seq = 1,
    id = 20003337,
    pickDrop = 3,
    lat = 22.25,
    lng = 114.12,
    en = 'First',
    tc = '第一站',
    sc = '第一站',
  } = overrides
  return [seq, id, pickDrop, lat, lng, en, tc, sc]
}

function variant(routeSeq: number, stops: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    q: routeSeq,
    d: 'HKI',
    m: 'R',
    o: ['Cyberport', '數碼港', '数码港'],
    e: ['Causeway Bay', '銅鑼灣', '铜锣湾'],
    j: 20,
    f: 12.5,
    u: '2026-09-28T00:00:00',
    s: stops,
    ...overrides,
  }
}

function file(routes: unknown[]) {
  return {
    meta: {
      source: 's',
      dataset: 'd',
      cutoffDate: '2026-09-30',
      generatedAt: 'g',
      count: routes.length,
    },
    routes,
  }
}

function route(routeId: number, variants: unknown[]) {
  return { i: routeId, n: ['69X', '69X', '69X'], v: variants }
}

describe('parseGmbStopsFile', () => {
  it('splits routeSeq legs and orders stops by stopSeq', () => {
    const groups = parseGmbStopsFile(
      file([
        route(2000511, [
          variant(1, [stop({ seq: 2, id: 20007719, en: 'Second' }), stop({ seq: 1, en: 'First' })]),
          variant(2, [stop({ seq: 1, id: 20009999, en: 'Back' })]),
        ]),
      ])
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.routeId).toBe(2000511)
    expect(groups[0]?.variants).toHaveLength(2)
    const outbound = groups[0]?.variants[0]
    expect(outbound?.routeSeq).toBe(1)
    expect(outbound?.stops.map((s) => s.stopSeq)).toEqual([1, 2])
    expect(outbound?.origin.en).toBe('Cyberport')
    expect(outbound?.fullFare).toBe(12.5)
    const inbound = groups[0]?.variants[1]
    expect(inbound?.routeSeq).toBe(2)
    expect(inbound?.stops).toHaveLength(1)
  })

  it('maps stop tuples onto stop points with trilingual names', () => {
    const groups = parseGmbStopsFile(file([route(2000511, [variant(1, [stop()])])]))
    const point = groups[0]?.variants[0]?.stops[0]
    expect(point).toMatchObject({
      routeId: 2000511,
      routeSeq: 1,
      stopSeq: 1,
      stopId: 20003337,
      stopPickDrop: 3,
      lat: 22.25,
      lng: 114.12,
    })
    expect(point?.routeName).toEqual({ en: '69X', tc: '69X', sc: '69X' })
    expect(point?.stopName).toEqual({ en: 'First', tc: '第一站', sc: '第一站' })
  })

  it('skips malformed entries without failing the whole file', () => {
    const groups = parseGmbStopsFile(
      file([
        route(2000511, [
          variant(1, [
            stop(),
            // Bad coordinates, bad pickDrop and truncated tuples are skipped.
            [2, 20007719, 3, null, 114.13, 'Bad', '壞', '坏'],
            [3, 20008888, 9, 22.26, 114.14, 'Bad', '壞', '坏'],
            ['x'],
          ]),
          // Unknown routeSeq legs are skipped.
          variant(9, [stop({ seq: 1, id: 1 })]),
          // Variants with no usable stops are skipped.
          variant(2, [['x']]),
        ]),
        // Malformed routes are skipped.
        { i: 'nope', n: [], v: [] },
        null,
      ])
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.variants).toHaveLength(1)
    expect(groups[0]?.variants[0]?.stops.map((s) => s.stopId)).toEqual([20003337])
  })

  it('rejects structural mismatches loudly', () => {
    expect(() => parseGmbStopsFile(null)).toThrow()
    expect(() => parseGmbStopsFile({})).toThrow()
    expect(() => parseGmbStopsFile(file('nope' as unknown as never[]))).toThrow()
    expect(() => parseGmbStopsFile({ meta: {}, routes: [] })).toThrow()
    expect(() =>
      parseGmbStopsFile({
        meta: { source: 's', dataset: 'd', cutoffDate: 'c', generatedAt: 'g', count: 'x' },
        routes: [],
      })
    ).toThrow()
  })
})

describe('gmb helpers', () => {
  it('maps routeSeq 1 to outbound and 2 to inbound', () => {
    expect(gmbRouteSeqToBound(1)).toBe('O')
    expect(gmbRouteSeqToBound(2)).toBe('I')
  })

  it('maps stopPickDrop roles to i18n keys', () => {
    expect(gmbPickDropKey(1)).toBe('gmb.dropOffOnly')
    expect(gmbPickDropKey(2)).toBe('gmb.pickUpOnly')
    expect(gmbPickDropKey(3)).toBe('gmb.pickUpDropOff')
  })
})
