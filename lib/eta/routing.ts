import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { kmbRouteGeometryKey } from '@/lib/eta/cache/keys'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { fetchOsrmRouteGeometry } from '@/lib/eta/direct/osrm'
import type { GeoPoint } from '@/lib/eta/geo'

export async function getRoutedGeometry(
  variantKey: string,
  points: GeoPoint[],
  options?: { signal?: AbortSignal }
): Promise<GeoPoint[] | null> {
  if (points.length < 2) return null

  try {
    const { value } = await getCachedValue<GeoPoint[]>({
      key: kmbRouteGeometryKey(variantKey),
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
