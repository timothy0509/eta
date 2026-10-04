import type { Company, EtaDb, RouteListEntry } from 'hk-bus-eta'

import type { KmbStopSearchItem } from '@/lib/eta/types'

export type { KmbStopSearchItem }

export type KmbRouteStopLite = {
  co: Company
  route: string
  bound: 'I' | 'O' | string
  serviceType: string
  seq: number
  stopId: string
  /** GMB region identifier. Empty for other operators. Same number can mean
   *  three routes (HK Island, Kowloon, NT), distinguished by gtfsId. */
  gtfsId?: string
}

export type KmbRouteInfoLite = {
  co: Company
  route: string
  bound: 'I' | 'O' | string
  serviceType: string
  /** GMB region identifier, see KmbRouteStopLite. */
  gtfsId?: string
  origin: {
    en: string
    tc: string
    sc: string
  }
  destination: {
    en: string
    tc: string
    sc: string
  }
  routeEntry: RouteListEntry
}

type BusRouteCandidate = {
  entry: RouteListEntry
  co: Company
}

export type StopRouteEntry = {
  stopId: string
  co: Company
  route: string
  bound: string
  serviceType: string
  seq: number
  gtfsId?: string
}

export type RouteVariantKey = {
  co: Company
  route: string
  bound: string
  serviceType: string
  /** Only set for GMB. Other operators keep the legacy 4-part key. */
  gtfsId?: string
}

export function isGmbCompany(co: unknown): boolean {
  return String(co ?? '').toLowerCase() === 'gmb'
}

export function normalizeGtfsId(gtfsId: unknown): string {
  return String(gtfsId ?? '').trim()
}

export function routeVariantKey(k: RouteVariantKey): string {
  const base = `${k.co}|${k.route.toUpperCase()}|${k.bound}|${k.serviceType}`
  if (isGmbCompany(k.co)) {
    const gtfsId = normalizeGtfsId(k.gtfsId)
    if (gtfsId) return `${base}|${gtfsId}`
  }
  return base
}

/** Parse a variant key back into parts. GMB keys carry a 5th gtfsId part. */
export function parseRouteVariantKey(key: string): {
  co: string
  route: string
  bound: string
  serviceType: string
  gtfsId: string
} {
  const parts = String(key ?? '').split('|')
  const [co = '', route = '', bound = '', serviceType = ''] = parts
  const gtfsId = isGmbCompany(co) && parts.length > 4 ? (parts[4] ?? '') : ''
  return { co, route, bound, serviceType, gtfsId }
}

export type EtaDbIndexes = {
  kmbRouteListEntries: RouteListEntry[]
  kmbStops: KmbStopSearchItem[]
  kmbRouteStops: KmbRouteStopLite[]
  mtrRoutes: RouteListEntry[]
  lrtRoutes: RouteListEntry[]
  stationToRouteIndex: Map<string, BusRouteCandidate[]>
  /** O(1) lookup for stop sequence (0-indexed) by route variant + stopId. */
  routeStopSeqIndex: Map<string, number>
  /** Consolidated index: stopId → route variants with pre-computed sequences. */
  stopRoutesIndex: Map<string, StopRouteEntry[]>
  /** Route variant key → RouteListEntry for fetching ETAs. */
  routeVariantIndex: Map<string, RouteListEntry>
}

export type BuildEtaDbIndexesOptions = {
  busCompanies: Company[]
}

export function normalizeBound(bound?: string | null): 'I' | 'O' | string {
  if (!bound) return ''
  return bound === 'I' || bound === 'O' ? bound : bound
}

export function normalizeStopId(stopId: string): string {
  return String(stopId ?? '').trim()
}

