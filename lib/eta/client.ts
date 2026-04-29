import type { Company } from 'hk-bus-eta'

import type { LrtScheduleResponse } from '@/lib/eta/direct/lrt'
import type { MtrScheduleResponse } from '@/lib/eta/mtr'
import type { KmbStopSearchItem } from '@/lib/eta/types'
import type { KmbEtaEntry, KmbRouteListEntry } from '@/lib/eta/direct/kmb'
import {
  fetchKmbFares as fetchKmbFaresDirect,
  fetchKmbStopEtas as fetchKmbStopEtasDirect,
  getKmbEta,
  getKmbRouteInfo,
  getKmbRouteList,
  getKmbRouteStops,
  getKmbStops,
} from '@/lib/eta/direct/kmb'
import { getLrtSchedule } from '@/lib/eta/direct/lrt'
import { fetchMtrSchedules as fetchMtrSchedulesDirect } from '@/lib/eta/direct/mtr'

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
  const stopId = String(variant.stopId ?? '').trim()
  const destCandidates = (variant.destCandidates ?? [])
    .map((dest) => String(dest ?? '').trim())
    .filter(Boolean)
    .sort()
    .join('~')
  return `${co}|${route}|${dir}|${serviceType}|${stopId}|${destCandidates}`
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
    if (options?.signal) {
      return new Promise((resolve, reject) => {
        const onAbort = () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        }
        options.signal!.addEventListener('abort', onAbort, { once: true })
        existing
          .then((result) => {
            options.signal!.removeEventListener('abort', onAbort)
            resolve(result as T)
          })
          .catch((err) => {
            options.signal!.removeEventListener('abort', onAbort)
            reject(err)
          })
      })
    }
    return existing as Promise<T>
  }

  const promise = fetcher().finally(() => {
    inFlightJson.delete(key)
  })

  inFlightJson.set(key, promise)
  return promise
}

/** ETA entry augmented with leg info for circular route disambiguation */
export type KmbEtaEntryWithLeg = KmbEtaEntry & {
  /** "A" = departing leg (closer to first stop occurrence), "B" = arriving leg (closer to last stop occurrence), null = not a circular stop */
  leg: 'A' | 'B' | null
}

export async function fetchKmbStops(): Promise<KmbStopSearchItem[]> {
  const stops = await getKmbStops()

  return stops
    .map((s) => ({
      stopId: s.stop,
      nameEn: (s.name_en ?? '').trim(),
      nameTc: (s.name_tc ?? '').trim(),
      nameSc: (s.name_sc ?? '').trim(),
      lat: typeof s.lat === 'string' ? Number(s.lat) : s.lat,
      lng: typeof s.long === 'string' ? Number(s.long) : s.long,
    }))
    .filter((s) => s.stopId && s.nameEn)
}

export async function fetchKmbRoutes(): Promise<KmbRouteListEntry[]> {
  return await getKmbRouteList()
}

export type KmbRouteStopLite = {
  co: Company
  route: string
  bound: 'I' | 'O' | string
  serviceType: string
  seq: number
  stopId: string
}

export async function fetchKmbRouteStops(): Promise<KmbRouteStopLite[]> {
  const routeStops = await getKmbRouteStops()

  return routeStops
    .map((entry) => ({
      co: entry.co ?? 'kmb',
      route: entry.route,
      bound: entry.bound,
      serviceType: String(entry.service_type),
      seq: typeof entry.seq === 'string' ? Number(entry.seq) : entry.seq,
      stopId: entry.stop,
    }))
    .filter((entry) => entry.route && entry.stopId)
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
}

export async function fetchKmbEtas(
  plans: Array<{ stopId: string; route: string; serviceType: string }>
) {
  const results = await Promise.allSettled(
    plans.map(async (plan) => ({ plan, eta: await getKmbEta(plan) }))
  )

  const eta: KmbEtaEntry[] = []
  const errors: Array<{ stopId: string; route: string; serviceType: string }> = []

  for (let i = 0; i < results.length; i += 1) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      eta.push(...result.value.eta)
    } else {
      const plan = plans[i]
      if (plan) errors.push(plan)
    }
  }

  return errors.length ? { eta, errors } : { eta }
}

export async function fetchKmbRouteInfo(params: {
  co?: Company
  route: string
  direction: 'I' | 'O' | 'inbound' | 'outbound' | string
  serviceType: string
}): Promise<KmbRouteInfoLite> {
  const info = await getKmbRouteInfo(params)

  return {
    co: info.co ?? params.co ?? 'kmb',
    route: info.route,
    bound: info.bound,
    serviceType: String(info.service_type),
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
  const body = { queries }
  const key = `mtr:schedules:${JSON.stringify(body)}`

  return await fetchJsonDedupe(key, async () => fetchMtrSchedulesDirect(queries), {
    signal: options?.signal,
  })
}

export async function fetchLrtSchedule(
  params: { stationId: string },
  options?: { signal?: AbortSignal }
): Promise<LrtScheduleResponse> {
  const key = `lrt:schedule:${params.stationId}`
  return await fetchJsonDedupe(key, async () => getLrtSchedule({ stationId: params.stationId }), {
    signal: options?.signal,
  })
}
