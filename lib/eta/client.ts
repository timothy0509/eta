import type { Company, Eta, RouteListEntry } from 'hk-bus-eta'

import type { LrtScheduleResponse } from '@/lib/eta/direct/lrt'
import type { MtrScheduleResponse } from '@/lib/eta/mtr'
import type { KmbStopSearchItem } from '@/lib/eta/types'
import { isKmbStop } from '@/lib/eta/types'
import type { KmbEtaEntryWithLeg, KmbRouteListEntry } from '@/lib/eta/direct/kmb'
import {
  fetchKmbFares as fetchKmbFaresDirect,
  fetchKmbStopEtas as fetchKmbStopEtasDirect,
  getKmbRouteInfo,
  getKmbRouteList,
  getKmbRouteStops,
  getKmbStops,
} from '@/lib/eta/direct/kmb'
import {
  fetchLrtEtasForStop as fetchLrtEtasForStopDirect,
  listMtrRoutes as listMtrRoutesDirect,
} from '@/lib/eta/direct/eta-db'
import {
  KMB_ROUTE_STOPS_MAPPED_CACHE_KEY,
  KMB_ROUTES_MAPPED_CACHE_KEY,
  KMB_STOPS_MAPPED_CACHE_KEY,
} from '@/lib/eta/cache/keys'
import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { getLrtSchedule } from '@/lib/eta/direct/lrt'
import { fetchMtrSchedules as fetchMtrSchedulesDirect } from '@/lib/eta/direct/mtr'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { lrtStopIdToStationId } from '@/lib/eta/lrt-stop-id'
import type { UiLanguage } from '@/lib/eta/types'

type DedupeKey = string

const inFlightJson = new Map<DedupeKey, Promise<unknown>>()

function normalizeRouteFilterKey(routeFilter?: string) {
  if (!routeFilter) return undefined
  const normalized = routeFilter
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.toUpperCase())
    .sort()
  return normalized.length ? normalized.join(',') : undefined
}

function normalizeStopIdsKey(stopIds: string[]) {
  return Array.from(
    new Set(stopIds.map((stopId) => String(stopId ?? '').trim()).filter(Boolean))
  ).sort()
}

function normalizeFareVariantKey(variant: KmbFareVariant) {
  const co = String(variant.co ?? 'kmb').toLowerCase()
  const route = String(variant.route ?? '').toUpperCase()
  const dir = String(variant.dir ?? '')
  const serviceType = String(variant.serviceType ?? '')
  const gtfsId = co === 'gmb' ? String(variant.gtfsId ?? '').trim() : ''
  const stopId = String(variant.stopId ?? '').trim()
  const destCandidates = (variant.destCandidates ?? [])
    .map((dest) => String(dest ?? '').trim())
    .filter(Boolean)
    .sort()
    .join('~')
  return `${co}|${route}|${dir}|${serviceType}|${gtfsId}|${stopId}|${destCandidates}`
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function fetchJsonDedupe<T>(
  key: DedupeKey,
  fetcher: () => Promise<T>,
  options?: { signal?: AbortSignal }
): Promise<T> {
  if (options?.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }

  const existing = inFlightJson.get(key)
  if (existing) {
    try {
      if (options?.signal) {
        return await new Promise<T>((resolve, reject) => {
          const onAbort = () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          }
          options.signal!.addEventListener('abort', onAbort, { once: true })
          existing.then(
            (result) => {
              options.signal!.removeEventListener('abort', onAbort)
              resolve(result as T)
            },
            (err) => {
              options.signal!.removeEventListener('abort', onAbort)
              reject(err)
            }
          )
        })
      }
      return (await existing) as T
    } catch (err) {
      // The originator aborted its own request while we were joined to it.
      // Our signal is still live, so run our own fetch instead of surfacing
      // their AbortError. The stale entry is already deleted by the
      // originator's finally, so this either joins another live entry or
      // starts a fresh fetch; genuine errors propagate untouched.
      if (!options?.signal?.aborted && isAbortError(err)) {
        return await fetchJsonDedupe(key, fetcher, options)
      }
      throw err
    }
  }

  const promise = fetcher().finally(() => {
    inFlightJson.delete(key)
  })

  inFlightJson.set(key, promise)
  return promise
}

export type { KmbEtaEntryWithLeg }

