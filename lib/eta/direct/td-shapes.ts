import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { tdRouteShapesKey } from '@/lib/eta/cache/keys'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { fetchJson } from '@/lib/eta/http'
import { haversineDistanceKm, type GeoPoint } from '@/lib/eta/geo'
import { dedupeConsecutive } from '@/lib/eta/direct/osrm'
import { normalizeOperator } from '@/lib/eta/operator-colors'

export type TdRouteDataset = 'bus' | 'gmb'

export const TD_BUS_SHAPES_URL = 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json'
export const TD_GMB_SHAPES_URL = 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json'

const TD_DATASET_URLS: Record<TdRouteDataset, string> = {
  bus: TD_BUS_SHAPES_URL,
  gmb: TD_GMB_SHAPES_URL,
}

// Hong Kong sits near lat 22.3, lng 114.2. These bounds only drop junk
// coordinates such as swapped lng/lat pairs, never real stops.
const HK_LAT_MIN = 21
const HK_LAT_MAX = 24
const HK_LNG_MIN = 112
const HK_LNG_MAX = 116

// A variant stop counts as covered when it sits within this distance of a TD
// stop. Opposite directions share the same roads, so coverage alone cannot
// pick a direction; endpoint comparison below breaks the tie.
const TD_MATCH_RADIUS_M = 200
const TD_MIN_COVERAGE = 0.4

export type TdRouteShape = {
  routeName: string
  routeId: number
  /** Directional shape sequence. 1 and 2 are the two directions of a route. */
  routeSeq: number
  /** Upper-cased company codes, split from TD companyCode values like KMB+CTB. */
  companies: string[]
  /** Stop coordinates in stopSeq order. */
  points: GeoPoint[]
}

export type TdRouteShapeIndex = Record<string, TdRouteShape[]>

export type TdInstantShape = {
  points: GeoPoint[]
  routeId: number
  routeSeq: number
}

function isValidTdPoint(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= HK_LAT_MIN &&
    lat <= HK_LAT_MAX &&
    lng >= HK_LNG_MIN &&
    lng <= HK_LNG_MAX
  )
}

function parseTdPoint(geometry: unknown): GeoPoint | null {
  if (typeof geometry !== 'object' || geometry === null) return null
  const { type, coordinates } = geometry as { type?: unknown; coordinates?: unknown }
  if (type !== 'Point' || !Array.isArray(coordinates) || coordinates.length < 2) return null
  const lng = Number(coordinates[0])
  const lat = Number(coordinates[1])
  if (!isValidTdPoint(lat, lng)) return null
  return { lat, lng }
}

type TdShapeProperties = {
  routeName: string
  routeId: number
  routeSeq: number
  stopSeq: number
  companies: string[]
}

function parseTdProperties(properties: unknown): TdShapeProperties | null {
  if (typeof properties !== 'object' || properties === null) return null
  const props = properties as Record<string, unknown>
  const routeName = String(props.routeNameE ?? '')
    .trim()
    .toUpperCase()
  const routeId = Number(props.routeId)
  const routeSeq = Number(props.routeSeq)
  const stopSeq = Number(props.stopSeq)
  const companies = String(props.companyCode ?? '')
    .toUpperCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!routeName) return null
  if (!Number.isFinite(routeId) || !Number.isFinite(routeSeq) || !Number.isFinite(stopSeq)) {
    return null
  }
  if (companies.length === 0) return null
  return { routeName, routeId, routeSeq, stopSeq, companies }
}

/**
 * Reduce a TD routes-fares GeoJSON collection to per-route directional
 * shapes. Every feature carries one stop, so features group by route plus
 * routeId plus routeSeq, then sort by stopSeq. routeSeq 1 and 2 stay
 * separate entries because they trace opposite directions. Invalid
 * features are skipped without failing the whole file.
 */
export function parseTdRouteShapesJson(json: unknown): TdRouteShapeIndex {
  const index: TdRouteShapeIndex = {}
  if (typeof json !== 'object' || json === null) return index
  const features = (json as { features?: unknown }).features
  if (!Array.isArray(features)) return index

  const groups = new Map<string, { shape: TdRouteShape; stopSeqs: number[] }>()
  for (const feature of features) {
    if (typeof feature !== 'object' || feature === null) continue
    const { geometry, properties } = feature as { geometry?: unknown; properties?: unknown }
    const point = parseTdPoint(geometry)
    const parsed = parseTdProperties(properties)
    if (!point || !parsed) continue
    const key = `${parsed.routeName}|${parsed.routeId}|${parsed.routeSeq}`
    let group = groups.get(key)
    if (!group) {
      group = {
        shape: {
          routeName: parsed.routeName,
          routeId: parsed.routeId,
          routeSeq: parsed.routeSeq,
          companies: parsed.companies,
          points: [],
        },
        stopSeqs: [],
      }
      groups.set(key, group)
    }
    group.shape.points.push(point)
    group.stopSeqs.push(parsed.stopSeq)
  }

  for (const group of groups.values()) {
    const order = group.stopSeqs
      .map((stopSeq, idx) => ({ stopSeq, idx }))
      .sort((a, b) => a.stopSeq - b.stopSeq)
    const ordered = order.map((entry) => group.shape.points[entry.idx])
    const deduped = dedupeConsecutive(ordered.filter(Boolean))
    if (deduped.length < 2) continue
    group.shape.points = deduped
    const bucket = index[group.shape.routeName] ?? []
    bucket.push(group.shape)
    index[group.shape.routeName] = bucket
  }
  return index
}

