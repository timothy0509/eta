import type { KmbRouteInfoLite } from '@/lib/eta/client'
import type { KmbRouteListEntry } from '@/lib/eta/direct/kmb'

/**
 * Map the cached route-list row to the shape the routes view consumes.
 * Keep joint metadata on this path: dropping `operators` or
 * `jointVariantKey` makes every joint route split back into one row per
 * operator in the route search and detail views.
 */
export function mapKmbRouteListEntry(entry: KmbRouteListEntry): KmbRouteInfoLite {
  const co = entry.co ?? 'kmb'
  return {
    co,
    route: entry.route,
    bound: entry.bound,
    serviceType: String(entry.service_type),
    gtfsId: String(entry.gtfsId ?? '').trim(),
    region: String(entry.region ?? '').trim(),
    operators: entry.operators ?? [co],
    jointVariantKey: String(entry.jointVariantKey ?? '').trim(),
    origin: {
      en: (entry.orig_en ?? '').trim(),
      tc: (entry.orig_tc ?? '').trim(),
      sc: (entry.orig_sc ?? '').trim(),
    },
    destination: {
      en: (entry.dest_en ?? '').trim(),
      tc: (entry.dest_tc ?? '').trim(),
      sc: (entry.dest_sc ?? '').trim(),
    },
  }
}
