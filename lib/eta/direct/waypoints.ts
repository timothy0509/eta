import { env } from '@/lib/env'
import type { GeoPoint } from '@/lib/eta/geo'
import { fetchJson } from '@/lib/eta/http'

/**
 * Prebuilt route path geometry, published by the hkbus project from the
 * hk-bus-crawling dataset. One static JSON per route variant is far cheaper
 * and more accurate than an OSRM round-trip; straight-line stop coordinates
 * are the fallback when a route is missing here. Override with
 * NEXT_PUBLIC_ROUTE_WAYPOINTS_BASE_URL.
 */
export const ROUTE_WAYPOINTS_BASE_URL = env.NEXT_PUBLIC_ROUTE_WAYPOINTS_BASE_URL

export type RouteWaypointDirection = 'I' | 'O'

export function buildRouteWaypointsUrl(gtfsId: string, direction: RouteWaypointDirection): string {
  return `${ROUTE_WAYPOINTS_BASE_URL}/${encodeURIComponent(gtfsId)}-${direction}.json`
}

export function waypointDirectionForBound(
  bound: string | null | undefined
): RouteWaypointDirection {
  // Mirrors hkbus exactly: only a literal "I" maps to the inbound file.
  // Pseudo-circular "bound"[co] values like "OI"/"IO" take the outbound
  // waypoint file, matching their pseudo-circular handling.
  return String(bound ?? 'O') === 'I' ? 'I' : 'O'
}

type WaypointLine = { coordinates: unknown }

function parseLineStringCoordinates(coordinates: unknown): GeoPoint[] | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null
  const points: GeoPoint[] = []
  for (const entry of coordinates) {
    if (!Array.isArray(entry) || entry.length < 2) return null
    const lng = Number(entry[0])
    const lat = Number(entry[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
    points.push({ lat, lng })
  }
  return points
}

function isLineStringGeometry(geometry: unknown): geometry is WaypointLine {
  if (typeof geometry !== 'object' || geometry === null) return false
  const candidate = geometry as { type?: unknown; coordinates?: unknown }
  return candidate.type === 'LineString' && candidate.coordinates !== undefined
}

/**
 * Accepts a GeoJSON Feature, FeatureCollection, or bare geometry and returns
 * the first usable LineString of the file (hkbus route-waypoints dumps hold
 * exactly one route path).
 */
export function parseWaypointsGeoJson(json: unknown): GeoPoint[] | null {
  const candidates: unknown[] = []
  if (typeof json === 'object' && json !== null) {
    const root = json as { type?: unknown; geometry?: unknown; features?: unknown }
    if (root.type === 'Feature' && root.geometry) candidates.push(root.geometry)
    else if (root.type === 'FeatureCollection' && Array.isArray(root.features)) {
      for (const feature of root.features) {
        if (typeof feature === 'object' && feature !== null) {
          candidates.push((feature as { geometry?: unknown }).geometry)
        }
      }
    } else if (root.type === 'LineString') candidates.push(root)
  }

  for (const geometry of candidates) {
    if (!isLineStringGeometry(geometry)) continue
    const points = parseLineStringCoordinates(geometry.coordinates)
    if (points && points.length >= 2) return points
  }
  return null
}

export async function fetchRouteWaypoints(
  params: { gtfsId: string; direction: RouteWaypointDirection },
  options?: { signal?: AbortSignal }
): Promise<GeoPoint[]> {
  const gtfsId = String(params.gtfsId ?? '').trim()
  if (!gtfsId) throw new Error('A gtfsId is required for route waypoint lookup')
  const url = buildRouteWaypointsUrl(gtfsId, params.direction)
  const json = await fetchJson<unknown>(url, {
    timeoutMs: resolveWaypointsTimeoutMs(),
    cache: 'no-store',
    signal: options?.signal,
    retries: 0,
  })
  const parsed = parseWaypointsGeoJson(json)
  if (!parsed) throw new Error(`Route waypoint file ${url} has no usable LineString`)
  return parsed
}

function resolveWaypointsTimeoutMs(): number {
  if (typeof navigator !== 'undefined') {
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection
    if (connection) {
      if (connection.saveData === true) return 12000
      const type = String(connection.effectiveType ?? '').toLowerCase()
      if (type === 'slow-2g' || type === '2g' || type === '3g') return 12000
    }
  }
  return 8000
}
