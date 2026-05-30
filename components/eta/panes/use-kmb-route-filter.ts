import type { RouteFilterState } from '@/components/eta/route-filter'
import type { RouteFilterMode } from '@/lib/store'

/**
 * Builds a route filter string from the current filter state.
 * Used to pass to the KMB ETA API.
 */
export function buildRouteFilterString(
  routeFilter: RouteFilterState,
  routeFilterMode: RouteFilterMode,
  queryRoute?: string
): string | undefined {
  const advancedEntries = routeFilterMode === 'advanced' ? (routeFilter.entries ?? []) : []
  const requestedRoutes = normalizeKmbRoutesInput(queryRoute?.trim() ?? '')

  if (advancedEntries.length) {
    const routesFromAdvanced = new Set(
      advancedEntries.map((e) => e.variantKey.split('|')[1]).filter(Boolean)
    )
    return Array.from(routesFromAdvanced).join(',')
  } else if (requestedRoutes) {
    return requestedRoutes.join(',')
  }
  return undefined
}

function normalizeKmbRoutesInput(input: string): string[] | null {
  const requestedRoutes = input
    ? input
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
        .map((r) => r.toUpperCase())
    : null

  return requestedRoutes?.length ? requestedRoutes : null
}

/**
 * Gets variant keys for a set of stop IDs from the route-stop index.
 */
export function getVariantKeysForStops(
  index: { byStopId: Map<string, Set<string>> },
  stopIds: string[]
): string[] {
  const result = new Set<string>()
  for (const stopId of stopIds) {
    const keys = index.byStopId.get(stopId)
    if (keys) {
      for (const key of keys) {
        result.add(key)
      }
    }
  }
  return Array.from(result)
}
