import { describe, expect, it, vi, afterEach } from 'vitest'

import { buildRouteWaypointsUrl, fetchRouteWaypoints, waypointDirectionForBound } from './waypoints'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('buildRouteWaypointsUrl', () => {
  it('builds the same-origin waypoint URL with the direction suffix', () => {
    expect(buildRouteWaypointsUrl('kmb-14A-O', 'O')).toBe('/map-waypoints/kmb-14A-O-O.json')
    expect(buildRouteWaypointsUrl('kmb-14A-O', 'I')).toBe('/map-waypoints/kmb-14A-O-I.json')
  })
})

describe('waypointDirectionForBound', () => {
  it('maps bound values, including pseudo-circular ones, to I/O files', () => {
    expect(waypointDirectionForBound('O')).toBe('O')
    expect(waypointDirectionForBound('I')).toBe('I')
    expect(waypointDirectionForBound('OI')).toBe('O')
    expect(waypointDirectionForBound('IO')).toBe('O')
    expect(waypointDirectionForBound('')).toBe('O')
    expect(waypointDirectionForBound(null)).toBe('O')
    expect(waypointDirectionForBound(undefined)).toBe('O')
  })
})

describe('parseWaypointsGeoJson via fetchRouteWaypoints', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses a bare LineString geometry', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        type: 'LineString',
        coordinates: [
          [114.1, 22.3],
          [114.2, 22.31],
          [114.25, 22.32],
        ],
      })
    )
    const points = await fetchRouteWaypoints({ gtfsId: 'kmb-1-O', direction: 'O' })
    expect(points).toEqual([
      { lat: 22.3, lng: 114.1 },
      { lat: 22.31, lng: 114.2 },
      { lat: 22.32, lng: 114.25 },
    ])
  })

  it('parses a Feature wrapper', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [114.1, 22.3],
            [114.2, 22.31],
          ],
        },
      })
    )
    const points = await fetchRouteWaypoints({ gtfsId: 'kmb-1-O', direction: 'O' })
    expect(points).toHaveLength(2)
  })

  it('takes the first valid LineString from a FeatureCollection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [114.1, 22.3] },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [114.1, 22.3],
                [114.2, 22.31],
              ],
            },
          },
        ],
      })
    )
    const points = await fetchRouteWaypoints({ gtfsId: 'kmb-1-O', direction: 'O' })
    expect(points).toHaveLength(2)
  })

  it('rejects a file without a usable LineString', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ type: 'Feature', geometry: { type: 'Point', coordinates: [114, 22] } })
    )
    await expect(fetchRouteWaypoints({ gtfsId: 'kmb-1-O', direction: 'O' })).rejects.toThrow(
      /no usable LineString/
    )
  })

  it('rejects malformed coordinates', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        type: 'LineString',
        coordinates: [
          [114.1, 22.3],
          [114.2, 'not-a-number'],
        ],
      })
    )
    await expect(fetchRouteWaypoints({ gtfsId: 'kmb-1-O', direction: 'O' })).rejects.toThrow(
      /no usable LineString/
    )
  })

  it('requires a gtfsId', async () => {
    await expect(fetchRouteWaypoints({ gtfsId: '   ', direction: 'O' })).rejects.toThrow(/gtfsId/)
  })
})
