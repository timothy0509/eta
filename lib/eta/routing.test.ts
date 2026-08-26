import { describe, expect, it, vi, afterEach } from 'vitest'

import { getRoutedGeometry, pointsSignature } from './routing'

const POINTS = [
  { lat: 22.3193, lng: 114.1694 },
  { lat: 22.2958, lng: 114.1723 },
]

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function okBody() {
  return {
    code: 'Ok',
    routes: [
      {
        geometry: {
          type: 'LineString',
          coordinates: [
            [114.1694, 22.3193],
            [114.17, 22.31],
          ],
        },
      },
    ],
  }
}

describe('getRoutedGeometry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns road-snapped geometry on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(okBody()))

    const result = await getRoutedGeometry('routing-test-success', POINTS)
    expect(result).toEqual([
      { lat: 22.3193, lng: 114.1694 },
      { lat: 22.31, lng: 114.17 },
    ])
  })

  it('returns null when the upstream request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    const result = await getRoutedGeometry('routing-test-failure', POINTS)
    expect(result).toBeNull()
  })

  it('returns null when OSRM reports no route', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ code: 'NoRoute', message: 'Impossible route' })
    )

    const result = await getRoutedGeometry('routing-test-noroute', POINTS)
    expect(result).toBeNull()
  })

  it('returns null for fewer than two points without fetching', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')

    const result = await getRoutedGeometry('routing-test-short', [{ lat: 1, lng: 1 }])
    expect(result).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('uses distinct cache entries for different waypoints under the same variant', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(okBody()))
    const otherPoints = [
      { lat: 22.1, lng: 114.1 },
      { lat: 22.2, lng: 114.2 },
    ]

    await getRoutedGeometry('routing-test-waysig', POINTS)
    await getRoutedGeometry('routing-test-waysig', otherPoints)

    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('serves from cache for identical variant and waypoints', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(okBody()))

    const first = await getRoutedGeometry('routing-test-cachehit', POINTS)
    const second = await getRoutedGeometry('routing-test-cachehit', POINTS)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(first).not.toBeNull()
    expect(second).toEqual(first)
  })

  it('computes a stable signature for identical waypoints', async () => {
    expect(pointsSignature(POINTS)).toBe(pointsSignature(POINTS))
    expect(pointsSignature(POINTS)).not.toBe(
      pointsSignature([
        { lat: 22.1, lng: 114.1 },
        { lat: 22.2, lng: 114.2 },
      ])
    )
  })
})
