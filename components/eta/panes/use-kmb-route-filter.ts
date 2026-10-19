import type { RouteFilterState } from '@/components/eta/route-filter'
import type { StopSearchSelection } from '@/components/eta/stop-search'
import { parseVariantKey } from '@/lib/eta/eta-db-index'

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
 * Selected direction variants take precedence; otherwise the saved route
 * text and the query route feed the KMB ETA API.
 */
export function buildRouteFilterString(
  routeFilter: RouteFilterState,
  queryRoute?: string
): string | undefined {
  const entries = routeFilter.entries ?? []
  const requestedRoutes = normalizeKmbRoutesInput(queryRoute?.trim() ?? '')

  if (entries.length) {
    const routesFromEntries = new Set(
      entries.map((e) => parseVariantKey(e.variantKey).route.toUpperCase()).filter(Boolean)
    )
    return Array.from(routesFromEntries).join(',')
  } else if (requestedRoutes) {
    return requestedRoutes.join(',')
  }

  const routesFromFilter = normalizeKmbRoutesInput(routeFilter.routes?.trim() ?? '')
  if (routesFromFilter) {
    return routesFromFilter.join(',')
  }

  return undefined
}

export type KmbQueryContext = {
  selection: StopSearchSelection | undefined
  routeFilter: RouteFilterState
}

function selectionKey(selection: StopSearchSelection): string {
  if (selection.type === 'stop') return `stop:${selection.stopId}`
  if (selection.type === 'stops') return `stops:${selection.stopIds.join(',')}`
  return `contains:${selection.query}`
}

function entryKeys(entries: RouteFilterState['entries']): string[] {
  return (entries ?? []).map((entry) => entry.variantKey).sort()
}

/**
 * Returns true when stop selection or route filter state changed enough to refetch ETAs.
 */
export function hasKmbQueryContextChanged(
  prev: KmbQueryContext | undefined,
  next: KmbQueryContext
): boolean {
  if (!prev) return true
  if (!next.selection) return false
  if (!prev.selection) return true
  if (selectionKey(prev.selection) !== selectionKey(next.selection)) return true

  const prevRoutes = prev.routeFilter.routes?.trim() ?? ''
  const nextRoutes = next.routeFilter.routes?.trim() ?? ''
  if (prevRoutes !== nextRoutes) return true

  const prevEntryKeys = entryKeys(prev.routeFilter.entries)
  const nextEntryKeys = entryKeys(next.routeFilter.entries)
  if (prevEntryKeys.length !== nextEntryKeys.length) return true
  return prevEntryKeys.some((key, index) => key !== nextEntryKeys[index])
}

/**
 * Builds a KmbQuery from draft stop selection and current route filter state.
 */
export function buildKmbQueryFromDraft(
  selection: StopSearchSelection,
  routeFilter: RouteFilterState
): KmbQuery {
  const route = routeFilter.routes?.trim() || undefined

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
