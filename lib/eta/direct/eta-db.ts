import { fetchEtas } from 'hk-bus-eta'
import type { Company, Eta, EtaDb, RouteListEntry } from 'hk-bus-eta'

import { idbGet } from '@/lib/eta/cache/idb'
import { ETA_DB_CACHE_KEY, ETA_DB_MD5_KEY } from '@/lib/eta/cache/keys'
import { CACHE_POLICIES, isFresh } from '@/lib/eta/cache/policy'
import { MicroCache } from '@/lib/eta/cache/micro-cache'
import {
  getEtaDbSnapshot,
  type EtaDbCacheValue as SnapshotValue,
} from '@/lib/eta/direct/eta-db-list'
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

type EtaDbCacheValue = SnapshotValue

export type { EtaDbIndexes, KmbRouteInfoLite, KmbRouteStopLite, KmbStopSearchItem }

const ETA_DB_POLICY = CACHE_POLICIES.etaDb
const etaDbCache = new MicroCache<EtaDbCacheValue>({
  ttlMs: ETA_DB_POLICY.ttlMs,
  maxSize: 2,
})
const etaDbMd5Cache = new MicroCache<string>({
  ttlMs: ETA_DB_POLICY.ttlMs,
  maxSize: 2,
})

let cachedIndexes: { md5: string; value: EtaDbIndexes } | null = null

const BUS_COMPANIES = [
  'kmb',
  'ctb',
  'nlb',
  'nwfb',
  'gmb',
  'lrtfeeder',
  'lightRail',
  'mtr',
] as Company[]

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

async function getEtaDbRecord(): Promise<EtaDbCacheValue> {
  const memory = etaDbCache.get(ETA_DB_CACHE_KEY)
  if (memory) return memory

  const stored = await idbGet<EtaDbCacheValue>(ETA_DB_CACHE_KEY)
  const storedMd5 = await idbGet<string>(ETA_DB_MD5_KEY)
  const storedValue = stored?.value ?? null
  const storedIsFresh = stored ? isFresh(stored) : false

  if (storedValue && storedIsFresh) {
    etaDbCache.set(ETA_DB_CACHE_KEY, storedValue)
    if (storedMd5?.value) {
      etaDbMd5Cache.set(ETA_DB_MD5_KEY, storedMd5.value)
    }
    return storedValue
  }

  try {
    const payload = await getEtaDbSnapshot()
    etaDbCache.set(ETA_DB_CACHE_KEY, payload)
    etaDbMd5Cache.set(ETA_DB_MD5_KEY, payload.md5)
    return payload
  } catch (error) {
    if (storedValue) return storedValue
    throw error
  }
}

export async function getEtaDbCached(): Promise<EtaDb> {
  const record = await getEtaDbRecord()
  return record.db
}

export async function getEtaDbMd5Cached(): Promise<string> {
  const memory = etaDbMd5Cache.get(ETA_DB_MD5_KEY)
  if (memory) return memory
  const stored = await idbGet<string>(ETA_DB_MD5_KEY)
  if (stored?.value && isFresh(stored)) {
    etaDbMd5Cache.set(ETA_DB_MD5_KEY, stored.value)
    return stored.value
  }
  const record = await getEtaDbRecord()
  etaDbMd5Cache.set(ETA_DB_MD5_KEY, record.md5)
  return record.md5
}

export async function getEtaDbIndexes(): Promise<EtaDbIndexes> {
  const [db, md5] = await Promise.all([getEtaDbCached(), getEtaDbMd5Cached()])

  if (cachedIndexes && cachedIndexes.md5 === md5) {
    return cachedIndexes.value
  }

  const value = await buildEtaDbIndexes(db, { busCompanies: BUS_COMPANIES })

  cachedIndexes = { md5, value }
  return value
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
  })
}

export async function fetchLrtEtasForStop(params: {
  route: string
  bound: string
  serviceType: string
  stationId: string
  language: UiLanguage
}): Promise<Eta[]> {
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
  })
}
