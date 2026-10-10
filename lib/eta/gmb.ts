import type { UiLanguage } from '@/lib/eta/types'

// ============================================================================
// Green minibus (GMB) route directory data model
// ============================================================================
//
// Route-level facts come from the Transport Department routes-and-fares
// GeoJSON (one feature per stop, route fields repeated). The ~20 MB source
// is never fetched at runtime: scripts/build-gmb-routes.ts compacts it into
// public/data/gmb-routes.json, and lib/eta/direct/gmb.ts loads that file
// through the shared cache layer.

export const GMB_GEOJSON_URL = 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json'
export const GMB_DATASET_URL =
  'https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson'
export const GMB_UPDATE_DATE_URL =
  'https://static.data.gov.hk/td/routes-fares-geojson/DATA_LAST_UPDATED_DATE.csv'

const GMB_DETAIL_BASE = 'https://h2-app-rr.hkemobility.gov.hk/ris_page/get_gmb_detail.php'

export type GmbDistrict = 'HKI' | 'KLN' | 'NT'

export const GMB_DISTRICTS: readonly GmbDistrict[] = ['HKI', 'KLN', 'NT']

export function isGmbDistrict(value: unknown): value is GmbDistrict {
  return value === 'HKI' || value === 'KLN' || value === 'NT'
}

export type GmbTrilingual = {
  en: string
  tc: string
  sc: string
}

export type GmbRouteEntry = {
  routeId: number
  district: GmbDistrict
  name: GmbTrilingual
  serviceMode: string
  specialType: number
  journeyTime: number
  origin: GmbTrilingual
  destination: GmbTrilingual
  fullFare: number
  lastUpdateDate: string
  stopCount: number
}

export type GmbRouteListMeta = {
  source: string
  dataset: string
  cutoffDate: string
  generatedAt: string
  count: number
}

export type GmbRouteListFile = {
  meta: GmbRouteListMeta
  routes: GmbRouteEntry[]
}

