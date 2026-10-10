import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { idbGet, idbSet } from '@/lib/eta/cache/idb'
import type { GeoPoint } from '@/lib/eta/geo'

import {
  getTdRouteShapeIndex,
  parseTdCompactShapesJson,
  resolveTdInstantPath,
  selectTdShape,
  TD_BUS_SHAPES_URL,
  TD_GMB_SHAPES_URL,
  type TdRouteShape,
} from './td-shapes'

vi.mock('@/lib/eta/cache/idb', () => ({
  idbGet: vi.fn(),
  idbSet: vi.fn(),
}))

const mockIdbGet = vi.mocked(idbGet)
const mockIdbSet = vi.mocked(idbSet)

const A: GeoPoint = { lat: 22.35, lng: 114.19 }
const B: GeoPoint = { lat: 22.34, lng: 114.19 }
const C: GeoPoint = { lat: 22.33, lng: 114.19 }
const FAR: GeoPoint = { lat: 22.5, lng: 114.05 }

function entry(
  id: number,
  seq: number,
  co: string,
  pts: Array<[number, number] | [string, string] | [number]>
): unknown {
  return { id, seq, co, pts }
}

// Compact extract fixtures as written by scripts/build-td-shapes.ts: points
// are [lng, lat] pairs in stopSeq order, companies stay joined with '+'.
const BUS_FIXTURE = {
  meta: { source: 'test', generatedAt: '2026-01-01T00:00:00.000Z', variants: 7 },
  shapes: {
    '1': [
      entry(1001, 1, 'KMB', [
        [114.19, 22.35],
        [114.19, 22.34],
        [114.19, 22.33],
      ]),
      entry(1001, 2, 'KMB', [
        [114.19, 22.33],
        [114.19, 22.34],
        [114.19, 22.35],
      ]),
      // Route 1 short working under another routeId.
      entry(1480, 1, 'KMB', [
        [114.19, 22.35],
        [114.19, 22.34],
      ]),
    ],
    // Route 10 split by operator, like the real KMB/CTB joint route.
    '10': [
      entry(1002, 1, 'KMB', [
        [114.15, 22.28],
        [114.16, 22.28],
      ]),
      entry(1000295, 1, 'CTB', [
        [114.2, 22.29],
        [114.21, 22.29],
      ]),
    ],
    // Jointly operated route shares one shape for both companies.
    '101': [
      entry(1042, 1, 'KMB+CTB', [
        [114.17, 22.3],
        [114.18, 22.3],
      ]),
    ],
    // Route 2 carries a swapped lng/lat pair in the middle, which the
    // bounds guard drops while keeping the valid stops around it.
    '2': [
      entry(2001, 1, 'KMB', [
        [114.25, 22.31],
        [22.32, 114.26],
        [114.27, 22.33],
      ]),
    ],
    // Route 3 entries are malformed and never produce a shape.
    '3': [
      entry(3001, 1, 'KMB', [[114.19, 22.35]]),
      entry(3001, 2, '', [
        [114.19, 22.35],
        [114.19, 22.34],
      ]),
      entry(3001, 3, 'KMB', [[114.19]]),
    ],
  },
}

