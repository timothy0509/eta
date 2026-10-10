import type { Company, RouteListEntry } from 'hk-bus-eta'

import type { KmbRouteStopLite } from '@/lib/eta/client'
import { routeVariantKey } from '@/lib/eta/eta-db-index'
import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from '@/lib/eta/kmb-cache'
import { resolveTdFullFare } from '@/lib/eta/td-bus'

export type KmbFareSource = 'hk-bus-eta' | 'td-full-fare'

export type KmbFareInfo = {
  hkd: number
  dayCode?: number
  source: KmbFareSource
}

/** Fare lookup result keyed by base variant key (`co|route|dir|serviceType`). */
export type KmbFaresByVariantKey = Record<string, KmbFareInfo>

type VariantKey = `${string}|${string}|${string}|${string}`

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

function variantKey(co: string, route: string, bound: string, serviceType: string): VariantKey {
  return `${String(co ?? 'kmb')}|${normalizeRouteName(route)}|${String(bound ?? '')}|${String(
    serviceType ?? ''
  )}`
}

export function computeKmbRouteVariantStops(routeStops: KmbRouteStopLite[]) {
  const byVariantKey = new Map<VariantKey, VariantStops>()

  for (const rs of routeStops) {
    const key = variantKey(rs.co, rs.route, rs.bound, rs.serviceType)
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
 * Get fare from current stop to terminus using hk-bus-eta data.
 * The fare arrays in hk-bus-eta are indexed by stop sequence (0-indexed),
 * where each entry represents the fare from that stop to the terminus.
 *
 * When the hk-bus-eta per-section lookup has nothing for the variant, falls
 * back to the Transport Department scheduled full-journey fare
 * (`source: 'td-full-fare'`). Callers label it as a full-journey fare
 * because it is not a per-section fare from this stop.
 */
export function getStopToTerminusFare(params: {
  co: string
  route: string
  dir: string
  serviceType: string
  stopId: string
  // For disambiguation: KMB ETA provides destination strings; use them if possible.
  etaDestCandidates?: string[]
  byVariantStops: Map<VariantKey, VariantStops>
  routeVariantIndex: Map<string, RouteListEntry>
}): KmbFareInfo | null {
  const routeName = normalizeRouteName(params.route)
  const key = variantKey(params.co, routeName, params.dir, params.serviceType)
  const variant = params.byVariantStops.get(key)
  if (!variant) return null

  const seqs = variant.stopSeqsByStopId.get(String(params.stopId ?? '').trim())
  // Use the first (smallest) sequence for fare calculation - this is the "departing" occurrence
  const onSeq = seqs?.[0]
  if (!onSeq) return null

  const entry = params.routeVariantIndex.get(
    routeVariantKey({
      co: params.co as Company,
      route: routeName,
      bound: params.dir,
      serviceType: params.serviceType,
    })
  )

  if (!entry) {
    return tdFullFareFallback(params)
  }

  // fares array is 0-indexed, so subtract 1 from the 1-indexed sequence
  const fareIndex = onSeq - 1
  const fares = Array.isArray(entry.fares)
    ? entry.fares
    : entry.fares && typeof entry.fares === 'object'
      ? (entry.fares as Record<string, string[] | undefined>)[params.co]
      : undefined

  if (!fares || fareIndex < 0 || fareIndex >= fares.length) {
    return tdFullFareFallback(params)
  }

  const fareStr = fares[fareIndex]
  if (!fareStr) {
    return tdFullFareFallback(params)
  }

  const fare = Number(fareStr)
  if (!Number.isFinite(fare) || fare < 0) {
    return tdFullFareFallback(params)
  }

  return {
    hkd: fare,
    source: 'hk-bus-eta',
  }
}

/**
 * Transport Department scheduled full-journey fare for the variant, used
 * only when the hk-bus-eta per-section fare lookup returns nothing.
 */
function tdFullFareFallback(params: {
  co: string
  route: string
  dir: string
  serviceType: string
}): KmbFareInfo | null {
  const fullFare = resolveTdFullFare({
    co: params.co,
    route: params.route,
    bound: params.dir,
    serviceType: params.serviceType,
  })
  if (fullFare === null) return null
  return { hkd: fullFare, source: 'td-full-fare' }
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
  stopId: string
  etaSeq: number
  byVariantStops: Map<VariantKey, VariantStops>
}): 'A' | 'B' | null {
  const routeName = normalizeRouteName(params.route)
  const key = variantKey(params.co, routeName, params.dir, params.serviceType)
  const variant = params.byVariantStops.get(key)
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
