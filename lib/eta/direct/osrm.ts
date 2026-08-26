import { fetchJson } from '@/lib/eta/http'
import type { GeoPoint } from '@/lib/eta/geo'

export const OSRM_BASE_URL = 'https://router.project-osrm.org'
export const OSRM_ROUTE_TIMEOUT_MS = 25_000
export const OSRM_MAX_WAYPOINTS = 100

export class OsrmRouteError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'OsrmRouteError'
    this.code = code
  }
}

export type OsrmRouteResponse = {
  code: string
  message?: string
  routes?: Array<{
    geometry?: { type?: string; coordinates?: Array<[number, number]> }
    distance?: number
    duration?: number
  }>
}

export function toLngLat(p: GeoPoint): string {
  return `${p.lng},${p.lat}`
}

export function dedupeConsecutive(points: GeoPoint[]): GeoPoint[] {
  const result: GeoPoint[] = []
  for (const point of points) {
    const last = result[result.length - 1]
    if (last && last.lat === point.lat && last.lng === point.lng) continue
    result.push(point)
  }
  return result
}

export function buildOsrmRouteUrl(points: GeoPoint[]): string {
  const coords = points.map(toLngLat).join(';')
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'false',
    alternatives: 'false',
  })
  return `${OSRM_BASE_URL}/route/v1/driving/${coords}?${params.toString()}`
}

export function parseOsrmRouteResponse(json: unknown): GeoPoint[] | null {
  if (typeof json !== 'object' || json === null) return null
  const body = json as Record<string, unknown>
  if (body.code !== 'Ok') return null

  const routes = body.routes
  if (!Array.isArray(routes) || routes.length === 0) return null
  const first = routes[0]
  if (typeof first !== 'object' || first === null) return null
  const geometry = (first as Record<string, unknown>).geometry
  if (typeof geometry !== 'object' || geometry === null) return null
  const coordinates = (geometry as Record<string, unknown>).coordinates
  if (!Array.isArray(coordinates)) return null

  const result: GeoPoint[] = []
  for (const entry of coordinates) {
    if (!Array.isArray(entry) || entry.length < 2) return null
    const lng = Number(entry[0])
    const lat = Number(entry[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
    result.push({ lat, lng })
  }
  return result.length > 0 ? result : null
}

export async function fetchOsrmRouteGeometry(
  points: GeoPoint[],
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<GeoPoint[]> {
  const deduped = dedupeConsecutive(points)
  if (deduped.length < 2) {
    throw new OsrmRouteError('At least two points are required')
  }

  const waypoints = deduped.slice(0, OSRM_MAX_WAYPOINTS)
  const url = buildOsrmRouteUrl(waypoints)
  const json = await fetchJson<unknown>(url, {
    timeoutMs: options?.timeoutMs ?? OSRM_ROUTE_TIMEOUT_MS,
    cache: 'no-store',
    signal: options?.signal,
  })

  const parsed = parseOsrmRouteResponse(json)
  if (parsed) return parsed

  const code = (json as OsrmRouteResponse | null)?.code
  const message = (json as OsrmRouteResponse | null)?.message
  throw new OsrmRouteError(message ?? 'OSRM returned no usable route', code)
}
