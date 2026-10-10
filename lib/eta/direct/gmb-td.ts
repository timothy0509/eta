import { GMB_TD_GROUPS_CACHE_KEY } from '@/lib/eta/cache/keys'
import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { fetchJson } from '@/lib/eta/http'

export const GMB_TD_GEOJSON_URL = 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json'

/** TD stopPickDrop: 1 drop-off only, 2 pick-up only, 3 both. */
export type GmbTdPickDrop = 1 | 2 | 3

/** TD routeSeq: 1 outbound/circular leg, 2 inbound leg. */
export type GmbTdRouteSeq = 1 | 2

export type GmbTdStopPoint = {
  routeId: number
  routeName: { en: string; tc: string; sc: string }
  routeSeq: GmbTdRouteSeq
  stopSeq: number
  stopId: number
  stopPickDrop: GmbTdPickDrop
  stopName: { en: string; tc: string; sc: string }
  lat: number
  lng: number
}

export type GmbTdRouteVariant = {
  routeId: number
  routeName: { en: string; tc: string; sc: string }
  routeSeq: GmbTdRouteSeq
  district: string
  serviceMode: string
  origin: { en: string; tc: string; sc: string }
  destination: { en: string; tc: string; sc: string }
  journeyTime: number | null
  fullFare: number | null
  lastUpdateDate: string | null
  stops: GmbTdStopPoint[]
}

export type GmbTdRouteGroup = {
  routeId: number
  routeName: { en: string; tc: string; sc: string }
  variants: GmbTdRouteVariant[]
}

type RawProperties = {
  routeId?: unknown
  routeNameC?: unknown
  routeNameS?: unknown
  routeNameE?: unknown
  district?: unknown
  serviceMode?: unknown
  journeyTime?: unknown
  locStartNameC?: unknown
  locStartNameS?: unknown
  locStartNameE?: unknown
  locEndNameC?: unknown
  locEndNameS?: unknown
  locEndNameE?: unknown
  fullFare?: unknown
  lastUpdateDate?: unknown
  routeSeq?: unknown
  stopSeq?: unknown
  stopId?: unknown
  stopPickDrop?: unknown
  stopNameC?: unknown
  stopNameS?: unknown
  stopNameE?: unknown
}

type RawFeature = {
  type?: unknown
  geometry?: { type?: unknown; coordinates?: unknown }
  properties?: RawProperties
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toRouteSeq(value: unknown): GmbTdRouteSeq | null {
  const num = toFiniteNumber(value)
  if (num === 1) return 1
  if (num === 2) return 2
  return null
}

function toPickDrop(value: unknown): GmbTdPickDrop | null {
  const num = toFiniteNumber(value)
  if (num === 1) return 1
  if (num === 2) return 2
  if (num === 3) return 3
  return null
}

function parseFeature(feature: RawFeature): GmbTdStopPoint | null {
  const props = feature?.properties
  if (!props) return null

  const routeId = toFiniteNumber(props.routeId)
  const routeSeq = toRouteSeq(props.routeSeq)
  const stopSeq = toFiniteNumber(props.stopSeq)
  const stopId = toFiniteNumber(props.stopId)
  const stopPickDrop = toPickDrop(props.stopPickDrop)
  if (routeId === null || routeSeq === null || stopSeq === null || stopId === null) return null
  if (stopPickDrop === null) return null

  const coords = feature?.geometry?.coordinates
  const lng = Array.isArray(coords) ? toFiniteNumber(coords[0]) : null
  const lat = Array.isArray(coords) ? toFiniteNumber(coords[1]) : null
  if (lat === null || lng === null) return null

  const routeName = {
    en: toTrimmedString(props.routeNameE),
    tc: toTrimmedString(props.routeNameC),
    sc: toTrimmedString(props.routeNameS),
  }
  if (!routeName.en && !routeName.tc) return null

  return {
    routeId,
    routeName,
    routeSeq,
    stopSeq,
    stopId,
    stopPickDrop,
    stopName: {
      en: toTrimmedString(props.stopNameE),
      tc: toTrimmedString(props.stopNameC),
      sc: toTrimmedString(props.stopNameS),
    },
    lat,
    lng,
  }
}

/**
 * Parse a TD GMB GeoJSON FeatureCollection into flat stop points.
 * Skips malformed features instead of failing the whole file.
 */
export function parseGmbTdCollection(json: unknown): GmbTdStopPoint[] {
  if (!json || typeof json !== 'object') return []
  const features = (json as { features?: unknown }).features
  if (!Array.isArray(features)) return []
  const stops: GmbTdStopPoint[] = []
  for (const feature of features) {
    const parsed = parseFeature(feature as RawFeature)
    if (parsed) stops.push(parsed)
  }
  return stops
}

function variantKey(routeId: number, routeSeq: GmbTdRouteSeq): string {
  return `${routeId}|${routeSeq}`
}

/**
 * Group flat stop points by routeId then routeSeq, ordering stops by
 * stopSeq. Variant-level fields (origin, destination, fare, journey time)
 * repeat on every feature, so the first stop in sequence order provides them.
 */
export function groupGmbTdStops(
  stops: GmbTdStopPoint[],
  metaByVariantKey?: Map<
    string,
    Omit<GmbTdRouteVariant, 'stops' | 'routeId' | 'routeSeq' | 'routeName'>
  >
): GmbTdRouteGroup[] {
  const byVariant = new Map<string, GmbTdStopPoint[]>()
  for (const stop of stops) {
    const key = variantKey(stop.routeId, stop.routeSeq)
    const list = byVariant.get(key) ?? []
    list.push(stop)
    byVariant.set(key, list)
  }

  const groups = new Map<number, GmbTdRouteGroup>()
  for (const [key, list] of byVariant) {
    const ordered = [...list].sort((a, b) => a.stopSeq - b.stopSeq)
    const first = ordered[0]
    if (!first) continue
    const meta = metaByVariantKey?.get(key)
    const variant: GmbTdRouteVariant = {
      routeId: first.routeId,
      routeName: first.routeName,
      routeSeq: first.routeSeq,
      district: meta?.district ?? '',
      serviceMode: meta?.serviceMode ?? '',
      origin: meta?.origin ?? { en: '', tc: '', sc: '' },
      destination: meta?.destination ?? { en: '', tc: '', sc: '' },
      journeyTime: meta?.journeyTime ?? null,
      fullFare: meta?.fullFare ?? null,
      lastUpdateDate: meta?.lastUpdateDate ?? null,
      stops: ordered,
    }
    const group = groups.get(first.routeId) ?? {
      routeId: first.routeId,
      routeName: first.routeName,
      variants: [],
    }
    group.variants.push(variant)
    groups.set(first.routeId, group)
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      variants: group.variants.sort((a, b) => a.routeSeq - b.routeSeq),
    }))
    .sort((a, b) => a.routeId - b.routeId)
}

