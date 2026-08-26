import { describe, expect, it, vi, afterEach } from 'vitest'

import { ApiError } from '@/lib/eta/http'
import type { GeoPoint } from '@/lib/eta/geo'

import {
  buildOsrmRouteUrl,
  dedupeConsecutive,
  fetchOsrmRouteGeometry,
  OsrmRouteError,
  OSRM_BASE_URL,
  parseOsrmRouteResponse,
  toLngLat,
} from './osrm'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('toLngLat', () => {
  it('orders coordinates as lng,lat', () => {
    expect(toLngLat({ lat: 22.3193, lng: 114.1694 })).toBe('114.1694,22.3193')
  })
})

describe('dedupeConsecutive', () => {
  it('removes adjacent duplicates only', () => {
    const points: GeoPoint[] = [
      { lat: 1, lng: 1 },
      { lat: 1, lng: 1 },
      { lat: 2, lng: 2 },
      { lat: 1, lng: 1 },
    ]
    expect(dedupeConsecutive(points)).toEqual([
      { lat: 1, lng: 1 },
      { lat: 2, lng: 2 },
      { lat: 1, lng: 1 },
    ])
  })

  it('returns an empty array for empty input', () => {
    expect(dedupeConsecutive([])).toEqual([])
  })
})

describe('buildOsrmRouteUrl', () => {
  it('joins coordinates with semicolons in lng,lat order', () => {
    const url = buildOsrmRouteUrl([
      { lat: 22.3193, lng: 114.1694 },
      { lat: 22.2958, lng: 114.1723 },
    ])
    expect(url).toBe(
      `${OSRM_BASE_URL}/route/v1/driving/114.1694,22.3193;114.1723,22.2958?overview=full&geometries=geojson&steps=false&alternatives=false`
    )
  })
})

describe('parseOsrmRouteResponse', () => {
  const valid = {
    code: 'Ok',
    routes: [
      {
        geometry: {
          type: 'LineString',
          coordinates: [
            [114.1694, 22.3193],
            [114.1723, 22.2958],
          ],
        },
      },
    ],
  }

  it('parses valid geometry into {lat,lng} order', () => {
    expect(parseOsrmRouteResponse(valid)).toEqual([
      { lat: 22.3193, lng: 114.1694 },
      { lat: 22.2958, lng: 114.1723 },
    ])
  })

  it('returns null when code is not Ok', () => {
    expect(parseOsrmRouteResponse({ code: 'NoRoute', message: 'Impossible route' })).toBeNull()
    expect(parseOsrmRouteResponse({ code: 'InvalidOptions', message: 'bad' })).toBeNull()
  })

  it('returns null when routes is missing or empty', () => {
    expect(parseOsrmRouteResponse({ code: 'Ok', routes: [] })).toBeNull()
    expect(parseOsrmRouteResponse({ code: 'Ok' })).toBeNull()
  })

  it('returns null when geometry is missing or empty', () => {
    expect(
      parseOsrmRouteResponse({ code: 'Ok', routes: [{ geometry: { type: 'LineString' } }] })
    ).toBeNull()
    expect(
      parseOsrmRouteResponse({
        code: 'Ok',
        routes: [{ geometry: { type: 'LineString', coordinates: [] } }],
      })
    ).toBeNull()
  })

  it('returns null on malformed coordinates', () => {
    expect(
      parseOsrmRouteResponse({ code: 'Ok', routes: [{ geometry: { coordinates: [[1]] } }] })
    ).toBeNull()
    expect(
      parseOsrmRouteResponse({ code: 'Ok', routes: [{ geometry: { coordinates: [['x', 'y']] } }] })
    ).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(parseOsrmRouteResponse(null)).toBeNull()
    expect(parseOsrmRouteResponse('nope')).toBeNull()
  })
})

describe('fetchOsrmRouteGeometry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const points: GeoPoint[] = [
    { lat: 22.3193, lng: 114.1694 },
    { lat: 22.2958, lng: 114.1723 },
  ]

  it('fetches and returns parsed geometry', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        code: 'Ok',
        routes: [
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [114.1694, 22.3193],
                [114.1701, 22.301],
              ],
            },
          },
        ],
      })
    )

    const result = await fetchOsrmRouteGeometry(points)
    expect(result).toEqual([
      { lat: 22.3193, lng: 114.1694 },
      { lat: 22.301, lng: 114.1701 },
    ])
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('throws OsrmRouteError with fewer than two points', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    await expect(fetchOsrmRouteGeometry([{ lat: 1, lng: 1 }])).rejects.toThrow(OsrmRouteError)
    expect(spy).not.toHaveBeenCalled()
  })

  it('throws OsrmRouteError on non-Ok response code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ code: 'NoRoute', message: 'Impossible route between points' })
    )

    await expect(fetchOsrmRouteGeometry(points)).rejects.toMatchObject({
      name: 'OsrmRouteError',
      message: 'Impossible route between points',
      code: 'NoRoute',
    })
  })

  it('propagates ApiError on HTTP failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 503 }))

    await expect(fetchOsrmRouteGeometry(points)).rejects.toThrow(ApiError)
  })

  it('dedupes consecutive duplicate coordinates before requesting', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        code: 'Ok',
        routes: [
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [1, 2],
                [3, 4],
              ],
            },
          },
        ],
      })
    )

    const result = await fetchOsrmRouteGeometry([
      { lat: 2, lng: 1 },
      { lat: 2, lng: 1 },
      { lat: 4, lng: 3 },
    ])
    expect(result).toEqual([
      { lat: 2, lng: 1 },
      { lat: 4, lng: 3 },
    ])
    const calledUrl = String(spy.mock.calls[0][0])
    expect(calledUrl).toContain('/route/v1/driving/1,2;3,4?')
  })
})
