import { GMB_TD_GROUPS_CACHE_KEY } from '@/lib/eta/cache/keys'
import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { getCachedValue } from '@/lib/eta/direct/shared'
import type { GmbStopsFileStop, GmbStopsTuple } from '@/lib/eta/gmb'
import { fetchJson } from '@/lib/eta/http'

// Same-origin compact extract built by scripts/build-gmb-routes.ts. Served
// from public/, so no connect-src CSP addition is needed.
const GMB_STOPS_URL = '/data/gmb-stops.json'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

function toLang(value: unknown): { en: string; tc: string; sc: string } {
  const tuple = value as Partial<GmbStopsTuple> | null
  const at = (index: number): string => {
    const text = Array.isArray(tuple) ? tuple[index] : null
    return typeof text === 'string' ? text : ''
  }
  return { en: at(0), tc: at(1), sc: at(2) }
}

function decodeStop(
  routeId: number,
  routeName: GmbTdStopPoint['routeName'],
  routeSeq: GmbTdRouteSeq,
  entry: unknown
): GmbTdStopPoint | null {
  if (!Array.isArray(entry) || entry.length < 8) return null
  const tuple = entry as Partial<GmbStopsFileStop> & Array<unknown>
  const stopSeq = toFiniteNumber(tuple[0])
  const stopId = toFiniteNumber(tuple[1])
  const stopPickDrop = toPickDrop(tuple[2])
  const lat = toFiniteNumber(tuple[3])
  const lng = toFiniteNumber(tuple[4])
  if (stopSeq === null || stopId === null || stopPickDrop === null) return null
  if (lat === null || lng === null) return null
  const nameAt = (index: number): string =>
    typeof tuple[index] === 'string' ? (tuple[index] as string) : ''
  return {
    routeId,
    routeName,
    routeSeq,
    stopSeq,
    stopId,
    stopPickDrop,
    stopName: { en: nameAt(5), tc: nameAt(6), sc: nameAt(7) },
    lat,
    lng,
  }
}

function decodeVariant(
  routeId: number,
  routeName: GmbTdRouteVariant['routeName'],
  entry: unknown
): GmbTdRouteVariant | null {
  if (!isRecord(entry)) return null
  const routeSeq = toRouteSeq(entry['q'])
  if (routeSeq === null) return null
  if (!Array.isArray(entry['s'])) return null
  const stops: GmbTdStopPoint[] = []
  for (const stop of entry['s']) {
    const decoded = decodeStop(routeId, routeName, routeSeq, stop)
    if (decoded) stops.push(decoded)
  }
  if (stops.length === 0) return null
  stops.sort((a, b) => a.stopSeq - b.stopSeq)
  const finiteOrNull = (value: unknown): number | null => toFiniteNumber(value)
  return {
    routeId,
    routeName,
    routeSeq,
    district: typeof entry['d'] === 'string' ? entry['d'] : '',
    serviceMode: typeof entry['m'] === 'string' ? entry['m'] : '',
    origin: toLang(entry['o']),
    destination: toLang(entry['e']),
    journeyTime: finiteOrNull(entry['j']),
    fullFare: finiteOrNull(entry['f']),
    lastUpdateDate: typeof entry['u'] === 'string' ? entry['u'] : null,
    stops,
  }
}

function decodeRoute(entry: unknown): GmbTdRouteGroup | null {
  if (!isRecord(entry)) return null
  const routeId = toFiniteNumber(entry['i'])
  if (routeId === null) return null
  if (!Array.isArray(entry['n']) || !Array.isArray(entry['v'])) return null
  const routeName = toLang(entry['n'])
  const variants: GmbTdRouteVariant[] = []
  for (const variant of entry['v']) {
    const decoded = decodeVariant(routeId, routeName, variant)
    if (decoded) variants.push(decoded)
  }
  if (variants.length === 0) return null
  variants.sort((a, b) => a.routeSeq - b.routeSeq)
  return { routeId, routeName, variants }
}

/**
 * Validate the committed compact stop table and map it onto the route-group
 * types. Structural problems (not an object, missing meta/routes) throw so a
 * corrupt download fails loudly; malformed route, variant and stop entries
 * are skipped so one bad row cannot blank the whole dataset.
 */
export function parseGmbStopsFile(data: unknown): GmbTdRouteGroup[] {
  if (!isRecord(data)) throw new Error('GMB stops file is not an object')
  const meta = data['meta']
  const routes = data['routes']
  if (!isRecord(meta)) throw new Error('GMB stops file is missing meta')
  if (!Array.isArray(routes)) throw new Error('GMB stops file is missing routes')
  if (
    typeof meta['source'] !== 'string' ||
    typeof meta['dataset'] !== 'string' ||
    typeof meta['cutoffDate'] !== 'string' ||
    typeof meta['generatedAt'] !== 'string' ||
    typeof meta['count'] !== 'number'
  ) {
    throw new Error('GMB stops file has invalid meta')
  }
  const groups: GmbTdRouteGroup[] = []
  for (const route of routes) {
    const decoded = decodeRoute(route)
    if (decoded) groups.push(decoded)
  }
  return groups.sort((a, b) => a.routeId - b.routeId)
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

async function fetchGmbTdGroups(signal?: AbortSignal): Promise<GmbTdRouteGroup[]> {
  const json: unknown = await fetchJson<unknown>(GMB_STOPS_URL, { signal })
  return parseGmbStopsFile(json)
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
    fetcher: () => fetchGmbTdGroups(options?.signal),
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