export function routeStopSeqKey(params: {
  co: Company
  route: string
  bound: string
  serviceType: string
  stopId: string
  gtfsId?: string
}): string {
  const base = `${params.co}|${params.route.toUpperCase()}|${normalizeBound(params.bound)}|${String(
    params.serviceType ?? ''
  )}`
  const suffix = isGmbCompany(params.co) ? `|${normalizeGtfsId(params.gtfsId)}` : ''
  return `${base}${suffix}|${normalizeStopId(params.stopId)}`
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const CHUNK_SIZE = 500

export async function buildEtaDbIndexes(
  db: EtaDb,
  options: BuildEtaDbIndexesOptions
): Promise<EtaDbIndexes> {
  const { busCompanies } = options

  const kmbRouteListEntries = Object.values(db.routeList).filter((entry) =>
    entry.co.some((co) => busCompanies.includes(co) && entry.stops[co]?.length)
  )

  const routeStopSeqIndex = new Map<string, number>()
  const kmbRouteStops: KmbRouteStopLite[] = kmbRouteListEntries.flatMap((entry) =>
    entry.co
      .filter((co) => busCompanies.includes(co))
      .flatMap((co) => {
        const stops = entry.stops[co] ?? []
        const bound = normalizeBound(entry.bound[co])
        const gtfsId = isGmbCompany(co) ? normalizeGtfsId(entry.gtfsId) : ''
        return stops.map((stopId, idx) => {
          const normalizedStopId = normalizeStopId(stopId)
          const seqKey = routeStopSeqKey({
            co,
            route: entry.route,
            bound,
            serviceType: entry.serviceType,
            stopId: normalizedStopId,
            gtfsId,
          })
          if (normalizedStopId && !routeStopSeqIndex.has(seqKey)) {
            routeStopSeqIndex.set(seqKey, idx)
          }
          return {
            co,
            route: entry.route,
            bound,
            serviceType: entry.serviceType,
            seq: idx + 1,
            stopId: normalizedStopId,
            gtfsId,
          }
        })
      })
  )

  await yieldToMain()

  const busStopIds = new Set(kmbRouteStops.map((entry) => entry.stopId).filter(Boolean))
  const kmbStops: KmbStopSearchItem[] = Object.entries(db.stopList)
    .map(([stopId, stop]) => ({
      stopId: normalizeStopId(stopId),
      nameEn: (stop.name.en ?? '').trim(),
      nameTc: (stop.name.zh ?? '').trim(),
      nameSc: (stop.name.zh ?? '').trim(),
      lat: stop.location.lat,
      lng: stop.location.lng,
      isKmb: false,
    }))
    .filter((s) => s.stopId && s.nameEn && busStopIds.has(s.stopId))

  await yieldToMain()

  const mtrRoutes = Object.values(db.routeList).filter((entry) => entry.co.includes('mtr'))
  const lrtRoutes = Object.values(db.routeList).filter((entry) => entry.co.includes('lightRail'))

  const stationToRouteIndex = new Map<string, BusRouteCandidate[]>()
  const stationToRouteDedup = new Map<string, Set<string>>()
  const stopRoutesIndex = new Map<string, StopRouteEntry[]>()
  const routeVariantIndex = new Map<string, RouteListEntry>()

  let processed = 0
  for (const entry of kmbRouteListEntries) {
    for (const co of entry.co) {
      if (!busCompanies.includes(co)) continue
      const stops = entry.stops[co] ?? []
      const bound = normalizeBound(entry.bound[co])
      const gtfsId = isGmbCompany(co) ? normalizeGtfsId(entry.gtfsId) : ''
      const variantKey = routeVariantKey({
        co,
        route: entry.route,
        bound,
        serviceType: entry.serviceType,
        gtfsId,
      })
      if (!routeVariantIndex.has(variantKey)) {
        routeVariantIndex.set(variantKey, entry)
      }
      for (let idx = 0; idx < stops.length; idx++) {
        const stopId = stops[idx]
        const key = normalizeStopId(stopId)
        if (!key) continue
        const candidateKey = variantKey
        const seen = stationToRouteDedup.get(key) ?? new Set<string>()
        if (!seen.has(candidateKey)) {
          seen.add(candidateKey)
          stationToRouteDedup.set(key, seen)
          const list = stationToRouteIndex.get(key) ?? []
          list.push({ entry, co })
          stationToRouteIndex.set(key, list)
        }
        const routeList = stopRoutesIndex.get(key) ?? []
        routeList.push({
          stopId: key,
          co,
          route: entry.route,
          bound,
          serviceType: entry.serviceType,
          seq: idx,
          gtfsId,
        })
        stopRoutesIndex.set(key, routeList)
      }
    }
    processed += 1
    if (processed % CHUNK_SIZE === 0) {
      await yieldToMain()
    }
  }

  for (const stop of kmbStops) {
    stop.isKmb = (stopRoutesIndex.get(stop.stopId) ?? []).some((e) => e.co === 'kmb')
  }

  return {
    kmbRouteListEntries,
    kmbStops,
    kmbRouteStops,
    mtrRoutes,
    lrtRoutes,
    stationToRouteIndex,
    routeStopSeqIndex,
    stopRoutesIndex,
    routeVariantIndex,
  }
}

export type SerializedEtaDbIndexes = {
  kmbRouteListEntries: RouteListEntry[]
  kmbStops: KmbStopSearchItem[]
  kmbRouteStops: KmbRouteStopLite[]
  mtrRoutes: RouteListEntry[]
  lrtRoutes: RouteListEntry[]
  stationToRouteIndex: [string, BusRouteCandidate[]][]
  routeStopSeqIndex: [string, number][]
  stopRoutesIndex: [string, StopRouteEntry[]][]
  routeVariantIndex: [string, RouteListEntry][]
}

export function serializeEtaDbIndexes(indexes: EtaDbIndexes): SerializedEtaDbIndexes {
  return {
    kmbRouteListEntries: indexes.kmbRouteListEntries,
    kmbStops: indexes.kmbStops,
    kmbRouteStops: indexes.kmbRouteStops,
    mtrRoutes: indexes.mtrRoutes,
    lrtRoutes: indexes.lrtRoutes,
    stationToRouteIndex: Array.from(indexes.stationToRouteIndex.entries()),
    routeStopSeqIndex: Array.from(indexes.routeStopSeqIndex.entries()),
    stopRoutesIndex: Array.from(indexes.stopRoutesIndex.entries()),
    routeVariantIndex: Array.from(indexes.routeVariantIndex.entries()),
  }
}

export function deserializeEtaDbIndexes(serialized: SerializedEtaDbIndexes): EtaDbIndexes {
  return {
    kmbRouteListEntries: serialized.kmbRouteListEntries,
    kmbStops: serialized.kmbStops,
    kmbRouteStops: serialized.kmbRouteStops,
    mtrRoutes: serialized.mtrRoutes,
    lrtRoutes: serialized.lrtRoutes,
    stationToRouteIndex: new Map(serialized.stationToRouteIndex),
    routeStopSeqIndex: new Map(serialized.routeStopSeqIndex),
    stopRoutesIndex: new Map(serialized.stopRoutesIndex),
    routeVariantIndex: new Map(serialized.routeVariantIndex),
  }
}
