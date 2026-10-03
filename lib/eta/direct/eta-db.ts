import { fetchEtas } from 'hk-bus-eta'
import type { Company, Eta, EtaDb, RouteListEntry } from 'hk-bus-eta'

import { idbGet, idbSet } from '@/lib/eta/cache/idb'
import {
  ETA_DB_CACHE_KEY,
  ETA_DB_INDEX_KEY,
  ETA_DB_MD5_KEY,
  lrtRouteEtaKey,
} from '@/lib/eta/cache/keys'
import { CACHE_POLICIES, createMetaForPolicy, isFresh } from '@/lib/eta/cache/policy'
import { MicroCache } from '@/lib/eta/cache/micro-cache'
import {
  getEtaDbSnapshot,
  type EtaDbCacheValue as SnapshotValue,
} from '@/lib/eta/direct/eta-db-list'
import {
  buildEtaDbIndexes,
  counterpartIds,
  directionKeyOf,
  normalizeBound,
  normalizeStopId,
  routeVariantKey,
  serializeEtaDbIndexes,
  deserializeEtaDbIndexes,
  variantMergeKey,
  type EtaDbIndexes,
  type KmbRouteInfoLite,
  type KmbRouteStopLite,
  type KmbStopSearchItem,
  type MergedDbEntry,
  type SerializedEtaDbIndexes,
} from '@/lib/eta/eta-db-index'
import { fetchJson, getAdaptiveConcurrency } from '@/lib/eta/http'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { promisePool } from '@/lib/eta/promise-pool'
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

function pickPrimaryOperator(operators: Company[]): Company {
  if (operators.includes('kmb' as Company)) return 'kmb' as Company
  if (operators.includes('ctb' as Company)) return 'ctb' as Company
  return [...operators].sort()[0] as Company
}

/**
 * One merged row per joint-route entry. Merging lives in
 * mergeRouteListEntries (route plus service type plus shared termini), so
 * this only maps display fields. The same physical direction can carry
 * opposite raw letters per operator, so the row carries the canonical bound.
 */
export async function listKmbRoutes(): Promise<KmbRouteInfoLite[]> {
  const { mergedDbEntries } = await getEtaDbIndexes()

  return mergedDbEntries.map((merged) => mergedToInfo(merged))
}

/** Joint-route stops for one merged variant, in display order (KMB seq first). */
export async function listMergedRouteStops(params: {
  directionKey: string
}): Promise<Array<{ stopId: string; seq: number }>>
export async function listMergedRouteStops(params: {
  route: string
  bound: string
  serviceType: string
}): Promise<Array<{ stopId: string; seq: number }>>
export async function listMergedRouteStops(
  params: { directionKey: string } | { route: string; bound: string; serviceType: string }
): Promise<Array<{ stopId: string; seq: number }>> {
  const { mergedVariantIndex } = await getEtaDbIndexes()
  const merged =
    'directionKey' in params
      ? mergedVariantIndex.get(params.directionKey)
      : findMergedByLetter(mergedVariantIndex, params.route, params.bound, params.serviceType)
  if (!merged) return []
  return merged.orderedStops.map((stopId, idx) => ({ stopId, seq: idx + 1 }))
}

/**
 * Legacy letter-based lookup: first merged entry whose display bound
 * matches. Only for call sites that still carry a raw letter (deep links,
 * old favorites). New code passes directionKey.
 */
function findMergedByLetter(
  mergedVariantIndex: Map<string, MergedDbEntry>,
  route: string,
  bound: string,
  serviceType: string
): MergedDbEntry | undefined {
  const routeName = String(route ?? '').toUpperCase()
  const st = String(serviceType ?? '')
  const letter = normalizeBound(bound)
  for (const merged of mergedVariantIndex.values()) {
    if (merged.entry.route.toUpperCase() !== routeName) continue
    if (String(merged.entry.serviceType ?? '') !== st) continue
    if (normalizeBound(merged.bound) === letter) return merged
  }
  return undefined
}

export async function listKmbRouteStops(): Promise<KmbRouteStopLite[]> {
  const { kmbRouteStops } = await getEtaDbIndexes()
  return kmbRouteStops
}

