import type { Company, RouteListEntry } from 'hk-bus-eta'

import type { KmbRouteStopLite } from '@/lib/eta/client'
import { findRouteEntryByFamily, normalizeGtfsId, routeVariantKey } from '@/lib/eta/eta-db-index'
import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from '@/lib/eta/kmb-cache'

export type KmbFareInfo = {
  hkd: number
  dayCode?: number
  source: 'hk-bus-eta'
}

/** Five segments: co|ROUTE|bound|serviceType|gtfsId. Same number in different
 * regions (GMB HKI/Kowloon/NT) carries a distinct gtfsId per region. */
type VariantKey = `${string}|${string}|${string}|${string}|${string}`

export type VariantStops = {
  variantKey: VariantKey
  /** Maps stopId -> array of sequence numbers (sorted ascending). Supports circular routes where a stop appears twice. */
  stopSeqsByStopId: Map<string, number[]>
  terminusSeq: number
}

let cachedVariantStops: {
  expiresAtMs: number
  byVariantKey: Map<VariantKey, VariantStops>
} | null = null

let inFlightVariantStops: Promise<Map<VariantKey, VariantStops>> | null = null

function normalizeRouteName(route: string): string {
  return String(route ?? '')
    .trim()
    .toUpperCase()
}

function variantKey(
  co: string,
  route: string,
  bound: string,
  serviceType: string,
  gtfsId?: string
): VariantKey {
  return `${String(co ?? 'kmb')}|${normalizeRouteName(route)}|${String(bound ?? '')}|${String(
    serviceType ?? ''
  )}|${normalizeGtfsId(gtfsId)}`
}

export function computeKmbRouteVariantStops(routeStops: KmbRouteStopLite[]) {
  const byVariantKey = new Map<VariantKey, VariantStops>()

  for (const rs of routeStops) {
    const key = variantKey(rs.co, rs.route, rs.bound, rs.serviceType, rs.gtfsId)
    const existing = byVariantKey.get(key)
    const stopId = String(rs.stopId ?? '').trim()
    if (!stopId) continue

    if (!existing) {
      const stopSeqsByStopId = new Map<string, number[]>()
      stopSeqsByStopId.set(stopId, [rs.seq])
      byVariantKey.set(key, {
        variantKey: key,
        stopSeqsByStopId,
        terminusSeq: rs.seq,
      })
    } else {
      const seqs = existing.stopSeqsByStopId.get(stopId)
      if (seqs) {
        // Insert in sorted order
        const insertIdx = seqs.findIndex((s) => s > rs.seq)
        if (insertIdx === -1) {
          seqs.push(rs.seq)
        } else {
          seqs.splice(insertIdx, 0, rs.seq)
        }
      } else {
        existing.stopSeqsByStopId.set(stopId, [rs.seq])
      }
      if (rs.seq > existing.terminusSeq) existing.terminusSeq = rs.seq
    }
  }

  return byVariantKey
}

export async function getCachedKmbVariantStops(fetchRouteStops: () => Promise<KmbRouteStopLite[]>) {
  const now = Date.now()
  if (cachedVariantStops && cachedVariantStops.expiresAtMs > now) {
    return cachedVariantStops.byVariantKey
  }

  if (inFlightVariantStops) {
    return await inFlightVariantStops
  }

  inFlightVariantStops = (async () => {
    try {
      const routeStops = await fetchRouteStops()
      const byVariantKey = computeKmbRouteVariantStops(routeStops)

      const ttlSeconds = secondsUntilNextKmbDailyUpdate()
      cachedVariantStops = {
        expiresAtMs: now + ttlSeconds * 1000,
        byVariantKey,
      }

      return byVariantKey
    } finally {
      inFlightVariantStops = null
    }
  })()

  return await inFlightVariantStops
}

export function kmbFareCacheControlHeader() {
  return kmbDailyCacheControlHeader(secondsUntilNextKmbDailyUpdate())
}

/**
 * Family variants in deterministic order (smallest key first, matching
 * findRouteEntryByFamily) for callers without a gtfsId, so legacy lookups
 * resolve to the smallest gtfsId.
 */
function familyVariants(
  byVariantStops: Map<VariantKey, VariantStops>,
  family: { co: string; route: string; bound: string; serviceType: string }
): Array<{ key: VariantKey; variant: VariantStops }> {
  const prefix = `${String(family.co ?? 'kmb')}|${normalizeRouteName(family.route)}|${String(
    family.bound ?? ''
  )}|${String(family.serviceType ?? '')}|`
  const out: Array<{ key: VariantKey; variant: VariantStops }> = []
  for (const [key, variant] of byVariantStops) {
    if (key !== prefix.slice(0, -1) && !key.startsWith(prefix)) continue
    out.push({ key, variant })
  }
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  return out
}

/**
 * Family variant holding a stop when the caller has no gtfsId: among the
 * variants whose stop set contains the stop, prefer the one with the most
 * occurrences (circular-stop leg info lives there), breaking ties by
 * smallest key for determinism. A boarding stop served only by a
 * non-smallest variant (e.g. KMB branch workings with distinct gtfsIds)
 * still resolves instead of losing its fare. Falls back to the smallest
 * variant when no set contains the stop.
 */
