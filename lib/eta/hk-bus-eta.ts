import { fetchEtaDb, fetchEtaDbMd5, fetchEtas } from 'hk-bus-eta'
import type { Company, Eta, EtaDb, RouteListEntry, StopList } from 'hk-bus-eta'

import { etaDbCache } from '@/lib/eta/cache'
import {
  buildEtaDbIndexes,
  normalizeBound,
  normalizeStopId,
  routeVariantKey,
  type EtaDbIndexes,
  type KmbRouteInfoLite,
  type KmbRouteStopLite,
  type KmbStopSearchItem,
} from '@/lib/eta/eta-db-index'
import type { UiLanguage } from '@/lib/eta/types'

type EtaDbCacheValue = {
  db: EtaDb
  md5: string
  fetchedAt: number
}

const ETA_DB_CACHE_KEY = 'hk-bus-eta:db'
const ETA_DB_MD5_KEY = 'hk-bus-eta:md5'
const ETA_DB_TTL_MS = 24 * 60 * 60 * 1000

let cachedIndexes: { md5: string; value: EtaDbIndexes } | null = null
let inFlightEtaDb: Promise<EtaDbCacheValue> | null = null

export type { EtaDbIndexes, KmbRouteInfoLite, KmbRouteStopLite, KmbStopSearchItem }

const BUS_COMPANIES: Company[] = [
  'kmb',
  'ctb',
  'nlb',
  'gmb',
  'lrtfeeder',
  'sunferry',
  'hkkf',
  'fortuneferry',
]

function isBusCompany(company: Company): boolean {
  return BUS_COMPANIES.includes(company)
}

export function toHkBusEtaLanguage(lang: UiLanguage): 'en' | 'zh' {
  if (lang === 'en') return 'en'
  return 'zh'
}

function mapEtaLangToUi(eta: { en: string; zh: string }) {
  return {
    en: eta.en ?? '',
    tc: eta.zh ?? '',
    sc: eta.zh ?? '',
  }
}

export async function getEtaDbIndexes(): Promise<EtaDbIndexes> {
  const db = await getEtaDbCached()
  const cachedMd5 = etaDbCache.get(ETA_DB_MD5_KEY) as string | undefined

  if (cachedIndexes && cachedMd5 && cachedIndexes.md5 === cachedMd5) {
    return cachedIndexes.value
  }

  const value = buildEtaDbIndexes(db, { busCompanies: BUS_COMPANIES })

  if (cachedMd5) {
    cachedIndexes = { md5: cachedMd5, value }
  }

  return value
}

export async function getEtaDbCached(): Promise<EtaDb> {
  const cached = etaDbCache.get(ETA_DB_CACHE_KEY) as EtaDbCacheValue | undefined
  if (cached) return cached.db

  if (inFlightEtaDb) {
    const payload = await inFlightEtaDb
    return payload.db
  }

  inFlightEtaDb = (async () => {
    try {
      const [db, md5] = await Promise.all([fetchEtaDb(), fetchEtaDbMd5()])
      const payload: EtaDbCacheValue = {
        db,
        md5,
        fetchedAt: Date.now(),
      }
      etaDbCache.set(ETA_DB_CACHE_KEY, payload, ETA_DB_TTL_MS)
      etaDbCache.set(ETA_DB_MD5_KEY, md5, ETA_DB_TTL_MS)
      return payload
    } finally {
      inFlightEtaDb = null
    }
  })()

  const payload = await inFlightEtaDb
  return payload.db
}

export async function listKmbStops(): Promise<KmbStopSearchItem[]> {
  const { kmbStops } = await getEtaDbIndexes()
  return kmbStops
}

export async function listKmbRoutes(): Promise<KmbRouteInfoLite[]> {
  const { kmbRouteListEntries } = await getEtaDbIndexes()
  return kmbRouteListEntries.flatMap((entry) =>
    entry.co
      .filter((co) => isBusCompany(co) && entry.stops[co]?.length)
      .map((co) => ({
        co,
        route: entry.route,
        bound: normalizeBound(entry.bound[co]),
        serviceType: entry.serviceType,
        origin: mapEtaLangToUi(entry.orig),
        destination: mapEtaLangToUi(entry.dest),
        routeEntry: entry,
      }))
  )
}