/**
 * Fetch one TD dataset and keep the parsed shape index in memory plus
 * IndexedDB under the existing kmbRouteGeometry policy. The file is large
 * and changes biweekly, so callers share one cached copy per dataset and
 * derive every route shape from it with no further network calls.
 */
export async function getTdRouteShapeIndex(
  dataset: TdRouteDataset,
  options?: { signal?: AbortSignal }
): Promise<TdRouteShapeIndex> {
  const { value } = await getCachedValue<TdRouteShapeIndex>({
    key: tdRouteShapesKey(dataset),
    policyKey: 'tdRouteShapes',
    policy: CACHE_POLICIES.kmbRouteGeometry,
    allowStale: true,
    signal: options?.signal,
    fetcher: async () => {
      const json = await fetchJson<unknown>(TD_DATASET_URLS[dataset], {
        cache: 'no-store',
        signal: options?.signal,
      })
      return parseTdRouteShapesJson(json)
    },
  })
  return value
}

function countNearby(points: GeoPoint[], anchors: GeoPoint[], radiusM: number): number {
  let count = 0
  for (const point of points) {
    for (const anchor of anchors) {
      if (haversineDistanceKm(point, anchor) * 1000 <= radiusM) {
        count += 1
        break
      }
    }
  }
  return count
}

/**
 * Pick the TD shape that best matches a route variant. Candidates share the
 * route number and a compatible company; the winner needs enough stop
 * overlap, then the same-orientation endpoint distance decides the
 * direction. Returns null when nothing matches, so callers fall back to
 * their own stop coordinates.
 */
export function selectTdShape(
  candidates: TdRouteShape[],
  co: string,
  variantPoints: GeoPoint[]
): TdRouteShape | null {
  if (candidates.length === 0 || variantPoints.length === 0) return null
  const first = variantPoints[0]
  const last = variantPoints[variantPoints.length - 1]
  if (!first || !last) return null
  const company = normalizeOperator(co).toUpperCase()

  let best: TdRouteShape | null = null
  let bestEndpointErr = Number.POSITIVE_INFINITY
  let bestCoverage = 0

  for (const candidate of candidates) {
    if (!candidate.companies.includes(company)) continue
    if (candidate.points.length < 2) continue
    const forward =
      countNearby(variantPoints, candidate.points, TD_MATCH_RADIUS_M) / variantPoints.length
    const reverse =
      countNearby(candidate.points, variantPoints, TD_MATCH_RADIUS_M) / candidate.points.length
    const coverage = Math.max(forward, reverse)
    if (coverage < TD_MIN_COVERAGE) continue

    const start = candidate.points[0]
    const end = candidate.points[candidate.points.length - 1]
    if (!start || !end) continue
    // Both lists run in travel order, so the correct direction pairs the
    // first stops and the last stops. The opposite direction lands far
    // from both ends even though its coverage also scores high.
    const endpointErr = haversineDistanceKm(first, start) + haversineDistanceKm(last, end)
    const isBetter =
      endpointErr < bestEndpointErr || (endpointErr === bestEndpointErr && coverage > bestCoverage)
    if (isBetter) {
      best = candidate
      bestEndpointErr = endpointErr
      bestCoverage = coverage
    }
  }
  return best
}

/**
 * Resolve the instant map shape for one route variant: TD stop coordinates
 * in stopSeq order. Joining these points draws straight segments between
 * consecutive stops, which cut corners versus the true road geometry, so
 * this shape is the fast first paint and road-snapped geometry (OSRM)
 * remains the upgrade path where available.
 */
export async function resolveTdInstantPath(params: {
  dataset: TdRouteDataset
  route: string
  co: string
  variantPoints: GeoPoint[]
  signal?: AbortSignal
}): Promise<TdInstantShape | null> {
  if (params.variantPoints.length < 2) return null
  const index = await getTdRouteShapeIndex(params.dataset, { signal: params.signal })
  const candidates =
    index[
      String(params.route ?? '')
        .trim()
        .toUpperCase()
    ] ?? []
  const match = selectTdShape(candidates, params.co, params.variantPoints)
  if (!match || match.points.length < 2) return null
  return { points: match.points, routeId: match.routeId, routeSeq: match.routeSeq }
}
