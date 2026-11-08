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
  computeRouteRegions,
  findRouteEntryByFamily,
  lookupRegion,
  normalizeBound,
  normalizeGtfsId,
  normalizeStopId,
  pickPrimaryOperator,
  routeVariantKey,
  serializeEtaDbIndexes,
  deserializeEtaDbIndexes,
  type EtaDbIndexes,
  type KmbRouteInfoLite,
  type KmbRouteStopLite,
  type KmbStopSearchItem,
  type SerializedEtaDbIndexes,
  type StopRouteEntry,
} from '@/lib/eta/eta-db-index'
import { fetchJson, getAdaptiveConcurrency } from '@/lib/eta/http'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { loadJointRoutes, resolveJointOperators } from '@/lib/eta/joint-routes'
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

let recordInFlight: Promise<EtaDbCacheValue> | null = null

/**
 * Dedupes concurrent cold reads of the ETA DB. The default stops view asks for
 * the indexes from the pane, the route-stops effect and the idle prefetch at
 * the same time; without this each one structured-clones the same multi-MB
 * IndexedDB record before the memory cache is filled.
 */
async function getEtaDbRecord(): Promise<EtaDbCacheValue> {
  const memory = etaDbCache.get(ETA_DB_CACHE_KEY)
  if (memory) return memory
  if (!recordInFlight) {
    recordInFlight = loadEtaDbRecord().finally(() => {
      recordInFlight = null
    })
  }
  return recordInFlight
}