export async function listKmbRouteStops(): Promise<KmbRouteStopLite[]> {
  const { kmbRouteStops } = await getEtaDbIndexes()
  return kmbRouteStops
}

export async function findKmbRouteInfo(params: {
  co?: Company
  route: string
  bound: string
  serviceType: string
}): Promise<KmbRouteInfoLite | null> {
  const { kmbRouteListEntries } = await getEtaDbIndexes()
  const routeName = params.route.toUpperCase()
  const bound = normalizeBound(params.bound)
  const serviceType = String(params.serviceType ?? '')
  const co = (params.co ?? 'kmb') as Company

  const entry = kmbRouteListEntries.find((item) => {
    if (!item.co.includes(co)) return false
    if (item.route.toUpperCase() !== routeName) return false
    if (String(item.serviceType) !== serviceType) return false
    return normalizeBound(item.bound[co]) === bound
  })

  if (!entry) return null

  return {
    co,
    route: entry.route,
    bound: normalizeBound(entry.bound[co]),
    serviceType: entry.serviceType,
    origin: mapEtaLangToUi(entry.orig),
    destination: mapEtaLangToUi(entry.dest),
    routeEntry: entry,
  }
}

export type KmbEta = Eta & {
  co: Company
  route: string
  dir: string
  serviceType: string
  seq: number
  etaSeq: number
}

export async function fetchKmbEtasForStop(params: {
  stopId: string
  route?: string
  serviceType?: string
  language: UiLanguage
}): Promise<KmbEta[]> {
  const db = await getEtaDbCached()
  const { stopRoutesIndex, routeVariantIndex } = await getEtaDbIndexes()
  const stopId = normalizeStopId(params.stopId)
  const routeFilter = params.route ? params.route.toUpperCase() : null
  const serviceType = params.serviceType ? String(params.serviceType) : null
  const language = toHkBusEtaLanguage(params.language)

  const routeEntries = (stopRoutesIndex.get(stopId) ?? []).filter((e) => {
    if (routeFilter && e.route.toUpperCase() !== routeFilter) return false
    if (serviceType && String(e.serviceType) !== serviceType) return false
    return true
  })

  if (routeEntries.length === 0) return [] as KmbEta[]

  const candidateMap = new Map<string, { entry: RouteListEntry; co: Company; stopIndex: number }>()

  for (const re of routeEntries) {
    const variantKey = routeVariantKey({
      co: re.co,
      route: re.route,
      bound: re.bound,
      serviceType: re.serviceType,
    })
    const entry = routeVariantIndex.get(variantKey)
    if (!entry) continue
    const existing = candidateMap.get(variantKey)
    if (!existing || re.seq < existing.stopIndex) {
      candidateMap.set(variantKey, { entry, co: re.co, stopIndex: re.seq })
    }
  }

  const etas = await Promise.all(
    Array.from(candidateMap.values()).map(async ({ entry, co, stopIndex }) => {
      const result = await fetchEtas({
        ...entry,
        co: [co],
        seq: stopIndex,
        language,
        stopList: db.stopList as StopList,
        holidays: db.holidays,
        serviceDayMap: db.serviceDayMap,
      })
      return result.map((eta, idx) => ({
        ...eta,
        co: eta.co ?? co,
        route: entry.route,
        dir: normalizeBound(entry.bound[co]),
        serviceType: entry.serviceType,
        seq: stopIndex + 1,
        etaSeq: idx + 1,
      }))
    })
  )

  const flat = etas.flat()
  const deduped = new Map<string, KmbEta>()
  for (const eta of flat) {
    const key = `${eta.co}|${eta.route}|${eta.dir}|${eta.serviceType}|${eta.etaSeq}|${eta.eta ?? ''}`
    if (!deduped.has(key)) deduped.set(key, eta)
  }

  return Array.from(deduped.values())
}

