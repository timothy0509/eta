import type { KmbRouteStopLite } from '@/lib/eta/client'
import { getEtaDbIndexes } from '@/lib/eta/hk-bus-eta'
import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from '@/lib/eta/kmb-cache'

export type KmbFareInfo = {
  hkd: number
  dayCode?: number
  source: 'hk-bus-eta'
}

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

  const routeStops = await fetchRouteStops()
  const byVariantKey = computeKmbRouteVariantStops(routeStops)

  const ttlSeconds = secondsUntilNextKmbDailyUpdate()
  cachedVariantStops = {
    expiresAtMs: now + ttlSeconds * 1000,
    byVariantKey,
  }

  return byVariantKey
}

export function kmbFareCacheControlHeader() {
  return kmbDailyCacheControlHeader(secondsUntilNextKmbDailyUpdate())
}

/**
 * Get fare from current stop to terminus using hk-bus-eta data.
 * The fare arrays in hk-bus-eta are indexed by stop sequence (0-indexed),
 * where each entry represents the fare from that stop to the terminus.
 */
export async function getStopToTerminusFare(params: {
  co: string
  route: string
  dir: string
  serviceType: string
  stopId: string
  // For disambiguation: KMB ETA provides destination strings; use them if possible.
  etaDestCandidates?: string[]
  byVariantStops: Map<VariantKey, VariantStops>
}): Promise<KmbFareInfo | null> {
  const routeName = normalizeRouteName(params.route)
  const key = variantKey(params.co, routeName, params.dir, params.serviceType)
  const variant = params.byVariantStops.get(key)
  if (!variant) return null

  const seqs = variant.stopSeqsByStopId.get(String(params.stopId ?? '').trim())
  // Use the first (smallest) sequence for fare calculation - this is the "departing" occurrence
  const onSeq = seqs?.[0]
  if (!onSeq) return null

  // Get fare from hk-bus-eta
  const { kmbRouteListEntries } = await getEtaDbIndexes()
  const bound = String(params.dir ?? '')
  const serviceType = String(params.serviceType ?? '')

  const entry = kmbRouteListEntries.find(
    (item: { route: string; serviceType: string; bound: Record<string, string>; co: string[] }) => {
      if (!item.co?.includes(params.co as string)) return false
      if (item.route.toUpperCase() !== routeName) return false
      if (String(item.serviceType) !== serviceType) return false
      const itemBound = String(item.bound?.[params.co] ?? '')
      const normalizedBound = bound === 'I' || bound === 'O' ? bound : ''
      if (normalizedBound) return itemBound === normalizedBound
      return itemBound === '' || itemBound === bound
    }
  )

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