function findVariantByFamilyStop(
  byVariantStops: Map<VariantKey, VariantStops>,
  family: { co: string; route: string; bound: string; serviceType: string },
  stopId: string
): { key: VariantKey; variant: VariantStops } | undefined {
  const cands = familyVariants(byVariantStops, family)
  if (cands.length === 0) return undefined
  const stop = String(stopId ?? '').trim()
  const holding = cands.filter((c) => c.variant.stopSeqsByStopId.has(stop))
  if (holding.length === 0) return cands[0]
  holding.sort((a, b) => {
    const countA = a.variant.stopSeqsByStopId.get(stop)?.length ?? 0
    const countB = b.variant.stopSeqsByStopId.get(stop)?.length ?? 0
    if (countA !== countB) return countB - countA
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })
  return holding[0]
}

/** gtfsId segment of a five-segment variant key. */
function variantKeyGtfsId(key: VariantKey): string {
  return key.split('|')[4] ?? ''
}

/**
 * Get fare from current stop to terminus using hk-bus-eta data.
 * The fare arrays in hk-bus-eta are indexed by stop sequence (0-indexed),
 * where each entry represents the fare from that stop to the terminus.
 */
export function getStopToTerminusFare(params: {
  co: string
  route: string
  dir: string
  serviceType: string
  gtfsId?: string
  stopId: string
  // For disambiguation: KMB ETA provides destination strings; use them if possible.
  etaDestCandidates?: string[]
  byVariantStops: Map<VariantKey, VariantStops>
  routeVariantIndex: Map<string, RouteListEntry>
}): KmbFareInfo | null {
  const routeName = normalizeRouteName(params.route)
  const key = variantKey(params.co, routeName, params.dir, params.serviceType, params.gtfsId)
  let variant = params.byVariantStops.get(key)
  // Resolve the fare table against the variant actually used: without a
  // gtfsId the caller may land on any region of the family, and each
  // region has its own fare array indexed by its own sequences.
  let resolvedGtfsId = normalizeGtfsId(params.gtfsId)
  if (!variant) {
    const picked = findVariantByFamilyStop(
      params.byVariantStops,
      {
        co: params.co,
        route: routeName,
        bound: params.dir,
        serviceType: params.serviceType,
      },
      params.stopId
    )
    variant = picked?.variant
    if (picked) resolvedGtfsId = variantKeyGtfsId(picked.key)
  }
  if (!variant) return null

  const seqs = variant.stopSeqsByStopId.get(String(params.stopId ?? '').trim())
  // Use the first (smallest) sequence for fare calculation - this is the "departing" occurrence
  const onSeq = seqs?.[0]
  if (!onSeq) return null

  const entry =
    params.routeVariantIndex.get(
      routeVariantKey({
        co: params.co as Company,
        route: routeName,
        bound: params.dir,
        serviceType: params.serviceType,
        gtfsId: resolvedGtfsId,
      })
    ) ??
    findRouteEntryByFamily(params.routeVariantIndex, {
      co: params.co as Company,
      route: routeName,
      bound: params.dir,
      serviceType: params.serviceType,
    })

  if (!entry) return null

  // fares array is 0-indexed, so subtract 1 from the 1-indexed sequence
  const fareIndex = onSeq - 1
  const fares = Array.isArray(entry.fares)
    ? entry.fares
    : entry.fares && typeof entry.fares === 'object'
      ? (entry.fares as Record<string, string[] | undefined>)[params.co]
      : undefined

  if (!fares || fareIndex < 0 || fareIndex >= fares.length) return null

  const fareStr = fares[fareIndex]
  if (!fareStr) return null

  const fare = Number(fareStr)
  if (!Number.isFinite(fare) || fare < 0) return null

  return {
    hkd: fare,
    source: 'hk-bus-eta',
  }
}

/**
 * Determine which "leg" an ETA entry belongs to for circular routes or routes
 * where a stop appears multiple times.
 *
 * Returns:
 * - "A" if the entry's seq is closer to the first (smallest) occurrence of the stop
 * - "B" if the entry's seq is closer to the last (largest) occurrence of the stop
 * - null if the stop only appears once (no leg disambiguation needed)
 */
export function computeEtaLeg(params: {
  co: string
  route: string
  dir: string
  serviceType: string
  gtfsId?: string
  stopId: string
  etaSeq: number
  byVariantStops: Map<VariantKey, VariantStops>
}): 'A' | 'B' | null {
  const routeName = normalizeRouteName(params.route)
  const key = variantKey(params.co, routeName, params.dir, params.serviceType, params.gtfsId)
  const variant =
    params.byVariantStops.get(key) ??
    findVariantByFamilyStop(
      params.byVariantStops,
      {
        co: params.co,
        route: routeName,
        bound: params.dir,
        serviceType: params.serviceType,
      },
      params.stopId
    )?.variant
  if (!variant) return null

  const seqs = variant.stopSeqsByStopId.get(String(params.stopId ?? '').trim())
  if (!seqs || seqs.length < 2) return null

  const seqA = seqs[0] // smallest (first occurrence)
  const seqB = seqs[seqs.length - 1] // largest (last occurrence)

  const distA = Math.abs(params.etaSeq - seqA)
  const distB = Math.abs(params.etaSeq - seqB)

  return distA <= distB ? 'A' : 'B'
}

export { type VariantKey }