async function loadEtaDbRecord(): Promise<EtaDbCacheValue> {
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
  const [db, md5, jointRoutes] = await Promise.all([
    getEtaDbCached(),
    getEtaDbMd5Cached(),
    loadJointRoutes(),
  ])

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
      const value = await buildEtaDbIndexes(db, {
        busCompanies: BUS_COMPANIES,
        jointRoutes,
      })
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
  const jointManifest = await loadJointRoutes()
  // Regions need the stop-sharing components, which only exist after rows
  // are built. Derive them from a light projection here.
  const regionsByFamily = computeRouteRegions(
    kmbRouteListEntries.flatMap((entry) =>
      entry.co.flatMap((co) =>
        (entry.stops[co] ?? []).map((stopId) => ({
          co,
          route: entry.route,
          stopId,
          gtfsId: normalizeGtfsId(entry.gtfsId),
        }))
      )
    )
  )
  return kmbRouteListEntries.flatMap((entry, entryIndex) => {
    const cos = entry.co.filter((co) => isBusCompany(co) && entry.stops[co]?.length)
    const jointOperators = resolveJointOperators(jointManifest, entry.route, cos)
    const joint = jointOperators.length > 1
    const route = String(entry.route ?? '').toUpperCase()
    const gtfsId = normalizeGtfsId(entry.gtfsId)
    const jointVariantKey = joint ? `jointv:${entryIndex}` : ''
    let jointRegion = ''
    let operators: string[] = []
    if (joint) {
      const primary = pickPrimaryOperator(jointOperators)
      jointRegion = `joint|${route}|1`
      operators = [primary, ...jointOperators.filter((op) => op !== primary)]
    }
    return cos.map((co) => ({
      co,
      route: entry.route,
      bound: normalizeBound(entry.bound[co]),
      serviceType: entry.serviceType,
      gtfsId,
      region:
        (joint ? jointRegion : '') || regionsByFamily.get(`${co}|${route}`)?.get(gtfsId) || '',
      operators: joint ? operators : [co],
      jointVariantKey,
      origin: mapEtaLangToUi(entry.orig),
      destination: mapEtaLangToUi(entry.dest),
      routeEntry: entry,
    }))
  })
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
  /** Upstream gtfsId disambiguating same-number routes across regions
   * (GMB HKI/Kowloon/NT). Omit for the legacy family fallback (first match). */
  gtfsId?: string
  signal?: AbortSignal
}): Promise<KmbRouteInfoLite | null> {
  if (params.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  const { routeVariantIndex, regionIndex, kmbRouteListEntries } = await getEtaDbIndexes()
  if (params.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  const routeName = params.route.toUpperCase()
  const bound = normalizeBound(params.bound)
  const serviceType = String(params.serviceType ?? '')
  const co = (params.co ?? 'kmb') as Company
  const gtfsId = normalizeGtfsId(params.gtfsId)

  const entry =
    routeVariantIndex.get(routeVariantKey({ co, route: routeName, bound, serviceType, gtfsId })) ??
    findRouteEntryByFamily(routeVariantIndex, {
      co,
      route: routeName,
      bound,
      serviceType,
    })

  if (!entry || !entry.co.includes(co)) return null

  const entryGtfsId = normalizeGtfsId(entry.gtfsId)
  const entryIndex = kmbRouteListEntries.indexOf(entry)
  const manifest = await loadJointRoutes()
  const busCos = entry.co.filter((company) => isBusCompany(company) && entry.stops[company]?.length)
  const jointOperators = resolveJointOperators(manifest, entry.route, busCos)
  const joint = jointOperators.length > 1
  const route = String(entry.route ?? '').toUpperCase()

  return {
    co,
    route: entry.route,
    bound: normalizeBound(entry.bound[co]),
    serviceType: entry.serviceType,
    gtfsId: entryGtfsId,
    region: joint
      ? `joint|${route}|1`
      : lookupRegion({ regionIndex }, { co, route: entry.route, gtfsId: entryGtfsId }),
    operators: joint
      ? [
          pickPrimaryOperator(jointOperators),
          ...jointOperators.filter((op) => op !== pickPrimaryOperator(jointOperators)),
        ]
      : [co],
    jointVariantKey: joint && entryIndex >= 0 ? `jointv:${entryIndex}` : '',
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
  /** Region discriminator for same-number routes (GMB HKI/Kowloon/NT). Empty when unknown (e.g. KMB official rows). */
  gtfsId?: string
  /** Region group `co|ROUTE|n` matching StopRouteEntry.region. Empty when unknown. */
  region?: string
  /** Jointly operated route metadata. Empty on single-operator rows. */
  operators?: string[]
  jointVariantKey?: string
  jointGroupKey?: string
  /** Operator used for grouping and primary-operator display. */
  groupCo?: string
  /** Stop id that produced this ETA when it came from a paired stop. */
  sourceStopId?: string
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
  filters: { routeFilter: string | null; serviceType: string | null; dir?: string | null }
): KmbEta[] {
  const deduped = new Map<string, KmbEta>()
  for (const entry of rows) {
    const route = String(entry.route ?? '')
    if (filters.routeFilter && route.toUpperCase() !== filters.routeFilter) continue
    if (filters.serviceType && String(entry.service_type) !== filters.serviceType) continue
    const dir = normalizeBound(entry.dir)
    if (filters.dir && dir !== filters.dir) continue

    const co = String(entry.co ?? 'kmb').toLowerCase() as Company
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

  const { stopRoutesIndex, routeVariantIndex, regionIndex } = await deps.getIndexes()
  const routeEntries = (stopRoutesIndex.get(stopId) ?? []).filter((e) => {
    if (routeFilter && e.route.toUpperCase() !== routeFilter) return false
    if (serviceType && String(e.serviceType) !== serviceType) return false
    return true
  })

  if (routeEntries.length === 0) return [] as KmbEta[]

  type Candidate = {
    entry: RouteListEntry
    co: Company
    stopIndex: number
    operators: string[]
    jointVariantKey: string
    jointGroupKey: string
    siblingStopIds: string[]
  }

  const candidateMap = new Map<string, Candidate>()
  // Resolved region per 5-part variant key, carried onto ETAs for grouping.
  const regionByVariantKey = new Map<string, string>()
  for (const re of routeEntries) {
    const variantKey = routeVariantKey({
      co: re.co,
      route: re.route,
      bound: re.bound,
      serviceType: re.serviceType,
      gtfsId: re.gtfsId,
    })
    const entry =
      routeVariantIndex.get(variantKey) ??
      findRouteEntryByFamily(routeVariantIndex, {
        co: re.co,
        route: re.route,
        bound: re.bound,
        serviceType: re.serviceType,
      })
    if (!entry) continue
    // Resolve the key against the entry actually used: the stop's own
    // gtfsId may be empty (legacy index) or the lookup fell back to the
    // family entry, so key by the entry so grouping/fares stay consistent.
    const resolvedKey = routeVariantKey({
      co: re.co,
      route: entry.route,
      bound: normalizeBound(entry.bound[re.co]),
      serviceType: entry.serviceType,
      gtfsId: entry.gtfsId,
    })
    const existing = candidateMap.get(resolvedKey)
    if (!existing || re.seq < existing.stopIndex) {
      candidateMap.set(resolvedKey, {
        entry,
        co: re.co,
        stopIndex: re.seq,
        operators: re.operators?.length ? re.operators : [re.co],
        jointVariantKey: re.jointVariantKey ?? '',
        jointGroupKey: re.jointGroupKey ?? '',
        siblingStopIds: re.siblingStopIds ?? [],
      })
    }
    // Prefer the stop's own region (already component-resolved at index
    // build); resolve through the region index when the row predates it.
    // Only set once per key so the smallest seq wins the same way
    // candidates do.
    if (!regionByVariantKey.has(resolvedKey)) {
      regionByVariantKey.set(
        resolvedKey,
        re.region ||
          lookupRegion({ regionIndex }, { co: re.co, route: re.route, gtfsId: re.gtfsId })
      )
    }
  }

  const candidates = Array.from(candidateMap.values())
  const hasKmb = candidates.some((c) => c.co === 'kmb')
  const nonKmb = candidates.filter((c) => c.co !== 'kmb')

  const results: KmbEta[] = []
  const signal = params.signal

  // Region per resolved 5-part variant key for downstream grouping/fares.
  // Prefer the stop entry's own region (component-resolved at index build);
  // the resolved key only differs when falling back to a family entry.
  const regionForVariantKey = (variantKey: string): string =>
    regionByVariantKey.get(variantKey) ?? ''

  const candidateByFamily = new Map<string, Candidate>()
  for (const candidate of candidates) {
    const familyKey = `${candidate.co}|${String(candidate.entry.route ?? '').toUpperCase()}|${normalizeBound(candidate.entry.bound[candidate.co])}|${candidate.entry.serviceType}`
    if (!candidateByFamily.has(familyKey)) candidateByFamily.set(familyKey, candidate)
  }

  const tagJoint = (candidate: Candidate, etas: KmbEta[], sourceStopId?: string): KmbEta[] => {
    if (!candidate.jointVariantKey) return etas
    const primary = pickPrimaryOperator(candidate.operators)
    // Both operators share a physical direction but can label their bound
    // differently (KMB inbound is CTB outbound). Use the primary operator's
    // bound so grouping, fares and schedule lookup all agree.
    const canonicalDir = normalizeBound(
      (candidate.entry.bound as Record<string, string | undefined>)[primary]
    )
    return etas.map((eta) => ({
      ...eta,
      dir: canonicalDir || eta.dir,
      groupCo: primary,
      operators: candidate.operators,
      jointVariantKey: candidate.jointVariantKey,
      jointGroupKey: candidate.jointGroupKey,
      sourceStopId: sourceStopId ?? eta.sourceStopId,
    }))
  }

  const officialByStop = new Map<string, Promise<OfficialStopEtaResponse>>()
  const getOfficial = (id: string) => {
    let promise = officialByStop.get(id)
    if (!promise) {
      promise = deps.fetchOfficialStopEta(id, signal)
      officialByStop.set(id, promise)
    }
    return promise
  }

  const mapVariantEtas = (
    entry: RouteListEntry,
    co: Company,
    stopIndex: number,
    etas: Awaited<ReturnType<typeof deps.fetchVariantEtas>>,
    region: string
  ): KmbEta[] => {
    const gtfsId = normalizeGtfsId(entry.gtfsId)
    return etas.map((eta, idx) => ({
      ...eta,
      co: eta.co ?? co,
      route: entry.route,
      dir: normalizeBound(entry.bound[co]),
      serviceType: entry.serviceType,
      gtfsId,
      region,
      seq: stopIndex + 1,
      etaSeq: idx + 1,
    })) as KmbEta[]
  }

  const fetchNonKmb = () =>
    promisePool(
      nonKmb,
      getAdaptiveConcurrency(
        NON_KMB_CONCURRENCY_FAST,
        NON_KMB_CONCURRENCY_MEDIUM,
        NON_KMB_CONCURRENCY_SLOW
      ),
      async ({ entry, co, stopIndex, ...candidate }) => {
        const etas = await deps.fetchVariantEtas({
          ...entry,
          co: [co],
          seq: stopIndex,
          language,
        })
        const variantKey = routeVariantKey({
          co,
          route: entry.route,
          bound: normalizeBound(entry.bound[co]),
          serviceType: entry.serviceType,
          gtfsId: entry.gtfsId,
        })
        return tagJoint(
          {
            entry,
            co,
            stopIndex,
            operators: candidate.operators ?? [co],
            jointVariantKey: candidate.jointVariantKey ?? '',
            jointGroupKey: candidate.jointGroupKey ?? '',
            siblingStopIds: candidate.siblingStopIds ?? [],
          },
          mapVariantEtas(entry, co, stopIndex, etas, regionForVariantKey(variantKey))
        )
      },
      { signal }
    )

  const tagOfficialRows = (
    rows: OfficialKmbStopEta[],
    filters: { routeFilter: string | null; serviceType: string | null; dir?: string | null }
  ): KmbEta[] => {
    const mapped = mapOfficialStopEtaRows(rows, filters)
    return mapped.flatMap((eta) => {
      const familyKey = `${eta.co}|${String(eta.route ?? '').toUpperCase()}|${normalizeBound(eta.dir)}|${eta.serviceType}`
      const candidate = candidateByFamily.get(familyKey)
      // Leave single-operator KMB rows exactly as before: the official feed
      // omits gtfsId and downstream fare/schedule keys rely on that shape.
      if (!candidate || !candidate.jointVariantKey) return [eta]
      return tagJoint(candidate, [
        {
          ...eta,
          gtfsId: normalizeGtfsId(candidate.entry.gtfsId),
          region: regionForVariantKey(
            routeVariantKey({
              co: candidate.co,
              route: candidate.entry.route,
              bound: normalizeBound(candidate.entry.bound[candidate.co]),
              serviceType: candidate.entry.serviceType,
              gtfsId: candidate.entry.gtfsId,
            })
          ),
        },
      ])
    })
  }

  if (hasKmb && nonKmb.length > 0) {
    const [payload, pooled] = await Promise.all([getOfficial(stopId), fetchNonKmb()])
    const rows = Array.isArray(payload.data) ? payload.data : []
    results.push(...tagOfficialRows(rows, { routeFilter, serviceType }))
    for (const r of pooled) if (r.status === 'fulfilled') results.push(...r.value)
  } else if (hasKmb) {
    const payload = await getOfficial(stopId)
    const rows = Array.isArray(payload.data) ? payload.data : []
    results.push(...tagOfficialRows(rows, { routeFilter, serviceType }))
  } else if (nonKmb.length > 0) {
    const pooled = await fetchNonKmb()
    for (const r of pooled) if (r.status === 'fulfilled') results.push(...r.value)
  }

  // Pair-stop enrichment: a joint route keeps its stop ids per operator.
  // Fetch the sibling stop's ETAs for the same physical variant only, then
  // merge them into the requested stop so both operators render in one row.
  type SiblingRequest = { candidate: Candidate; row: StopRouteEntry }
  const siblingRequests = new Map<string, SiblingRequest>()
  for (const candidate of candidates) {
    if (!candidate.jointVariantKey || candidate.siblingStopIds.length === 0) continue
    for (const siblingStopId of candidate.siblingStopIds) {
      if (siblingStopId === stopId) continue
      for (const row of stopRoutesIndex.get(siblingStopId) ?? []) {
        if (row.jointVariantKey !== candidate.jointVariantKey) continue
        if (row.co === candidate.co) continue
        const key = `${siblingStopId}|${routeVariantKey({ co: row.co, route: row.route, bound: row.bound, serviceType: row.serviceType, gtfsId: row.gtfsId })}|${candidate.jointVariantKey}`
        if (!siblingRequests.has(key)) siblingRequests.set(key, { candidate, row })
      }
    }
  }

  if (siblingRequests.size > 0) {
    const pooled = await promisePool(
      Array.from(siblingRequests.values()),
      Math.min(4, getAdaptiveConcurrency(5, 3, 2)),
      async ({ candidate, row }) => {
        const variantKey = routeVariantKey({
          co: row.co,
          route: row.route,
          bound: row.bound,
          serviceType: row.serviceType,
          gtfsId: row.gtfsId,
        })
        const entry =
          routeVariantIndex.get(variantKey) ??
          findRouteEntryByFamily(routeVariantIndex, {
            co: row.co,
            route: row.route,
            bound: row.bound,
            serviceType: row.serviceType,
          })
        if (!entry) return [] as KmbEta[]

        if (row.co === 'kmb') {
          const payload = await getOfficial(row.stopId)
          const rows = Array.isArray(payload.data) ? payload.data : []
          const mapped = mapOfficialStopEtaRows(rows, {
            routeFilter: row.route.toUpperCase(),
            serviceType: String(row.serviceType),
            dir: normalizeBound(row.bound),
          }).map((eta) => ({
            ...eta,
            gtfsId: normalizeGtfsId(row.gtfsId),
            region: row.region,
            seq: candidate.stopIndex + 1,
          }))
          return tagJoint(candidate, mapped, row.stopId)
        }

        const etas = await deps.fetchVariantEtas({
          ...entry,
          co: [row.co],
          seq: row.seq,
          language,
        })
        const mapped = mapVariantEtas(entry, row.co, candidate.stopIndex, etas, row.region)
        return tagJoint(candidate, mapped, row.stopId)
      },
      { signal }
    )
    for (const r of pooled) if (r.status === 'fulfilled') results.push(...r.value)
  }

  const deduped = new Map<string, KmbEta>()
  for (const eta of results) {
    const key = etaDedupeKey({
      co: eta.co,
      route: eta.route,
      dir: eta.dir,
      serviceType: eta.serviceType,
      etaSeq: eta.etaSeq,
      eta: eta.eta ?? '',
    })
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
