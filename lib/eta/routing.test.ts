import { describe, expect, it, vi, afterEach } from 'vitest'

import { getRoutedGeometry } from './routing'

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
})
