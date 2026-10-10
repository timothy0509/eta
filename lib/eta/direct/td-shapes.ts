import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { tdRouteShapesKey } from '@/lib/eta/cache/keys'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { fetchJson } from '@/lib/eta/http'
import { haversineDistanceKm, type GeoPoint } from '@/lib/eta/geo'
import { dedupeConsecutive } from '@/lib/eta/direct/osrm'
import { normalizeOperator } from '@/lib/eta/operator-colors'

export type TdRouteDataset = 'bus' | 'gmb'

// Compact per-variant extracts built by scripts/build-td-shapes.ts and served
// same-origin. The raw TD routes-fares GeoJSON files (~78 MB bus plus ~20 MB
// GMB) are never downloaded in the browser; the extracts carry the same stop
// coordinates in stopSeq order as rounded [lng, lat] pairs.
export const TD_BUS_SHAPES_URL = '/data/td-shapes-bus.json'
export const TD_GMB_SHAPES_URL = '/data/td-shapes-gmb.json'

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
  /** Upper-cased company codes, split from compact `co` values like KMB+CTB. */
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

function parseTdCompactEntry(routeName: string, entry: unknown): TdRouteShape | null {
  if (typeof entry !== 'object' || entry === null) return null
  const record = entry as Record<string, unknown>
  const routeId = Number(record.id)
  const routeSeq = Number(record.seq)
  const companies = String(record.co ?? '')
    .toUpperCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  const rawPts = record.pts
  if (!routeName || !Number.isFinite(routeId) || !Number.isFinite(routeSeq)) return null
  if (companies.length === 0 || !Array.isArray(rawPts)) return null

  const points: GeoPoint[] = []
  for (const pair of rawPts) {
    if (!Array.isArray(pair) || pair.length < 2) continue
    const lng = Number(pair[0])
    const lat = Number(pair[1])
    if (!isValidTdPoint(lat, lng)) continue
    points.push({ lat, lng })
  }
  const deduped = dedupeConsecutive(points)
  if (deduped.length < 2) return null
  return { routeName, routeId, routeSeq, companies, points: deduped }
}

/**
 * Expand a compact shapes extract to per-route directional shapes. Entries
 * arrive grouped by route name with points already in stopSeq order, so this
 * only validates and converts [lng, lat] pairs to GeoPoints. routeSeq 1 and
 * 2 stay separate entries because they trace opposite directions. Invalid
 * entries are skipped without failing the whole file.
 */
export function parseTdCompactShapesJson(json: unknown): TdRouteShapeIndex {
  const index: TdRouteShapeIndex = {}
  if (typeof json !== 'object' || json === null) return index
  const shapes = (json as { shapes?: unknown }).shapes
  if (typeof shapes !== 'object' || shapes === null || Array.isArray(shapes)) return index

  for (const [key, entries] of Object.entries(shapes)) {
    const routeName = String(key ?? '')
      .trim()
      .toUpperCase()
    if (!routeName || !Array.isArray(entries)) continue
    for (const entry of entries) {
      const shape = parseTdCompactEntry(routeName, entry)
      if (!shape) continue
      const bucket = index[routeName] ?? []
      bucket.push(shape)
      index[routeName] = bucket
    }
  }
  return index
}

/**
 * Fetch one compact shapes extract and keep the parsed shape index in memory
 * plus IndexedDB under the existing kmbRouteGeometry policy. The extracts
 * change biweekly, so callers share one cached copy per dataset and derive
 * every route shape from it with no further network calls. Only the dataset
 * for the requested variant is ever fetched.
 */
export async function getTdRouteShapeIndex(
  dataset: TdRouteDataset,
  options?: { signal?: AbortSignal }
): Promise<TdRouteShapeIndex> {
  const url = TD_DATASET_URLS[dataset]
  const fetchShapes = async (): Promise<TdRouteShapeIndex> => {
    const json = await fetchJson<unknown>(url, {
      cache: 'no-store',
      signal: options?.signal,
    })
    return parseTdCompactShapesJson(json)
  }
  try {
    const { value } = await getCachedValue<TdRouteShapeIndex>({
      key: tdRouteShapesKey(dataset),
      policyKey: 'tdRouteShapes',
      policy: CACHE_POLICIES.kmbRouteGeometry,
      allowStale: true,
      signal: options?.signal,
      fetcher: fetchShapes,
    })
    return value
  } catch (error) {
    if (options?.signal?.aborted) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    // The cache path persists to IndexedDB after a good download, so a quota
    // failure rejects even though the data is fine. Retry once without the
    // cache rather than failing a good fetch.
    const json = await fetchJson<unknown>(url, {
      cache: 'no-store',
      signal: options?.signal,
    })
    return parseTdCompactShapesJson(json)
  }
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
 * direction. Loop routes start and end at the same stop, so the endpoint
 * tie-break cannot tell the two directions apart and the pick falls through
 * to coverage comparison, which may select the wrong direction's shape.
 * Returns null when nothing matches, so callers fall back to
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
