import { fetchEtas } from 'hk-bus-eta'
import type { Company, Eta, EtaDb, RouteListEntry } from 'hk-bus-eta'

import { idbGet, idbSet } from '@/lib/eta/cache/idb'
import { ETA_DB_CACHE_KEY, ETA_DB_INDEX_KEY, ETA_DB_MD5_KEY } from '@/lib/eta/cache/keys'
import { CACHE_POLICIES, createMetaForPolicy, isFresh } from '@/lib/eta/cache/policy'
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
  serializeEtaDbIndexes,
  deserializeEtaDbIndexes,
  type EtaDbIndexes,
  type KmbRouteInfoLite,
  type KmbRouteStopLite,
  type KmbStopSearchItem,
  type SerializedEtaDbIndexes,
} from '@/lib/eta/eta-db-index'
import { fetchJson } from '@/lib/eta/http'
import { lrtStopIdsEqual, stationIdToLrtStopId } from '@/lib/eta/lrt-stop-id'
import type { UiLanguage } from '@/lib/eta/types'

const KMB_STOP_ETA_URL = 'https://data.etabus.gov.hk/v1/transport/kmb/stop-eta'

type OfficialKmbStopEta = {
  co: string
  route: string
  dir: string
  service_type: number | string
  seq: number
  dest_tc: string
  dest_sc: string
  dest_en: string
  eta_seq: number
  eta: string | null
  rmk_tc: string
  rmk_sc: string
  rmk_en: string
  data_timestamp: string
}

type OfficialStopEtaResponse = {
  data: OfficialKmbStopEta[]
}

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
let inFlightIndexes: Promise<EtaDbIndexes> | null = null

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

  const [stored, storedMd5] = await Promise.all([
    idbGet<EtaDbCacheValue>(ETA_DB_CACHE_KEY),
    idbGet<string>(ETA_DB_MD5_KEY),
  ])
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

  if (inFlightIndexes) {
    return await inFlightIndexes
  }

  inFlightIndexes = (async () => {
    try {
      // Try loading pre-built indexes from IDB
      const stored = await idbGet<SerializedEtaDbIndexes>(ETA_DB_INDEX_KEY)
      if (stored?.value && isFresh(stored)) {
        const indexes = deserializeEtaDbIndexes(stored.value)
        cachedIndexes = { md5, value: indexes }
        return indexes
      }

      // Rebuild from scratch
      const value = await buildEtaDbIndexes(db, { busCompanies: BUS_COMPANIES })
      cachedIndexes = { md5, value }

      // Persist to IDB (fire-and-forget)
      const meta = createMetaForPolicy(ETA_DB_POLICY)
      idbSet(ETA_DB_INDEX_KEY, { value: serializeEtaDbIndexes(value), ...meta }).catch(() => {})

      return value
    } finally {
      inFlightIndexes = null
    }
  })()

  return await inFlightIndexes
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
  const { routeVariantIndex } = await getEtaDbIndexes()
  const routeName = params.route.toUpperCase()
  const bound = normalizeBound(params.bound)
  const serviceType = String(params.serviceType ?? '')
  const co = (params.co ?? 'kmb') as Company

  const entry = routeVariantIndex.get(
    routeVariantKey({
      co,
      route: routeName,
      bound,
      serviceType,
    })
  )

  if (!entry || !entry.co.includes(co)) return null

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
  data_timestamp?: string
  dest_tc?: string
  dest_sc?: string
  dest_en?: string
  rmk_tc?: string
  rmk_sc?: string
  rmk_en?: string
}

/**
 * Fetch all ETAs at a stop via the official KMB Stop ETA API (one call per stop).
 * https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/{stop_id}
 */
export async function fetchKmbEtasForStop(params: {
  stopId: string
  route?: string
  serviceType?: string
  language: UiLanguage
}): Promise<KmbEta[]> {
  const stopId = normalizeStopId(params.stopId)
  if (!stopId) return [] as KmbEta[]

  const routeFilter = params.route ? params.route.toUpperCase() : null
  const serviceType = params.serviceType ? String(params.serviceType) : null

  const payload = await fetchJson<OfficialStopEtaResponse>(
    `${KMB_STOP_ETA_URL}/${encodeURIComponent(stopId)}`
  )
  const rows = Array.isArray(payload.data) ? payload.data : []

  const deduped = new Map<string, KmbEta>()
  for (const entry of rows) {
    const route = String(entry.route ?? '')
    if (routeFilter && route.toUpperCase() !== routeFilter) continue
    if (serviceType && String(entry.service_type) !== serviceType) continue

    const co = String(entry.co ?? 'kmb').toLowerCase() as Company
    const dir = normalizeBound(entry.dir)
    const entryServiceType = String(entry.service_type ?? '')
    const etaSeq = Number(entry.eta_seq) || 0
    const eta = entry.eta ?? ''
    const key = `${co}|${route}|${dir}|${entryServiceType}|${etaSeq}|${eta}`
    if (deduped.has(key)) continue

    deduped.set(key, {
      eta,
      co,
      route,
      dir,
      serviceType: entryServiceType,
      seq: Number(entry.seq) || 0,
      etaSeq,
      dest: { en: entry.dest_en ?? '', zh: entry.dest_tc ?? '' },
      remark: { en: entry.rmk_en ?? '', zh: entry.rmk_tc ?? '' },
      data_timestamp: entry.data_timestamp,
      dest_en: entry.dest_en ?? '',
      dest_tc: entry.dest_tc ?? '',
      dest_sc: entry.dest_sc ?? '',
      rmk_en: entry.rmk_en ?? '',
      rmk_tc: entry.rmk_tc ?? '',
      rmk_sc: entry.rmk_sc ?? '',
    })
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
  const stopId = stationIdToLrtStopId(params.stationId)
  if (!stopId) return []

  const entry = lrtRoutes.find((item) => {
    if (item.route.toUpperCase() !== route) return false
    if (String(item.serviceType) !== serviceType) return false
    return normalizeBound(item.bound.lightRail) === bound
  })

  if (!entry) return []
  const stops = entry.stops.lightRail ?? []
  const seq = stops.findIndex((id) => lrtStopIdsEqual(id, stopId))
  if (seq < 0) return []

  return await fetchEtas({
    ...entry,
    seq,
    language: toHkBusEtaLanguage(params.language),
  })
}
