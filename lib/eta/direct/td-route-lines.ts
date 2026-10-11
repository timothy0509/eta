import { TD_ROUTE_LINES_CACHE_KEY } from '@/lib/eta/cache/keys'
import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { haversineDistanceKm, type GeoPoint } from '@/lib/eta/geo'

export type TdRouteLine = {
  routeId: number
  routeSeq: 1 | 2
  company: string
  points: GeoPoint[]
}

type RawLineEntry = {
  co?: unknown
  seq?: unknown
  id?: unknown
  pts?: unknown
}

function toRouteLine(routeName: string, entry: RawLineEntry): TdRouteLine | null {
  if (typeof entry !== 'object' || entry === null) return null
  const company = typeof entry.co === 'string' ? entry.co.trim().toUpperCase() : ''
  if (!company || !routeName) return null
  const seq = entry.seq === 1 ? 1 : entry.seq === 2 ? 2 : null
  const routeId = typeof entry.id === 'number' && Number.isFinite(entry.id) ? entry.id : null
  if (seq === null || routeId === null) return null
  if (!Array.isArray(entry.pts)) return null
  const points: GeoPoint[] = []
  for (const pair of entry.pts) {
    if (!Array.isArray(pair) || pair.length < 2) continue
    const lng = Number(pair[0])
    const lat = Number(pair[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    if (lng < 100 || lng > 120 || lat < 10 || lat > 30) continue
    const prev = points[points.length - 1]
    if (!prev || prev.lat !== lat || prev.lng !== lng) points.push({ lat, lng })
  }
  if (points.length < 2) return null
  return { routeId, routeSeq: seq, company, points }
}

export function parseTdRouteLinesFile(json: unknown): Map<string, TdRouteLine[]> {
  const index = new Map<string, TdRouteLine[]>()
  if (typeof json !== 'object' || json === null) return index
  const lines = (json as { lines?: unknown }).lines
  if (typeof lines !== 'object' || lines === null || Array.isArray(lines)) return index
  for (const [key, entries] of Object.entries(lines)) {
    const routeName = String(key ?? '')
      .trim()
      .toUpperCase()
    if (!routeName || !Array.isArray(entries)) continue
    for (const entry of entries) {
      const line = toRouteLine(routeName, entry as RawLineEntry)
      if (!line) continue
      const bucket = index.get(routeName) ?? []
      bucket.push(line)
      index.set(routeName, bucket)
    }
  }
  return index
}

/**
 * TD company codes a hk-bus-eta variant company can draw from. Long Win has
 * no hk-bus-eta namespace of its own; its routes ride under kmb. GMB routes
 * come from the TD green minibus directory and match the CSDI GMB layer.
 */
function compatibleTdCompanies(hkCo: string): string[] {
  switch (String(hkCo ?? '').toLowerCase()) {
    case 'kmb':
      return ['KMB', 'LWB', 'KMB+CTB']
    case 'ctb':
      return ['CTB', 'KMB+CTB', 'LWB+CTB']
    case 'nlb':
      return ['NLB']
    case 'gmb':
      return ['GMB']
    default:
      return []
  }
}

function endpointErrorM(line: TdRouteLine, first: GeoPoint, last: GeoPoint): number {
  const start = line.points[0]
  const end = line.points[line.points.length - 1]
  return (
    haversineDistanceKm(first, { lat: start.lat, lng: start.lng }) * 1000 +
    haversineDistanceKm(last, { lat: end.lat, lng: end.lng }) * 1000
  )
}

/**
 * Pick the true road-following line for a variant. TD's ROUTE_SEQ does not
 * map onto hk-bus-eta bounds consistently across routes (2E inbound is CSDI
 * seq 1), so direction is decided by endpoints, not by a fixed seq. When
 * several lines share the route name, the one whose endpoints land closest
 * to the variant's first and last stops wins; a matching seq breaks near
 * ties. Returns null when nothing fits, so callers fall back to
 * stop-sequence lines.
 */
export function selectTdRouteLine(
  candidates: TdRouteLine[],
  params: { co: string; bound: string; variantPoints: GeoPoint[] }
): TdRouteLine | null {
  const first = params.variantPoints[0]
  const last = params.variantPoints[params.variantPoints.length - 1]
  if (!first || !last || params.variantPoints.length < 2) return null
  const companies = compatibleTdCompanies(params.co)
  const wantSeq = String(params.bound ?? '').toUpperCase() === 'I' ? 2 : 1
  let best: TdRouteLine | null = null
  let bestErr = Number.POSITIVE_INFINITY
  let bestSeqErr = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    if (!companies.includes(candidate.company)) continue
    const err = endpointErrorM(candidate, first, last)
    const seqErr = candidate.routeSeq === wantSeq ? 0 : 1
    if (err < bestErr || (err === bestErr && seqErr < bestSeqErr)) {
      bestErr = err
      bestSeqErr = seqErr
      best = candidate
    }
  }
  // Endpoints hundreds of metres off mean a wrong leg, not drift.
  if (!best || bestErr > 1000) return null
  return best
}

async function fetchTdRouteLinesIndex(): Promise<Map<string, TdRouteLine[]>> {
  const { value } = await getCachedValue<Map<string, TdRouteLine[]>>({
    key: TD_ROUTE_LINES_CACHE_KEY,
    policyKey: 'tdRouteLines',
    policy: CACHE_POLICIES.kmbStaticList,
    allowStale: true,
    fetcher: async () => {
      const response = await fetch('/data/td-route-lines.json')
      if (!response.ok) throw new Error(`TD route lines HTTP ${response.status}`)
      return parseTdRouteLinesFile(await response.json())
    },
  })
  return value
}

export async function resolveTdRouteLine(params: {
  route: string
  co: string
  bound: string
  variantPoints: GeoPoint[]
  signal?: AbortSignal
}): Promise<TdRouteLine | null> {
  if (params.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  if (params.variantPoints.length < 2) return null
  const index = await fetchTdRouteLinesIndex()
  if (params.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  const candidates =
    index.get(
      String(params.route ?? '')
        .trim()
        .toUpperCase()
    ) ?? []
  return selectTdRouteLine(candidates, params)
}
