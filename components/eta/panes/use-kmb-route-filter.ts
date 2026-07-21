import type { RouteFilterState } from '@/components/eta/route-filter'
import type { StopSearchSelection } from '@/components/eta/stop-search'
import type { RouteFilterMode } from '@/lib/store'

export type KmbQuery =
  | {
      mode: 'stop'
      stopId: string
      route?: string
      serviceType?: string
    }
  | {
      mode: 'stops'
      stopIds: string[]
      route?: string
      serviceType?: string
    }
  | {
      mode: 'contains'
      query: string
      route?: string
      serviceType?: string
    }

/**
 * Builds a route filter string from the current filter state.
 * Used to pass to the KMB ETA API.
 */
export function buildRouteFilterString(
  routeFilter: RouteFilterState,
  routeFilterMode: RouteFilterMode,
  queryRoute?: string
): string | undefined {
  const entries = routeFilter.entries ?? []
  const requestedRoutes = normalizeKmbRoutesInput(queryRoute?.trim() ?? '')

  if (entries.length) {
    const routesFromEntries = new Set(
      entries.map((e) => e.variantKey.split('|')[1]).filter(Boolean)
    )
    return Array.from(routesFromEntries).join(',')
  } else if (requestedRoutes) {
    return requestedRoutes.join(',')
  }

  if (routeFilterMode === 'simple') {
    const routesFromFilter = normalizeKmbRoutesInput(routeFilter.routes?.trim() ?? '')
    if (routesFromFilter) {
      return routesFromFilter.join(',')
    }
  }

  return undefined
}

/**
 * Builds a KmbQuery from draft stop selection and current route filter state.
 */
export function buildKmbQueryFromDraft(
  selection: StopSearchSelection,
  routeFilter: RouteFilterState,
  routeFilterMode: RouteFilterMode
): KmbQuery {
  const route = routeFilterMode === 'simple' ? routeFilter.routes?.trim() || undefined : undefined

  if (selection.type === 'stop') {
    return {
      mode: 'stop',
      stopId: selection.stopId,
      route,
      serviceType: '1',
    }
  }

  if (selection.type === 'stops') {
    return {
      mode: 'stops',
      stopIds: selection.stopIds,
      route,
      serviceType: '1',
    }
  }

  return {
    mode: 'contains',
    query: selection.query,
    route,
    serviceType: '1',
  }
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
