import type { Company } from 'hk-bus-eta'

import operatorData from '@/lib/eta/gtfs/operators.json'

/**
 * Companies the app can show. hk-bus-eta types predate the LWB split: its
 * feed files every KMB-group route, Long Win included, under co "kmb".
 * operatorData.lwbRoutes comes from the TD GTFS `routes.txt` agency column,
 * so the app can put LWB routes back under their own company. nwfb is the
 * legacy Citybus code still present in the upstream db.
 */
export type AppCompany = Company | 'lwb' | 'nwfb'

const LWB_ROUTES: ReadonlySet<string> = new Set(
  (operatorData.lwbRoutes ?? [])
    .map((route) =>
      String(route ?? '')
        .trim()
        .toUpperCase()
    )
    .filter(Boolean)
)

/** True when TD GTFS lists this route_short_name as Long Win Bus. */
export function isLwbRoute(route: unknown): boolean {
  return LWB_ROUTES.has(
    String(route ?? '')
      .trim()
      .toUpperCase()
  )
}

/**
 * KMB and LWB share one upstream API and one stop-name format. Use this
 * where the old code checked `co === 'kmb'` for KMB-family behaviour, not
 * where it meant the literal operator.
 */
export function isKmbFamily(co: unknown): boolean {
  const normalized = String(co ?? '')
    .trim()
    .toLowerCase()
  return normalized === 'kmb' || normalized === 'lwb'
}

/**
 * Resolve an upstream or legacy company code to the app company. A "kmb"
 * row whose route is in the TD LWB list becomes "lwb"; everything else
 * keeps its lowercased code. Old saved links and favorites that used
 * kmb|A31 pass through here and land on lwb|A31.
 */
export function resolveAppCompany(co: unknown, route: unknown): AppCompany {
  const normalized = String(co ?? 'kmb')
    .trim()
    .toLowerCase()
  if (normalized === 'kmb' && isLwbRoute(route)) return 'lwb'
  return normalized as AppCompany
}