export async function fetchKmbStops(): Promise<KmbStopSearchItem[]> {
  const { value } = await getCachedValue<KmbStopSearchItem[]>({
    key: KMB_STOPS_MAPPED_CACHE_KEY,
    policyKey: 'kmbStaticList',
    policy: CACHE_POLICIES.kmbStaticList,
    fetcher: async () => {
      const stops = await getKmbStops()

      const toCoord = (value: unknown) => {
        if (typeof value === 'string') {
          if (!value.trim()) return Number.NaN
          return Number(value)
        }
        if (typeof value === 'number') return value
        return Number.NaN
      }

      return stops
        .map((s) => ({
          stopId: s.stop,
          nameEn: (s.name_en ?? '').trim(),
          nameTc: (s.name_tc ?? '').trim(),
          nameSc: (s.name_sc ?? '').trim(),
          lat: toCoord(s.lat),
          lng: toCoord(s.long),
          isKmb: isKmbStop(s),
        }))
        .filter((s) => s.stopId && s.nameEn && Number.isFinite(s.lat) && Number.isFinite(s.lng))
    },
  })
  return value
}

export async function fetchKmbRoutes(): Promise<KmbRouteListEntry[]> {
  const { value } = await getCachedValue<KmbRouteListEntry[]>({
    key: KMB_ROUTES_MAPPED_CACHE_KEY,
    policyKey: 'kmbStaticList',
    policy: CACHE_POLICIES.kmbStaticList,
    fetcher: () => getKmbRouteList(),
  })
  return value
}

export type KmbRouteStopLite = {
  co: Company
  route: string
  bound: 'I' | 'O' | string
  serviceType: string
  seq: number
  stopId: string
  gtfsId?: string
}

export async function fetchKmbRouteStops(): Promise<KmbRouteStopLite[]> {
  const { value } = await getCachedValue<KmbRouteStopLite[]>({
    key: KMB_ROUTE_STOPS_MAPPED_CACHE_KEY,
    policyKey: 'kmbStaticList',
    policy: CACHE_POLICIES.kmbStaticList,
    fetcher: async () => {
      const routeStops = await getKmbRouteStops()

      return routeStops
        .map((entry) => ({
          co: entry.co ?? 'kmb',
          route: entry.route,
          bound: entry.bound,
          serviceType: String(entry.service_type),
          seq: typeof entry.seq === 'string' ? Number(entry.seq) : entry.seq,
          stopId: entry.stop,
          gtfsId: String((entry as { gtfsId?: unknown }).gtfsId ?? ''),
        }))
        .filter((entry) => entry.route && entry.stopId)
    },
  })
  return value
}

export type KmbRouteInfoLite = {
  co: Company
  route: string
  bound: 'I' | 'O' | string
  serviceType: string
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
}

