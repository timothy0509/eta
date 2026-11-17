import { pickPrimaryOperator } from '@/lib/eta/eta-db-index'

/** One route serving a stop, with the operator that picks its badge color. */
export type StopRouteBadge = {
  route: string
  co: string
}

type RouteStopRow = {
  stopId?: string | null
  route?: string | null
  co?: string | null
}

/** Max badges shown on a stop row. More than this collapses to 4 + a +N pill. */
const MAX_STOP_ROUTE_BADGES = 5

/** Visible badges when the list overflows; the rest fold into the +N pill. */
const MAX_VISIBLE_BEFORE_OVERFLOW = 4

function compareBadges(a: StopRouteBadge, b: StopRouteBadge): number {
  return a.route.localeCompare(b.route, 'en', { numeric: true }) || a.co.localeCompare(b.co, 'en')
}

/**
 * Build a stopId -> distinct routes index from the route-stop table.
 * One pass over the rows. Distinct by route number: variants that differ
 * only by bound, service type, or region collapse into one badge, and a
 * route served by several operators keeps the primary one for coloring.
 * Each list is sorted for stable display. The returned Map is the cache:
 * build it once per route-stop load and reuse it for every keystroke.
 */
export function buildStopRoutesIndex(
  rows: RouteStopRow[],
  preferred?: string | null
): Map<string, StopRouteBadge[]> {
  const operatorsByStopRoute = new Map<string, Map<string, Set<string>>>()
  for (const row of rows) {
    const stopId = String(row.stopId ?? '').trim()
    const route = String(row.route ?? '')
      .trim()
      .toUpperCase()
    if (!stopId || !route) continue
    const co =
      String(row.co ?? 'kmb')
        .trim()
        .toLowerCase() || 'kmb'
    let byRoute = operatorsByStopRoute.get(stopId)
    if (!byRoute) {
      byRoute = new Map()
      operatorsByStopRoute.set(stopId, byRoute)
    }
    let operators = byRoute.get(route)
    if (!operators) {
      operators = new Set()
      byRoute.set(route, operators)
    }
    operators.add(co)
  }

  const out = new Map<string, StopRouteBadge[]>()
  for (const [stopId, byRoute] of operatorsByStopRoute) {
    const badges: StopRouteBadge[] = []
    for (const [route, operators] of byRoute) {
      badges.push({ route, co: pickPrimaryOperator(operators, preferred) })
    }
    badges.sort(compareBadges)
    out.set(stopId, badges)
  }
  return out
}

/**
 * Union the badge lists of several stops (sequential-code groups share one
 * row). Distinct by route number, sorted. Cheap: groups hold a few stops
 * with a few dozen variants at most, so call it per rendered row.
 */
export function getRoutesForStopIds(
  index: Map<string, StopRouteBadge[]>,
  stopIds: string[],
  preferred?: string | null
): StopRouteBadge[] {
  const byRoute = new Map<string, StopRouteBadge>()
  for (const stopId of stopIds) {
    const badges = index.get(stopId)
    if (!badges) continue
    for (const badge of badges) {
      const existing = byRoute.get(badge.route)
      if (!existing) {
        byRoute.set(badge.route, badge)
        continue
      }
      if (existing.co !== badge.co) {
        byRoute.set(badge.route, {
          route: badge.route,
          co: pickPrimaryOperator([existing.co, badge.co], preferred),
        })
      }
    }
  }
  return Array.from(byRoute.values()).sort(compareBadges)
}

/**
 * Split a badge list for display: up to 5 badges, or the first 4 plus an
 * overflow count when there are more than 5.
 */
export function sliceStopRoutesForDisplay(routes: StopRouteBadge[]): {
  visible: StopRouteBadge[]
  overflow: number
} {
  if (routes.length <= MAX_STOP_ROUTE_BADGES) return { visible: routes, overflow: 0 }
  return {
    visible: routes.slice(0, MAX_VISIBLE_BEFORE_OVERFLOW),
    overflow: routes.length - MAX_VISIBLE_BEFORE_OVERFLOW,
  }
}
