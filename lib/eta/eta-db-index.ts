import type { Company, EtaDb, RouteListEntry } from 'hk-bus-eta'

export type KmbStopSearchItem = {
  stopId: string
  nameEn: string
  nameTc: string
  nameSc: string
  lat: number
  lng: number
}

export type KmbRouteStopLite = {
  co: Company
  route: string
  bound: 'I' | 'O' | string
  serviceType: string
  seq: number
  stopId: string
}

export type KmbRouteInfoLite = {
  co: Company
  route: string
  bound: 'I' | 'O' | string
  serviceType: string
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
}

export type RouteVariantKey = {
  co: Company
  route: string
  bound: string
  serviceType: string
}

export function routeVariantKey(k: RouteVariantKey): string {
  return `${k.co}|${k.route.toUpperCase()}|${k.bound}|${k.serviceType}`
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
}): string {
  return `${params.co}|${params.route.toUpperCase()}|${normalizeBound(params.bound)}|${String(
    params.serviceType ?? ''
  )}|${normalizeStopId(params.stopId)}`
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
        return stops.map((stopId, idx) => {
          const normalizedStopId = normalizeStopId(stopId)
          const seqKey = routeStopSeqKey({
            co,
            route: entry.route,
            bound,
            serviceType: entry.serviceType,
            stopId: normalizedStopId,
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
          }
        })
      })
  )

  await yieldToMain()

  const busStopIds = new Set(kmbRouteStops.map((entry) => entry.stopId).filter(Boolean))
  const kmbStops = Object.entries(db.stopList)
    .map(([stopId, stop]) => ({
      stopId: normalizeStopId(stopId),
      nameEn: (stop.name.en ?? '').trim(),
      nameTc: (stop.name.zh ?? '').trim(),
      nameSc: (stop.name.zh ?? '').trim(),
      lat: stop.location.lat,
      lng: stop.location.lng,
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
      const variantKey = routeVariantKey({
        co,
        route: entry.route,
        bound,
        serviceType: entry.serviceType,
      })
      if (!routeVariantIndex.has(variantKey)) {
        routeVariantIndex.set(variantKey, entry)
      }
      for (const stopId of stops) {
        const key = normalizeStopId(stopId)
        if (!key) continue
        const candidateKey = variantKey
        const seen = stationToRouteDedup.get(key) ?? new Set<string>()
        if (seen.has(candidateKey)) continue
        seen.add(candidateKey)
        stationToRouteDedup.set(key, seen)
        const list = stationToRouteIndex.get(key) ?? []
        list.push({ entry, co })
        stationToRouteIndex.set(key, list)
      }
      stops.forEach((stopId, idx) => {
        const key = normalizeStopId(stopId)
        if (!key) return
        const routeList = stopRoutesIndex.get(key) ?? []
        routeList.push({
          stopId: key,
          co,
          route: entry.route,
          bound,
          serviceType: entry.serviceType,
          seq: idx,
        })
        stopRoutesIndex.set(key, routeList)
      })
    }
    processed += 1
    if (processed % CHUNK_SIZE === 0) {
      await yieldToMain()
    }
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