export async function findKmbRouteInfo(params: {
  directionKey: string
}): Promise<KmbRouteInfoLite | null>
export async function findKmbRouteInfo(params: {
  co?: Company
  route: string
  bound: string
  serviceType: string
}): Promise<KmbRouteInfoLite | null>
export async function findKmbRouteInfo(
  params:
    { directionKey: string } | { co?: Company; route: string; bound: string; serviceType: string }
): Promise<KmbRouteInfoLite | null> {
  const { mergedVariantIndex, routeVariantIndex } = await getEtaDbIndexes()

  if ('directionKey' in params) {
    const merged = mergedVariantIndex.get(params.directionKey)
    if (!merged) return null
    return mergedToInfo(merged)
  }

  // Legacy per-operator lookup. Prefer the merged entry whose stop set
  // contains the raw row's first stop: membership proves the physical
  // direction without comparing letters across operators.
  const routeName = params.route.toUpperCase()
  const serviceType = String(params.serviceType ?? '')
  const co = (params.co ?? 'kmb') as Company
  const bound = normalizeBound(params.bound)
  const rawKey = routeVariantKey({ co, route: routeName, bound, serviceType })
  const rawEntry = routeVariantIndex.get(rawKey)
  if (rawEntry) {
    const stopId = normalizeStopId((rawEntry.stops[co] ?? [])[0] ?? '')
    for (const merged of mergedVariantIndex.values()) {
      if (merged.entry.route.toUpperCase() !== routeName) continue
      if (String(merged.entry.serviceType ?? '') !== serviceType) continue
      const canon = merged.stopCanonById.get(stopId)
      if (canon && merged.orderedStops.includes(canon)) return mergedToInfo(merged)
    }
  }

  const entry = routeVariantIndex.get(rawKey)
  if (!entry || !entry.co.includes(co)) return null

  return {
    co,
    route: entry.route,
    bound: normalizeBound(entry.bound[co]),
    serviceType: entry.serviceType,
    variantKey: variantMergeKey({
      route: entry.route,
      serviceType: entry.serviceType,
      // Single-operator fallback: no merged entry exists. The variant is
      // identified by its own raw row so it still carries a stable key.
      directionKey: directionKeyOf(
        String(entry.route ?? '').toUpperCase(),
        String(entry.serviceType ?? ''),
        (entry.stops[co] ?? []).map((id) => normalizeStopId(id))
      ),
    }),
    origin: mapEtaLangToUi(entry.orig),
    destination: mapEtaLangToUi(entry.dest),
    routeEntry: entry,
  }
}

