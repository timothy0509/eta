import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { kmbRouteGeometryKey } from '@/lib/eta/cache/keys'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { fetchOsrmRouteGeometry } from '@/lib/eta/direct/osrm'
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