export async function listMtrRoutes(): Promise<RouteListEntry[]> {
  const { mtrRoutes } = await getEtaDbIndexes()
  return mtrRoutes
}

export async function listLrtRoutes(): Promise<RouteListEntry[]> {
  const { lrtRoutes } = await getEtaDbIndexes()
  return lrtRoutes
}

export async function fetchMtrEtasForStop(params: {
  line: string
  sta: string
  bound: string
  serviceType: string
  language: UiLanguage
}): Promise<Eta[]> {
  const db = await getEtaDbCached()
  const { mtrRoutes } = await getEtaDbIndexes()
  const line = params.line.toUpperCase()
  const sta = params.sta.toUpperCase()
  const bound = String(params.bound ?? '')
  const serviceType = String(params.serviceType ?? '')
  const entry = mtrRoutes.find((item) => {
    if (item.route.toUpperCase() !== line) return false
    if (String(item.serviceType) !== serviceType) return false
    return String(item.bound.mtr ?? '') === bound
  })

  if (!entry) return []
  const stops = entry.stops.mtr ?? []
  const seq = stops.findIndex((stopId) => normalizeStopId(stopId) === sta)
  if (seq < 0) return []

  return await fetchEtas({
    ...entry,
    seq,
    language: toHkBusEtaLanguage(params.language),
    stopList: db.stopList as StopList,
    holidays: db.holidays,
    serviceDayMap: db.serviceDayMap,
  })
}

export async function fetchLrtEtasForStop(params: {
  route: string
  bound: string
  serviceType: string
  stationId: string
  language: UiLanguage
}): Promise<Eta[]> {
  const db = await getEtaDbCached()
  const { lrtRoutes } = await getEtaDbIndexes()
  const route = params.route.toUpperCase()
  const bound = normalizeBound(params.bound)
  const serviceType = String(params.serviceType ?? '')
  const stopId = `LR${String(params.stationId).padStart(3, '0')}`

  const entry = lrtRoutes.find((item) => {
    if (item.route.toUpperCase() !== route) return false
    if (String(item.serviceType) !== serviceType) return false
    return normalizeBound(item.bound.lightRail) === bound
  })

  if (!entry) return []
  const stops = entry.stops.lightRail ?? []
  const seq = stops.findIndex((id) => normalizeStopId(id) === stopId)
  if (seq < 0) return []

  return await fetchEtas({
    ...entry,
    seq,
    language: toHkBusEtaLanguage(params.language),
    stopList: db.stopList as StopList,
    holidays: db.holidays,
    serviceDayMap: db.serviceDayMap,
  })
}

/**
 * Get fare for a specific route variant from hk-bus-eta data.
 * Fares array index corresponds to stop sequence (0-indexed).
 */
export async function getKmbFareFromEtaDb(params: {
  route: string
  bound: string
  serviceType: string
  stopSeq: number
  isHoliday?: boolean
}): Promise<{ hkd: number; source: string } | null> {
  const { kmbRouteListEntries } = await getEtaDbIndexes()
  const routeName = params.route.toUpperCase()
  const bound = normalizeBound(params.bound)
  const serviceType = String(params.serviceType ?? '')
  const stopSeq = params.stopSeq - 1 // Convert to 0-indexed

  const entry = kmbRouteListEntries.find((item) => {
    if (item.route.toUpperCase() !== routeName) return false
    if (String(item.serviceType) !== serviceType) return false
    return normalizeBound(item.bound.kmb) === bound
  })

  if (!entry) return null

  const fares = params.isHoliday ? entry.faresHoliday : entry.fares
  if (!fares || stopSeq < 0 || stopSeq >= fares.length) return null

  const fareStr = fares[stopSeq]
  if (!fareStr) return null

  const fare = Number(fareStr)
  if (!Number.isFinite(fare) || fare < 0) return null

  return {
    hkd: fare,
    source: 'hk-bus-eta',
  }
}