function mergedToInfo(merged: MergedDbEntry): KmbRouteInfoLite {
  const sorted = [...merged.operators].sort()
  const primary = pickPrimaryOperator(sorted)
  // Each operator keeps its own terminus strings from its own raw row.
  // The merged entry carries them; fall back to the primary row only for
  // operators without one (e.g. caches written before this existed).
  const primaryOrigin = mapEtaLangToUi(merged.entry.orig)
  const primaryDestination = mapEtaLangToUi(merged.entry.dest)
  const namesByOperator: Record<
    string,
    {
      origin: { en: string; tc: string; sc: string }
      destination: { en: string; tc: string; sc: string }
    }
  > = {}
  for (const op of sorted) {
    namesByOperator[String(op)] = merged.namesByOperator[String(op)] ?? {
      origin: primaryOrigin,
      destination: primaryDestination,
    }
  }
  return {
    co: primary,
    route: merged.entry.route,
    bound: merged.bound,
    serviceType: merged.entry.serviceType,
    variantKey: variantMergeKey({
      route: merged.entry.route,
      serviceType: merged.entry.serviceType,
      directionKey: merged.directionKey,
    }),
    origin: mapEtaLangToUi(merged.entry.orig),
    destination: mapEtaLangToUi(merged.entry.dest),
    routeEntry: merged.entry,
    operators: sorted,
    namesByOperator,
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

const NON_KMB_CONCURRENCY_FAST = 5
const NON_KMB_CONCURRENCY_MEDIUM = 3
const NON_KMB_CONCURRENCY_SLOW = 2

function etaDedupeKey(eta: {
  co: Company | string
  route: string
  dir: string
  serviceType: string
  etaSeq: number
  eta: string
}) {
  return `${eta.co}|${eta.route}|${eta.dir}|${eta.serviceType}|${eta.etaSeq}|${eta.eta}`
}

function mapOfficialStopEtaRows(
  rows: OfficialKmbStopEta[],
  filters: { routeFilter: string | null; serviceType: string | null }
): KmbEta[] {
  const deduped = new Map<string, KmbEta>()
  for (const entry of rows) {
    const route = String(entry.route ?? '')
    if (filters.routeFilter && route.toUpperCase() !== filters.routeFilter) continue
    if (filters.serviceType && String(entry.service_type) !== filters.serviceType) continue

    const co = String(entry.co ?? 'kmb').toLowerCase() as Company
    const dir = normalizeBound(entry.dir)
    const entryServiceType = String(entry.service_type ?? '')
    const etaSeq = Number(entry.eta_seq) || 0
    const eta = entry.eta ?? ''
    const mapped: KmbEta = {
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
    }
    const key = etaDedupeKey(mapped)
    if (!deduped.has(key)) deduped.set(key, mapped)
  }
  return Array.from(deduped.values())
}

export type FetchKmbEtasForStopDeps = {
  getIndexes: () => Promise<EtaDbIndexes>
  fetchOfficialStopEta: (stopId: string, signal?: AbortSignal) => Promise<OfficialStopEtaResponse>
  fetchVariantEtas: typeof fetchEtas
}

const defaultFetchKmbEtasForStopDeps: FetchKmbEtasForStopDeps = {
  getIndexes: getEtaDbIndexes,
  fetchOfficialStopEta: (stopId, signal) =>
    fetchJson<OfficialStopEtaResponse>(`${KMB_STOP_ETA_URL}/${encodeURIComponent(stopId)}`, {
      signal,
    }),
  fetchVariantEtas: fetchEtas,
}

/**
 * Fetch ETAs at a stop: official KMB stop-eta (one call) for KMB, plus hk-bus-eta
 * per-variant fetches for other operators (CTB/NLB/GMB/…).
 */
export async function fetchKmbEtasForStop(
  params: {
    stopId: string
    route?: string
    serviceType?: string
    language: UiLanguage
    signal?: AbortSignal
  },
  deps: FetchKmbEtasForStopDeps = defaultFetchKmbEtasForStopDeps
): Promise<KmbEta[]> {
  if (params.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  const stopId = normalizeStopId(params.stopId)
  if (!stopId) return [] as KmbEta[]

  const routeFilter = params.route ? params.route.toUpperCase() : null
  const serviceType = params.serviceType ? String(params.serviceType) : null
  const language = toHkBusEtaLanguage(params.language)

  const { stopRoutesIndex, stopEquivalents, routeVariantIndex } = await deps.getIndexes()
  // The requested stop keeps its exact prior behavior: every indexed route
  // at that id. Counterpart ids (same boarding point, other operator's id)
  // contribute only joint-route legs the requested stop itself serves, and
  // only when the requested stop has no row for that
  // co|route|bound|serviceType at all. Without both scopes the fan-out
  // pulls every variant at a 12-id interchange, which is ~46 upstream
  // calls for one stop selection and the slowness reported.
  const requestedEntries = (stopRoutesIndex.get(stopId) ?? []).filter((e) => {
    if (routeFilter && e.route.toUpperCase() !== routeFilter) return false
    if (serviceType && String(e.serviceType) !== serviceType) return false
    return true
  })
  const requestedRoutes = new Set(requestedEntries.map((e) => e.route.toUpperCase()))
  const requestedKeys = new Set(
    requestedEntries.map((e) =>
      routeVariantKey({
        co: e.co,
        route: e.route,
        bound: e.bound,
        serviceType: e.serviceType,
      })
    )
  )
  const gapEntries = counterpartIds(stopEquivalents, stopId).flatMap((id) =>
    (stopRoutesIndex.get(id) ?? []).filter((e) => {
      if (!requestedRoutes.has(e.route.toUpperCase())) return false
      if (routeFilter && e.route.toUpperCase() !== routeFilter) return false
      if (serviceType && String(e.serviceType) !== serviceType) return false
      const key = routeVariantKey({
        co: e.co,
        route: e.route,
        bound: e.bound,
        serviceType: e.serviceType,
      })
      return !requestedKeys.has(key)
    })
  )
  const routeEntries = [...requestedEntries, ...gapEntries]

  if (routeEntries.length === 0) return [] as KmbEta[]

  const candidateMap = new Map<
    string,
    { entry: RouteListEntry; co: Company; stopIndex: number; bound: string }
  >()
  // Upstream fetch identity: operator plus route plus service type plus stop
  // sequence. Two rows can share it while carrying different bound strings
  // (22M has `OI` and `O` rows for the same stop and seq): without this the
  // same departure is fetched twice and rendered twice, since the content
  // dedupe keys on dir. One fetch serves both; the standard I/O letter wins
  // so downstream labels stay consistent.
  const fetchIdentityToVariant = new Map<string, string>()
  const boundRank = (bound: string) => (bound === 'I' || bound === 'O' ? 0 : 1)
  for (const re of routeEntries) {
    const variantKey = routeVariantKey({
      co: re.co,
      route: re.route,
      bound: re.bound,
      serviceType: re.serviceType,
    })
    const entry = routeVariantIndex.get(variantKey)
    if (!entry) continue
    const fetchKey = `${re.co}|${String(re.route ?? '').toUpperCase()}|${String(re.serviceType ?? '')}|${re.seq}`
    const priorVariant = fetchIdentityToVariant.get(fetchKey)
    if (priorVariant && priorVariant !== variantKey) {
      const prior = candidateMap.get(priorVariant)
      if (prior && boundRank(normalizeBound(re.bound)) < boundRank(normalizeBound(prior.bound))) {
        candidateMap.delete(priorVariant)
        fetchIdentityToVariant.set(fetchKey, variantKey)
        candidateMap.set(variantKey, { entry, co: re.co, stopIndex: re.seq, bound: re.bound })
      }
      continue
    }
    if (!priorVariant) fetchIdentityToVariant.set(fetchKey, variantKey)
    const existing = candidateMap.get(variantKey)
    if (!existing || re.seq < existing.stopIndex) {
      candidateMap.set(variantKey, { entry, co: re.co, stopIndex: re.seq, bound: re.bound })
    }
  }

  const candidates = Array.from(candidateMap.values())
  const kmbCandidates = candidates.filter((c) => c.co === 'kmb')
  const nonKmb = candidates.filter((c) => c.co !== 'kmb')

  const results: KmbEta[] = []
  const signal = params.signal

  // Per-variant fetch shared by every operator, KMB included. KMB prefers
  // the official stop-eta endpoint (one call), but variants the official
  // endpoint does not cover fall through to here: the official endpoint
  // only knows KMB stop ids, so from a CTB stop id it returns nothing and
  // KMB departures would otherwise vanish from joint routes.
  const fetchVariants = (list: Array<{ entry: RouteListEntry; co: Company; stopIndex: number }>) =>
    promisePool(
      list,
      getAdaptiveConcurrency(
        NON_KMB_CONCURRENCY_FAST,
        NON_KMB_CONCURRENCY_MEDIUM,
        NON_KMB_CONCURRENCY_SLOW
      ),
      async ({ entry, co, stopIndex }) => {
        const etas = await deps.fetchVariantEtas({
          ...entry,
          co: [co],
          seq: stopIndex,
          language,
        })
        return etas.map((eta, idx) => {
          // hk-bus-eta per-operator fetchers use different field shapes
          // than the db rows (e.g. CTB returns remark/dest, no rmk_*/etaSeq),
          // so normalize everything the UI reads downstream.
          const raw = eta as Partial<Eta> & {
            etaSeq?: number
            rmk_tc?: string
            rmk_sc?: string
            rmk_en?: string
            dest_tc?: string
            dest_sc?: string
            dest_en?: string
          }
          const remarkZh = raw.remark?.zh ?? ''
          const remarkEn = raw.remark?.en ?? ''
          const destZh = raw.dest?.zh ?? ''
          const destEn = raw.dest?.en ?? ''
          return {
            ...eta,
            co: eta.co ?? co,
            route: entry.route,
            dir: normalizeBound(entry.bound[co]),
            serviceType: entry.serviceType,
            seq: stopIndex + 1,
            etaSeq: raw.etaSeq ?? idx + 1,
            dest: eta.dest ?? { en: destEn, zh: destZh },
            remark: eta.remark ?? { en: remarkEn, zh: remarkZh },
            rmk_tc: raw.rmk_tc ?? remarkZh,
            rmk_sc: raw.rmk_sc ?? remarkZh,
            rmk_en: raw.rmk_en ?? remarkEn,
            dest_tc: raw.dest_tc ?? destZh,
            dest_sc: raw.dest_sc ?? destZh,
            dest_en: raw.dest_en ?? destEn,
          }
        }) as KmbEta[]
      },
      { signal }
    )

  // Official KMB stop-eta covers the KMB variants it reports; anything it
  // misses (partial coverage, endpoint failure) falls back to per-variant
  // fetches so joint routes merge from either side. The endpoint only
  // knows KMB stop ids, so from a stop with no KMB rows of its own the
  // call is always empty and skipped outright.
  const requestedHasKmb = requestedEntries.some((e) => e.co === 'kmb')
  const officialKmbRows: KmbEta[] =
    requestedHasKmb && kmbCandidates.length > 0
      ? await deps
          .fetchOfficialStopEta(stopId, signal)
          .then((payload) =>
            mapOfficialStopEtaRows(Array.isArray(payload.data) ? payload.data : [], {
              routeFilter,
              serviceType,
            })
          )
          .catch(() => [])
      : []
  results.push(...officialKmbRows)

  const coveredKmbVariants = new Set(
    officialKmbRows.map(
      (row) =>
        `${String(row.route ?? '').toUpperCase()}|${normalizeBound(row.dir)}|${String(row.serviceType ?? '')}`
    )
  )
  const uncoveredKmb = kmbCandidates.filter(
    (c) =>
      !coveredKmbVariants.has(
        `${String(c.entry.route ?? '').toUpperCase()}|${normalizeBound(c.entry.bound[c.co])}|${String(c.entry.serviceType ?? '')}`
      )
  )

  const pooled = await fetchVariants([...nonKmb, ...uncoveredKmb])
  for (const r of pooled) if (r.status === 'fulfilled') results.push(...r.value)

  // Same boarding point, two ids: both can yield the identical CTB
  // departure (same co, route, dir, eta, remark). Dedupe on content, not
  // on seq/etaSeq, since the two ids report different seq values for the
  // same bus. KMB rows keep their own keys via co=kmb.
  const deduped = new Map<string, KmbEta>()
  for (const eta of results) {
    const key = etaDedupeKey({
      co: eta.co,
      route: eta.route,
      dir: eta.dir,
      serviceType: eta.serviceType,
      etaSeq: 0,
      eta: eta.eta ?? '',
    })
    const contentKey = `${key}|${eta.rmk_tc ?? ''}|${eta.rmk_en ?? ''}|${eta.dest_tc ?? ''}`
    if (!deduped.has(contentKey)) deduped.set(contentKey, eta)
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

export type FetchLrtEtasForStopDeps = {
  getIndexes: () => Promise<EtaDbIndexes>
  fetchVariantEtas: typeof fetchEtas
}

const defaultFetchLrtEtasForStopDeps: FetchLrtEtasForStopDeps = {
  getIndexes: getEtaDbIndexes,
  fetchVariantEtas: fetchEtas,
}

export async function fetchLrtEtasForStop(
  params: {
    route: string
    bound: string
    serviceType: string
    stationId: string
    language: UiLanguage
  },
  deps: FetchLrtEtasForStopDeps = defaultFetchLrtEtasForStopDeps
): Promise<Eta[]> {
  const route = params.route.toUpperCase()
  const bound = normalizeBound(params.bound)
  const serviceType = String(params.serviceType ?? '')
  const stopId = stationIdToLrtStopId(params.stationId)
  if (!stopId) return []

  const key = lrtRouteEtaKey({
    route,
    bound,
    serviceType,
    stationId: stopId,
    language: params.language,
  })

  const { value } = await getCachedValue<Eta[]>({
    key,
    policyKey: 'lrtRouteEta',
    policy: CACHE_POLICIES.lrtRouteEta,
    allowStale: true,
    fetcher: async () => {
      const { lrtRoutes } = await deps.getIndexes()
      const entry = lrtRoutes.find((item) => {
        if (item.route.toUpperCase() !== route) return false
        if (String(item.serviceType) !== serviceType) return false
        return normalizeBound(item.bound.lightRail) === bound
      })

      if (!entry) return []
      const stops = entry.stops.lightRail ?? []
      const seq = stops.findIndex((id) => lrtStopIdsEqual(id, stopId))
      if (seq < 0) return []

      return await deps.fetchVariantEtas({
        ...entry,
        seq,
        language: toHkBusEtaLanguage(params.language),
      })
    },
  })

  return value
}