type RawCollection = {
  features?: Array<{
    properties?: RawProperties
  }>
}

function buildVariantMeta(
  json: unknown
): Map<string, Omit<GmbTdRouteVariant, 'stops' | 'routeId' | 'routeSeq' | 'routeName'>> {
  const meta = new Map<
    string,
    Omit<GmbTdRouteVariant, 'stops' | 'routeId' | 'routeSeq' | 'routeName'>
  >()
  const features = (json as RawCollection)?.features
  if (!Array.isArray(features)) return meta
  for (const feature of features) {
    const props = feature?.properties
    if (!props) continue
    const routeId = toFiniteNumber(props.routeId)
    const routeSeq = toRouteSeq(props.routeSeq)
    if (routeId === null || routeSeq === null) continue
    const key = variantKey(routeId, routeSeq)
    if (meta.has(key)) continue
    meta.set(key, {
      district: toTrimmedString(props.district),
      serviceMode: toTrimmedString(props.serviceMode),
      origin: {
        en: toTrimmedString(props.locStartNameE),
        tc: toTrimmedString(props.locStartNameC),
        sc: toTrimmedString(props.locStartNameS),
      },
      destination: {
        en: toTrimmedString(props.locEndNameE),
        tc: toTrimmedString(props.locEndNameC),
        sc: toTrimmedString(props.locEndNameS),
      },
      journeyTime: toFiniteNumber(props.journeyTime),
      fullFare: toFiniteNumber(props.fullFare),
      lastUpdateDate: typeof props.lastUpdateDate === 'string' ? props.lastUpdateDate : null,
    })
  }
  return meta
}

/** TD routeSeq 1 is the outbound/circular leg, 2 is the inbound leg. */
export function gmbRouteSeqToBound(routeSeq: GmbTdRouteSeq): 'O' | 'I' {
  return routeSeq === 2 ? 'I' : 'O'
}

/** i18n key suffix for the boarding/alighting role. */
export function gmbPickDropKey(pickDrop: GmbTdPickDrop): string {
  if (pickDrop === 1) return 'gmb.dropOffOnly'
  if (pickDrop === 2) return 'gmb.pickUpOnly'
  return 'gmb.pickUpDropOff'
}

async function fetchGmbTdGroups(): Promise<GmbTdRouteGroup[]> {
  const json: unknown = await fetchJson<unknown>(GMB_TD_GEOJSON_URL, {
    timeoutMs: 15_000,
    retries: 1,
  })
  const stops = parseGmbTdCollection(json)
  return groupGmbTdStops(stops, buildVariantMeta(json))
}

/**
 * Full TD GMB route/stop table, cached for a day (the dataset updates
 * biweekly). Shares the static-list policy with the KMB tables.
 */
export async function listGmbTdRouteGroups(options?: {
  signal?: AbortSignal
}): Promise<GmbTdRouteGroup[]> {
  if (options?.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  const { value } = await getCachedValue<GmbTdRouteGroup[]>({
    key: GMB_TD_GROUPS_CACHE_KEY,
    policyKey: 'kmbStaticList',
    policy: CACHE_POLICIES.kmbStaticList,
    signal: options?.signal,
    fetcher: fetchGmbTdGroups,
  })
  return value
}

export async function getGmbTdRouteGroup(
  routeId: number,
  options?: { signal?: AbortSignal }
): Promise<GmbTdRouteGroup | null> {
  const groups = await listGmbTdRouteGroups(options)
  return groups.find((group) => group.routeId === routeId) ?? null
}