const GMB_FIXTURE = {
  meta: { source: 'test', generatedAt: '2026-01-01T00:00:00.000Z', variants: 1 },
  shapes: {
    '69': [
      entry(2000410, 1, 'GMB', [
        [114.13, 22.26],
        [114.14, 22.26],
      ]),
    ],
  },
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('parseTdCompactShapesJson', () => {
  it('preserves the stopSeq point order from the extract', () => {
    const index = parseTdCompactShapesJson(BUS_FIXTURE)
    const seq1 = index['1']?.find((shape) => shape.routeId === 1001 && shape.routeSeq === 1)
    expect(seq1?.points).toEqual([A, B, C])
  })

  it('keeps routeSeq 1 and 2 as separate directional shapes', () => {
    const index = parseTdCompactShapesJson(BUS_FIXTURE)
    const shapes = (index['1'] ?? []).filter((shape) => shape.routeId === 1001)
    expect(shapes.map((shape) => shape.routeSeq).sort()).toEqual([1, 2])
    expect(shapes.find((shape) => shape.routeSeq === 2)?.points).toEqual([C, B, A])
  })

  it('keeps special departures under separate routeIds', () => {
    const index = parseTdCompactShapesJson(BUS_FIXTURE)
    const shortWorking = (index['1'] ?? []).find((shape) => shape.routeId === 1480)
    expect(shortWorking?.points).toEqual([A, B])
  })

  it('skips invalid entries without failing the file', () => {
    const index = parseTdCompactShapesJson(BUS_FIXTURE)
    // The swapped lng/lat middle stop drops out, neighbors stay in order.
    expect(index['2']?.[0]?.points).toEqual([
      { lat: 22.31, lng: 114.25 },
      { lat: 22.33, lng: 114.27 },
    ])
    // Single-point, company-less, and short-pair entries yield no shape.
    expect(index['3']).toBeUndefined()
  })

  it('splits joint company codes for both operators', () => {
    const index = parseTdCompactShapesJson(BUS_FIXTURE)
    expect(index['101']?.[0]?.companies).toEqual(['KMB', 'CTB'])
  })

  it('returns an empty index for non-extract input', () => {
    expect(parseTdCompactShapesJson(null)).toEqual({})
    expect(parseTdCompactShapesJson({ type: 'FeatureCollection' })).toEqual({})
    expect(parseTdCompactShapesJson([])).toEqual({})
    expect(parseTdCompactShapesJson({ shapes: [] })).toEqual({})
  })
})

describe('selectTdShape', () => {
  const seq1: TdRouteShape = {
    routeName: '1',
    routeId: 1001,
    routeSeq: 1,
    companies: ['KMB'],
    points: [A, B, C],
  }
  const seq2: TdRouteShape = { ...seq1, routeSeq: 2, points: [C, B, A] }

  it('picks the routeSeq matching the variant travel direction', () => {
    expect(selectTdShape([seq1, seq2], 'kmb', [A, B, C])).toBe(seq1)
    expect(selectTdShape([seq1, seq2], 'kmb', [C, B, A])).toBe(seq2)
  })

  it('matches the variant company against joint operation codes', () => {
    const joint: TdRouteShape = {
      routeName: '101',
      routeId: 1042,
      routeSeq: 1,
      companies: ['KMB', 'CTB'],
      points: [
        { lat: 22.3, lng: 114.17 },
        { lat: 22.3, lng: 114.18 },
      ],
    }
    const variant: GeoPoint[] = [
      { lat: 22.3, lng: 114.17 },
      { lat: 22.3, lng: 114.18 },
    ]
    expect(selectTdShape([joint], 'ctb', variant)).toBe(joint)
    expect(selectTdShape([joint], 'nlb', variant)).toBeNull()
  })

  it('returns null when the variant runs nowhere near the candidates', () => {
    const farAway: GeoPoint[] = [FAR, { lat: 22.51, lng: 114.06 }]
    expect(selectTdShape([seq1, seq2], 'kmb', farAway)).toBeNull()
  })

  it('returns null for empty inputs', () => {
    expect(selectTdShape([], 'kmb', [A, B])).toBeNull()
    expect(selectTdShape([seq1], 'kmb', [])).toBeNull()
  })
})

describe('TD shape fetching and caching', () => {
  beforeEach(() => {
    mockIdbGet.mockReset()
    mockIdbSet.mockReset()
    mockIdbGet.mockResolvedValue(null)
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url === TD_BUS_SHAPES_URL) return Promise.resolve(jsonResponse(BUS_FIXTURE))
      if (url === TD_GMB_SHAPES_URL) return Promise.resolve(jsonResponse(GMB_FIXTURE))
      return Promise.reject(new Error(`unexpected url ${url}`))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches the bus dataset once and serves repeats from cache', async () => {
    const spy = vi.mocked(globalThis.fetch)
    const first = await getTdRouteShapeIndex('bus')
    const second = await getTdRouteShapeIndex('bus')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(
      TD_BUS_SHAPES_URL,
      expect.objectContaining({ cache: 'no-store' })
    )
    expect(second).toBe(first)
    expect(first['1']?.length).toBe(3)
  })

  it('fetches the GMB dataset from its own URL', async () => {
    const index = await getTdRouteShapeIndex('gmb')
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      TD_GMB_SHAPES_URL,
      expect.objectContaining({ cache: 'no-store' })
    )
    expect(index['69']?.[0]?.points).toEqual([
      { lat: 22.26, lng: 114.13 },
      { lat: 22.26, lng: 114.14 },
    ])
  })

  it('resolves the instant path for a KMB variant in travel direction', async () => {
    const shape = await resolveTdInstantPath({
      dataset: 'bus',
      route: '1',
      co: 'kmb',
      variantPoints: [A, B, C],
    })
    expect(shape).toEqual({ points: [A, B, C], routeId: 1001, routeSeq: 1 })
  })

  it('resolves the opposite direction for the return leg', async () => {
    const shape = await resolveTdInstantPath({
      dataset: 'bus',
      route: '1',
      co: 'kmb',
      variantPoints: [C, B, A],
    })
    expect(shape?.routeSeq).toBe(2)
    expect(shape?.points).toEqual([C, B, A])
  })

  it('keeps KMB and CTB shapes for joint route numbers apart', async () => {
    const kmb = await resolveTdInstantPath({
      dataset: 'bus',
      route: '10',
      co: 'kmb',
      variantPoints: [
        { lat: 22.28, lng: 114.15 },
        { lat: 22.28, lng: 114.16 },
      ],
    })
    const ctb = await resolveTdInstantPath({
      dataset: 'bus',
      route: '10',
      co: 'ctb',
      variantPoints: [
        { lat: 22.29, lng: 114.2 },
        { lat: 22.29, lng: 114.21 },
      ],
    })
    expect(kmb?.routeId).toBe(1002)
    expect(ctb?.routeId).toBe(1000295)
  })

  it('resolves the GMB shape from the GMB dataset', async () => {
    const shape = await resolveTdInstantPath({
      dataset: 'gmb',
      route: '69',
      co: 'gmb',
      variantPoints: [
        { lat: 22.26, lng: 114.13 },
        { lat: 22.26, lng: 114.14 },
      ],
    })
    expect(shape).toEqual({
      points: [
        { lat: 22.26, lng: 114.13 },
        { lat: 22.26, lng: 114.14 },
      ],
      routeId: 2000410,
      routeSeq: 1,
    })
  })

  it('returns null for unknown routes and short point lists', async () => {
    await expect(
      resolveTdInstantPath({ dataset: 'bus', route: 'NOPE', co: 'kmb', variantPoints: [A, B] })
    ).resolves.toBeNull()
    await expect(
      resolveTdInstantPath({ dataset: 'bus', route: '1', co: 'kmb', variantPoints: [A] })
    ).resolves.toBeNull()
  })

  it('still resolves when the IndexedDB persist fails with a quota error', async () => {
    vi.resetModules()
    const fresh = await import('./td-shapes')
    const idb = await import('@/lib/eta/cache/idb')
    vi.mocked(idb.idbGet).mockResolvedValue(null)
    vi.mocked(idb.idbSet).mockRejectedValue(
      new DOMException('Quota exceeded.', 'QuotaExceededError')
    )
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input) === TD_BUS_SHAPES_URL) return Promise.resolve(jsonResponse(BUS_FIXTURE))
      return Promise.reject(new Error(`unexpected url ${String(input)}`))
    })

    const shape = await fresh.resolveTdInstantPath({
      dataset: 'bus',
      route: '1',
      co: 'kmb',
      variantPoints: [A, B, C],
    })
    expect(shape).toEqual({ points: [A, B, C], routeId: 1001, routeSeq: 1 })
    // One cached-path attempt plus one direct retry without the cache.
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('rejects when the dataset download fails so callers can fall back', async () => {
    vi.resetModules()
    const fresh = await import('./td-shapes')
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))
    await expect(fresh.getTdRouteShapeIndex('bus')).rejects.toThrow('network down')
  })
})