/** Official TD detail page for one GMB route, in the active UI language. */
export function gmbDetailUrl(routeId: number, lang: UiLanguage): string {
  const tdLang = lang === 'en' ? 'EN' : lang === 'sc' ? 'SC' : 'TC'
  return `${GMB_DETAIL_BASE}?lang=${tdLang}&route_id=${routeId}`
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toTrilingual(source: Record<string, unknown>, cKey: string, sKey: string, eKey: string) {
  return {
    tc: toTrimmedString(source[cKey]),
    sc: toTrimmedString(source[sKey]),
    en: toTrimmedString(source[eKey]),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Compact the TD GeoJSON feature list into one entry per route id.
 * Route-level fields repeat on every stop feature, and every routeSeq of a
 * route id carries the same termini, service pattern, journey time and fare,
 * so the first feature per route id plus a stop count is lossless for the
 * directory. Unknown shapes are skipped, never thrown.
 */
export function extractGmbRoutes(data: unknown): GmbRouteEntry[] {
  if (!isRecord(data)) return []
  const features = data['features']
  if (!Array.isArray(features)) return []

  const byRouteId = new Map<number, GmbRouteEntry>()
  for (const feature of features) {
    if (!isRecord(feature)) continue
    const props = feature['properties']
    if (!isRecord(props)) continue
    const routeId = props['routeId']
    if (typeof routeId !== 'number' || !Number.isFinite(routeId)) continue
    const district = props['district']
    if (!isGmbDistrict(district)) continue

    const existing = byRouteId.get(routeId)
    if (existing) {
      existing.stopCount += 1
      continue
    }

    const specialType = props['specialType']
    const journeyTime = props['journeyTime']
    const fullFare = props['fullFare']
    byRouteId.set(routeId, {
      routeId,
      district,
      name: toTrilingual(props, 'routeNameC', 'routeNameS', 'routeNameE'),
      serviceMode: toTrimmedString(props['serviceMode']),
      specialType: typeof specialType === 'number' ? specialType : 0,
      journeyTime: typeof journeyTime === 'number' ? journeyTime : 0,
      origin: toTrilingual(props, 'locStartNameC', 'locStartNameS', 'locStartNameE'),
      destination: toTrilingual(props, 'locEndNameC', 'locEndNameS', 'locEndNameE'),
      fullFare: typeof fullFare === 'number' ? fullFare : Number.NaN,
      lastUpdateDate: toTrimmedString(props['lastUpdateDate']),
      stopCount: 1,
    })
  }

  return sortGmbRoutes(Array.from(byRouteId.values()))
}

/** Numeric-aware sort by route name, matching the bus routes list order. */
export function sortGmbRoutes(routes: GmbRouteEntry[]): GmbRouteEntry[] {
  return [...routes].sort(
    (a, b) =>
      a.name.en.localeCompare(b.name.en, undefined, { numeric: true }) || a.routeId - b.routeId
  )
}

export type GmbRouteFilter = {
  query?: string
  district?: GmbDistrict | 'all' | null
}

/**
 * Filter directory entries by district plus a free-text query matched
 * against the route number and trilingual termini, in any language.
 */
export function filterGmbRoutes(routes: GmbRouteEntry[], filter: GmbRouteFilter): GmbRouteEntry[] {
  const district = filter.district ?? 'all'
  const query = (filter.query ?? '').trim().toLowerCase()
  return routes.filter((route) => {
    if (district !== 'all' && route.district !== district) return false
    if (!query) return true
    const haystack = [
      route.name.en,
      route.name.tc,
      route.name.sc,
      route.origin.en,
      route.origin.tc,
      route.origin.sc,
      route.destination.en,
      route.destination.tc,
      route.destination.sc,
    ]
    return haystack.some((text) => text.toLowerCase().includes(query))
  })
}

function isGmbTrilingual(value: unknown): value is GmbTrilingual {
  if (!isRecord(value)) return false
  return (
    typeof value['en'] === 'string' &&
    typeof value['tc'] === 'string' &&
    typeof value['sc'] === 'string'
  )
}

function isGmbRouteEntry(value: unknown): value is GmbRouteEntry {
  if (!isRecord(value)) return false
  return (
    typeof value['routeId'] === 'number' &&
    isGmbDistrict(value['district']) &&
    isGmbTrilingual(value['name']) &&
    typeof value['serviceMode'] === 'string' &&
    typeof value['specialType'] === 'number' &&
    typeof value['journeyTime'] === 'number' &&
    isGmbTrilingual(value['origin']) &&
    isGmbTrilingual(value['destination']) &&
    typeof value['fullFare'] === 'number' &&
    Number.isFinite(value['fullFare']) &&
    typeof value['lastUpdateDate'] === 'string' &&
    typeof value['stopCount'] === 'number'
  )
}

/**
 * Validate the committed compact file before it reaches the UI. Throws on
 * structural mismatch so a corrupt download fails loudly instead of
 * rendering half-empty cards.
 */
export function parseGmbRouteListFile(data: unknown): GmbRouteListFile {
  if (!isRecord(data)) throw new Error('GMB route file is not an object')
  const meta = data['meta']
  const routes = data['routes']
  if (!isRecord(meta)) throw new Error('GMB route file is missing meta')
  if (!Array.isArray(routes)) throw new Error('GMB route file is missing routes')
  if (
    typeof meta['source'] !== 'string' ||
    typeof meta['dataset'] !== 'string' ||
    typeof meta['cutoffDate'] !== 'string' ||
    typeof meta['generatedAt'] !== 'string' ||
    typeof meta['count'] !== 'number'
  ) {
    throw new Error('GMB route file has invalid meta')
  }
  const entries: GmbRouteEntry[] = []
  for (const route of routes) {
    if (!isGmbRouteEntry(route)) throw new Error('GMB route file has an invalid route entry')
    entries.push(route)
  }
  return {
    meta: {
      source: meta['source'],
      dataset: meta['dataset'],
      cutoffDate: meta['cutoffDate'],
      generatedAt: meta['generatedAt'],
      count: meta['count'],
    },
    routes: entries,
  }
}

/**
 * Read the TD revision cut-off date from DATA_LAST_UPDATED_DATE.csv, which
 * is a short file with a trilingual header line followed by a yyyy-MM-dd
 * line. Returns null when the shape is unrecognized.
 */
export function parseGmbCutoffDate(csv: unknown): string | null {
  if (typeof csv !== 'string') return null
  for (const line of csv.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  }
  return null
}

// ============================================================================
// GMB stop table (per-variant stop lists for the route detail view)
// ============================================================================
//
// scripts/build-gmb-routes.ts compacts the same ~20 MB TD GeoJSON into
// public/data/gmb-stops.json: one entry per route id, each with its
// routeSeq 1/2 variants plus stops ordered by stopSeq. The detail view loads
// that file through lib/eta/direct/gmb-td.ts, so the browser never downloads
// the full GeoJSON at runtime.
//
// The wire format favors arrays over objects to keep the file small:
// - route name, origin and destination are [en, tc, sc] tuples
// - a stop is [stopSeq, stopId, stopPickDrop, lat, lng, nameEn, nameTc, nameSc]

/** Trilingual [en, tc, sc] tuple used by the stops file. */
export type GmbStopsTuple = [string, string, string]

/** Compact stop: [stopSeq, stopId, stopPickDrop, lat, lng, nameEn, nameTc, nameSc]. */
export type GmbStopsFileStop = [number, number, number, number, number, string, string, string]

export type GmbStopsFileVariant = {
  /** TD routeSeq: 1 outbound/circular leg, 2 inbound leg. */
  q: number
  /** TD district code. */
  d: string
  m: string
  o: GmbStopsTuple
  e: GmbStopsTuple
  j: number | null
  f: number | null
  u: string | null
  s: GmbStopsFileStop[]
}

export type GmbStopsFileRoute = {
  /** TD route id. */
  i: number
  n: GmbStopsTuple
  v: GmbStopsFileVariant[]
}

export type GmbStopsFile = {
  meta: GmbRouteListMeta
  routes: GmbStopsFileRoute[]
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toTrilingualTuple(
  source: Record<string, unknown>,
  cKey: string,
  sKey: string,
  eKey: string
): GmbStopsTuple {
  return [
    toTrimmedString(source[eKey]),
    toTrimmedString(source[cKey]),
    toTrimmedString(source[sKey]),
  ]
}

/**
 * Compact the TD GeoJSON feature list into one entry per route id with its
 * routeSeq variants and ordered stops. Coordinates are rounded to 6dp (~10 cm,
 * far below the stop-matching tolerance). Variant-level fields (termini,
 * fare, journey time) repeat on every stop feature, so the first feature per
 * (routeId, routeSeq) provides them. Unknown shapes are skipped, never thrown.
 */
export function extractGmbStops(data: unknown): GmbStopsFileRoute[] {
  if (!isRecord(data)) return []
  const features = data['features']
  if (!Array.isArray(features)) return []

  const byRouteId = new Map<number, GmbStopsFileRoute>()
  const variantsByKey = new Map<string, GmbStopsFileVariant>()
  for (const item of features) {
    if (!isRecord(item)) continue
    const geometry = item['geometry']
    if (!isRecord(geometry)) continue
    const coords = geometry['coordinates']
    if (!Array.isArray(coords) || coords.length < 2) continue
    const lng = toFiniteNumberOrNull(coords[0])
    const lat = toFiniteNumberOrNull(coords[1])
    if (lat === null || lng === null) continue
    const props = item['properties']
    if (!isRecord(props)) continue
    const routeId = toFiniteNumberOrNull(props['routeId'])
    const routeSeq = toFiniteNumberOrNull(props['routeSeq'])
    const stopSeq = toFiniteNumberOrNull(props['stopSeq'])
    const stopId = toFiniteNumberOrNull(props['stopId'])
    const pickDrop = toFiniteNumberOrNull(props['stopPickDrop'])
    if (routeId === null || stopSeq === null || stopId === null || pickDrop === null) continue
    if (routeSeq !== 1 && routeSeq !== 2) continue
    if (pickDrop !== 1 && pickDrop !== 2 && pickDrop !== 3) continue

    let route = byRouteId.get(routeId)
    if (!route) {
      route = {
        i: routeId,
        n: toTrilingualTuple(props, 'routeNameC', 'routeNameS', 'routeNameE'),
        v: [],
      }
      byRouteId.set(routeId, route)
    }
    const key = `${routeId}|${routeSeq}`
    let variant = variantsByKey.get(key)
    if (!variant) {
      variant = {
        q: routeSeq,
        d: toTrimmedString(props['district']),
        m: toTrimmedString(props['serviceMode']),
        o: toTrilingualTuple(props, 'locStartNameC', 'locStartNameS', 'locStartNameE'),
        e: toTrilingualTuple(props, 'locEndNameC', 'locEndNameS', 'locEndNameE'),
        j: toFiniteNumberOrNull(props['journeyTime']),
        f: toFiniteNumberOrNull(props['fullFare']),
        u: typeof props['lastUpdateDate'] === 'string' ? props['lastUpdateDate'] : null,
        s: [],
      }
      variantsByKey.set(key, variant)
      route.v.push(variant)
    }
    variant.s.push([
      stopSeq,
      stopId,
      pickDrop,
      Math.round(lat * 1e6) / 1e6,
      Math.round(lng * 1e6) / 1e6,
      toTrimmedString(props['stopNameE']),
      toTrimmedString(props['stopNameC']),
      toTrimmedString(props['stopNameS']),
    ])
  }

  const routes = Array.from(byRouteId.values()).sort((a, b) => a.i - b.i)
  for (const route of routes) {
    route.v.sort((a, b) => a.q - b.q)
    for (const variant of route.v) variant.s.sort((a, b) => a[0] - b[0])
  }
  return routes
}
