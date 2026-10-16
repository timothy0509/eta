import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { kmbRouteGeometryKey, routeWaypointsKey } from '@/lib/eta/cache/keys'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { fetchOsrmRouteGeometry } from '@/lib/eta/direct/osrm'
import { fetchRouteWaypoints, waypointDirectionForBound } from '@/lib/eta/direct/waypoints'
import type { GeoPoint } from '@/lib/eta/geo'

export function pointsSignature(points: GeoPoint[]): string {
  let hash = 2166136261
  for (const p of points) {
    hash ^= Math.round(p.lat * 1e6)
    hash = Math.imul(hash, 16777619)
    hash ^= Math.round(p.lng * 1e6)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export async function getRoutedGeometry(
  variantKey: string,
  points: GeoPoint[],
  options?: { signal?: AbortSignal }
): Promise<GeoPoint[] | null> {
  if (points.length < 2) return null

  try {
    const { value } = await getCachedValue<GeoPoint[]>({
      key: `${kmbRouteGeometryKey(variantKey)}:${pointsSignature(points)}`,
      policyKey: 'kmbRouteGeometry',
      policy: CACHE_POLICIES.kmbRouteGeometry,
      allowStale: true,
      fetcher: () => fetchOsrmRouteGeometry(points, { signal: options?.signal }),
    })
    return value.length >= 2 ? value : null
  } catch {
    return null
  }
}

/**
 * Best display geometry for a route variant: the prebuilt waypoint file
 * (instant, road-accurate, cached for a month) with OSRM as the fallback for
 * variants the dataset does not cover. Returns null when neither has data.
 */
export async function getRouteDisplayGeometry(
  params: {
    variantKey: string
    gtfsId?: string | null
    bound?: string | null
    points: GeoPoint[]
  },
  options?: { signal?: AbortSignal }
): Promise<GeoPoint[] | null> {
  const gtfsId = String(params.gtfsId ?? '').trim()
  const direction = waypointDirectionForBound(params.bound)
  if (gtfsId) {
    try {
      const { value } = await getCachedValue<GeoPoint[]>({
        key: routeWaypointsKey(gtfsId, direction),
        policyKey: 'routeWaypoints',
        policy: CACHE_POLICIES.routeWaypoints,
        allowStale: true,
        fetcher: () => fetchRouteWaypoints({ gtfsId, direction }, { signal: options?.signal }),
      })
      if (value.length >= 2) return value
    } catch {
      // Waypoints are best-effort; fall through to OSRM.
    }
  }
  return getRoutedGeometry(params.variantKey, params.points, options)
}
