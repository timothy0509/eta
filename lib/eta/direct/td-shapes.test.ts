import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { idbGet, idbSet } from '@/lib/eta/cache/idb'
import type { GeoPoint } from '@/lib/eta/geo'

import {
  getTdRouteShapeIndex,
  parseTdRouteShapesJson,
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

function feature(
  properties: Record<string, unknown>,
  coordinates: unknown,
  geometryType = 'Point'
): unknown {
  return {
    type: 'Feature',
    geometry: { type: geometryType, coordinates },
    properties,
  }
}

function stopProps(
  routeNameE: string,
  companyCode: string,
  routeId: number,
  routeSeq: number,
  stopSeq: number
): Record<string, unknown> {
  return { routeNameE, companyCode, routeId, routeSeq, stopSeq }
}

function collection(features: unknown[]): unknown {
  return { type: 'FeatureCollection', features }
}

const BUS_FIXTURE = collection([
  // Route 1 seq 1, deliberately out of stopSeq order to test sorting.
  feature(stopProps('1', 'KMB', 1001, 1, 2), [114.19, 22.34]),
  feature(stopProps('1', 'KMB', 1001, 1, 1), [114.19, 22.35]),
  feature(stopProps('1', 'KMB', 1001, 1, 3), [114.19, 22.33]),
  // Route 1 seq 2 runs the opposite direction.
  feature(stopProps('1', 'KMB', 1001, 2, 1), [114.19, 22.33]),
  feature(stopProps('1', 'KMB', 1001, 2, 2), [114.19, 22.34]),
  feature(stopProps('1', 'KMB', 1001, 2, 3), [114.19, 22.35]),
  // Route 1 short working under another routeId.
  feature(stopProps('1', 'KMB', 1480, 1, 1), [114.19, 22.35]),
  feature(stopProps('1', 'KMB', 1480, 1, 2), [114.19, 22.34]),
  // Route 10 split by operator, like the real KMB/CTB joint route.
  feature(stopProps('10', 'KMB', 1002, 1, 1), [114.15, 22.28]),
  feature(stopProps('10', 'KMB', 1002, 1, 2), [114.16, 22.28]),
  feature(stopProps('10', 'CTB', 1000295, 1, 1), [114.2, 22.29]),
  feature(stopProps('10', 'CTB', 1000295, 1, 2), [114.21, 22.29]),
  // Jointly operated route shares one shape for both companies.
  feature(stopProps('101', 'KMB+CTB', 1042, 1, 1), [114.17, 22.3]),
  feature(stopProps('101', 'KMB+CTB', 1042, 1, 2), [114.18, 22.3]),
  // Invalid features never fail the whole file.
  feature(stopProps('1', 'KMB', 1001, 1, 4), [114.19, 22.32], 'LineString'),
  feature(stopProps('1', 'KMB', 1001, 1, 5), ['x', 'y']),
  feature(stopProps('', 'KMB', 1001, 1, 1), [114.19, 22.35]),
  // Route 2 has a swapped lng/lat pair in the middle, which the bounds
  // guard drops while keeping the valid stops around it.
  feature(stopProps('2', 'KMB', 2001, 1, 1), [114.25, 22.31]),
  feature(stopProps('2', 'KMB', 2001, 1, 2), [22.32, 114.26]),
  feature(stopProps('2', 'KMB', 2001, 1, 3), [114.27, 22.33]),
])

const GMB_FIXTURE = collection([
  feature(stopProps('69', 'GMB', 2000410, 1, 1), [114.13, 22.26]),
  feature(stopProps('69', 'GMB', 2000410, 1, 2), [114.14, 22.26]),
])

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('parseTdRouteShapesJson', () => {
  it('orders stops by stopSeq regardless of feature order', () => {
    const index = parseTdRouteShapesJson(BUS_FIXTURE)
    const seq1 = index['1']?.find((shape) => shape.routeId === 1001 && shape.routeSeq === 1)
    expect(seq1?.points).toEqual([A, B, C])
  })

  it('keeps routeSeq 1 and 2 as separate directional shapes', () => {
    const index = parseTdRouteShapesJson(BUS_FIXTURE)
    const shapes = (index['1'] ?? []).filter((shape) => shape.routeId === 1001)
    expect(shapes.map((shape) => shape.routeSeq).sort()).toEqual([1, 2])
    expect(shapes.find((shape) => shape.routeSeq === 2)?.points).toEqual([C, B, A])
  })

  it('keeps special departures under separate routeIds', () => {
    const index = parseTdRouteShapesJson(BUS_FIXTURE)
    const shortWorking = (index['1'] ?? []).find((shape) => shape.routeId === 1480)
    expect(shortWorking?.points).toEqual([A, B])
  })

  it('skips invalid features without failing the file', () => {
    const index = parseTdRouteShapesJson(BUS_FIXTURE)
    // The LineString-geometry and non-numeric stops never join route 1 seq 1.
    const seq1 = index['1']?.find((shape) => shape.routeId === 1001 && shape.routeSeq === 1)
    expect(seq1?.points).toEqual([A, B, C])
    // Empty route names produce no bucket.
    expect(index['']).toBeUndefined()
    // The swapped lng/lat middle stop drops out, neighbors stay in order.
    expect(index['2']?.[0]?.points).toEqual([
      { lat: 22.31, lng: 114.25 },
      { lat: 22.33, lng: 114.27 },
    ])
  })

  it('splits joint company codes for both operators', () => {
    const index = parseTdRouteShapesJson(BUS_FIXTURE)
    expect(index['101']?.[0]?.companies).toEqual(['KMB', 'CTB'])
  })

  it('returns an empty index for non-collection input', () => {
    expect(parseTdRouteShapesJson(null)).toEqual({})
    expect(parseTdRouteShapesJson({ type: 'FeatureCollection' })).toEqual({})
    expect(parseTdRouteShapesJson([])).toEqual({})
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

  it('rejects when the dataset download fails so callers can fall back', async () => {
    vi.resetModules()
    const fresh = await import('./td-shapes')
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))
    await expect(fresh.getTdRouteShapeIndex('bus')).rejects.toThrow('network down')
  })
})