export async function fetchKmbRouteInfo(params: {
  co?: Company
  route: string
  direction: 'I' | 'O' | 'inbound' | 'outbound' | string
  serviceType: string
  gtfsId?: string
  signal?: AbortSignal
}): Promise<KmbRouteInfoLite> {
  if (params.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  const info = await getKmbRouteInfo(params)

  return {
    co: info.co ?? params.co ?? 'kmb',
    route: info.route,
    bound: info.bound,
    serviceType: String(info.service_type),
    gtfsId: String((info as { gtfsId?: unknown }).gtfsId ?? params.gtfsId ?? ''),
    origin: {
      en: (info.orig_en ?? '').trim(),
      tc: (info.orig_tc ?? '').trim(),
      sc: (info.orig_sc ?? '').trim(),
    },
    destination: {
      en: (info.dest_en ?? '').trim(),
      tc: (info.dest_tc ?? '').trim(),
      sc: (info.dest_sc ?? '').trim(),
    },
  }
}

/**
 * Fetch ETAs for multiple stops using the new stop-eta API.
 * Much more efficient than per-route ETA calls.
 */
export type KmbStopEtasResponse = {
  byStopId: Record<string, KmbEtaEntryWithLeg[]>
  faresByVariantKey?: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
  errors: string[]
  cached: number
  fetched: number
  staleByStopId?: Record<string, { stale: boolean; ageMs: number | null }>
  truncatedStopIds?: string[]
  /**
   * True when every requested stop was served from cache. Callers use it
   * to avoid bumping lastUpdatedAt on cache hits, so "just now" and the
   * age-based stale check reflect the data, not the poll tick.
   */
  allCached?: boolean
}

export async function fetchKmbStopEtas(
  stopIds: string[],
  options?: { routeFilter?: string; signal?: AbortSignal; includeFares?: boolean }
): Promise<KmbStopEtasResponse> {
  const keyPayload = {
    stopIds: normalizeStopIdsKey(stopIds),
    routeFilter: normalizeRouteFilterKey(options?.routeFilter),
    includeFares: options?.includeFares ?? false,
  }

  const key = `kmb:stop-etas:${JSON.stringify(keyPayload)}`

  return await fetchJsonDedupe(
    key,
    async () =>
      fetchKmbStopEtasDirect(stopIds, {
        routeFilter: options?.routeFilter,
        includeFares: options?.includeFares ?? false,
        signal: options?.signal,
      }),
    { signal: options?.signal }
  )
}

/**
 * Fetch fares for a list of route variants (deferred from stop-etas).
 */
export type KmbFareVariant = {
  co: Company
  route: string
  dir: string
  serviceType: string
  gtfsId?: string
  stopId: string
  destCandidates?: string[]
}

export type KmbFaresResponse = {
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
}

export async function fetchKmbFares(
  variants: KmbFareVariant[],
  options?: { signal?: AbortSignal }
): Promise<KmbFaresResponse> {
  const normalizedKeys = Array.from(
    new Set(variants.map((variant) => normalizeFareVariantKey(variant)))
  ).sort()
  const key = `kmb:fares:${JSON.stringify({ variants: normalizedKeys })}`

  return await fetchJsonDedupe(key, async () => fetchKmbFaresDirect(variants), {
    signal: options?.signal,
  })
}

/**
 * Fetch schedules for multiple MTR stations in one request.
 */
export type MtrSchedulesResponse = {
  byKey: Record<string, MtrScheduleResponse>
  errors: string[]
  cached: number
  fetched: number
  backoff: boolean
}

export async function fetchMtrSchedules(
  queries: Array<{ line: string; sta: string; lang: 'EN' | 'TC' }>,
  options?: { signal?: AbortSignal }
): Promise<MtrSchedulesResponse> {
  // Sort so the same station+lines in different caller order share one
  // in-flight entry instead of firing duplicate upstream batches.
  const sorted = [...queries]
    .map((q) => ({ line: q.line, sta: q.sta, lang: q.lang }))
    .sort(
      (a, b) =>
        a.line.localeCompare(b.line) || a.sta.localeCompare(b.sta) || a.lang.localeCompare(b.lang)
    )
  const body = { queries: sorted }
  const key = `mtr:schedules:${JSON.stringify(body)}`

  return await fetchJsonDedupe(
    key,
    async () => fetchMtrSchedulesDirect(sorted, { signal: options?.signal }),
    {
      signal: options?.signal,
    }
  )
}

export async function fetchLrtSchedule(
  params: { stationId: string },
  options?: { signal?: AbortSignal }
): Promise<LrtScheduleResponse> {
  const stationId = lrtStopIdToStationId(params.stationId) ?? params.stationId
  const key = `lrt:schedule:${stationId}`
  return await fetchJsonDedupe(
    key,
    async () => getLrtSchedule({ stationId, signal: options?.signal }),
    {
      signal: options?.signal,
    }
  )
}

export async function listMtrRoutes(options?: { signal?: AbortSignal }): Promise<RouteListEntry[]> {
  const key = 'mtr:routes'
  return await fetchJsonDedupe(key, async () => listMtrRoutesDirect(), {
    signal: options?.signal,
  })
}

export async function fetchLrtEtasForStop(
  params: {
    route: string
    bound: string
    serviceType: string
    stationId: string
    language: UiLanguage
  },
  options?: { signal?: AbortSignal }
): Promise<Eta[]> {
  const route = String(params.route ?? '').toUpperCase()
  const bound = String(params.bound ?? '')
  const serviceType = String(params.serviceType ?? '')
  const stationId = lrtStopIdToStationId(params.stationId) ?? params.stationId
  const key = `lrt:etas:${route}|${bound}|${serviceType}|${stationId}|${params.language}`
  return await fetchJsonDedupe(
    key,
    async () => fetchLrtEtasForStopDirect({ ...params, stationId }),
    {
      signal: options?.signal,
    }
  )
}

export async function fetchMtrRouteSchedules(
  params: { line: string; stas: string[]; lang: 'EN' | 'TC' },
  options?: { signal?: AbortSignal }
): Promise<MtrSchedulesResponse> {
  const queries = params.stas.map((sta) => ({
    line: params.line,
    sta,
    lang: params.lang,
  }))
  return await fetchMtrSchedules(queries, options)
}
