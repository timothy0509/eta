import type { Company } from 'hk-bus-eta'

import type { KmbEtaEntryWithLeg } from '@/lib/eta/direct/kmb'
import { routeVariantKey, variantKeyMatches } from '@/lib/eta/eta-db-index'

/** Minimal variant identity for post-fetch ETA filtering in route views. */
export type RouteVariantRef = {
  co: string
  route: string
  bound: string
  serviceType: string
  gtfsId: string
  jointVariantKey: string
}

/**
 * Keep only the ETAs that belong to the selected route variant.
 *
 * Joint variants match on the shared jointVariantKey across operators.
 * Single-operator variants match with variantKeyMatches, which tolerates a
 * missing gtfsId on either side: official KMB stop-eta rows carry none
 * while the index variant does. Two different non-empty gtfsIds never
 * match, so same-number routes in different regions stay separate.
 */
export function filterRouteStopEtas(
  entries: KmbEtaEntryWithLeg[],
  variant: RouteVariantRef
): KmbEtaEntryWithLeg[] {
  if (!entries.length) return []
  const jointKey = String(variant.jointVariantKey ?? '').trim()
  if (jointKey) {
    return entries.filter((eta) => String(eta.jointVariantKey ?? '').trim() === jointKey)
  }
  const filterKey = routeVariantKey({
    co: variant.co as Company,
    route: variant.route,
    bound: variant.bound,
    serviceType: variant.serviceType,
    gtfsId: variant.gtfsId,
  })
  return entries.filter((eta) => {
    const entryKey = routeVariantKey({
      co: String(eta.co ?? 'kmb') as Company,
      route: (eta.route ?? '').toUpperCase(),
      bound: eta.dir,
      serviceType: String(eta.service_type),
      gtfsId: eta.gtfsId,
    })
    return variantKeyMatches(filterKey, entryKey)
  })
}
