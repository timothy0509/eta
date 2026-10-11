/**
 * Build-time extractor for true road-following transit route shapes.
 *
 * The TD GeoJSON files only carry stop coordinates, so maps drawn from them
 * are straight segments. CSDI publishes survey-grade polylines per
 * (ROUTE_ID, ROUTE_SEQ) in the same TD namespace: FB_ROUTE_LINE for
 * franchised buses and GMB_ROUTE_LINE for green minibuses. This script
 * downloads both layers (~160 MB raw, paged), simplifies them with
 * Douglas-Peucker, and writes a compact same-origin extract the app loads
 * instead of car-profile OSRM routing.
 *
 * Run with: `bun scripts/build-td-route-lines.ts`
 *
 * The app never touches the CSDI server at runtime.
 */

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_PATH = join(ROOT, 'public', 'data', 'td-route-lines.json')

const SOURCES = [
  {
    co: null, // franchised buses carry their own COMPANY_CODE
    layerUrl:
      'https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1638844988873_41214/FeatureServer/0/query',
    nameField: 'ROUTE_NAMEE',
    companyField: 'COMPANY_CODE',
  },
  {
    co: 'GMB',
    layerUrl:
      'https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1697082463580_57453/FeatureServer/0/query',
    nameField: 'ROUTE_NAME',
    companyField: null,
  },
]
const PAGE_SIZE = 200
// Douglas-Peucker tolerance in metres. Route maps are viewed zoomed out to
// fit whole routes, where sub-20 m wiggles are invisible.
const SIMPLIFY_TOLERANCE_M = 20

type LngLat = [number, number]

type RawFeature = {
  properties?: {
    ROUTE_ID?: unknown
    ROUTE_SEQ?: unknown
    COMPANY_CODE?: unknown
    ROUTE_NAMEE?: unknown
    ROUTE_NAME?: unknown
  }
  geometry?: { coordinates?: unknown }
}

async function fetchPage(
  layerUrl: string,
  nameField: string,
  companyField: string | null,
  offset: number
): Promise<{ features: RawFeature[]; done: boolean }> {
  const fields = ['ROUTE_ID', 'ROUTE_SEQ', nameField]
  if (companyField) fields.push(companyField)
  const params = new URLSearchParams({
    where: '1=1',
    outFields: fields.join(','),
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    orderByFields: 'OBJECTID',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
  })
  const response = await fetch(`${layerUrl}?${params.toString()}`)
  if (!response.ok) throw new Error(`CSDI query HTTP ${response.status} at offset ${offset}`)
  const text = await response.text()
  const json = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as {
    features?: RawFeature[]
    error?: { message?: string } | null
  }
  // ArcGIS answers HTTP 200 with an error body for bad queries in geojson
  // mode; a silent zero here would quietly drop a whole layer.
  if (json.error) {
    throw new Error(`CSDI error at offset ${offset}: ${json.error.message ?? 'unknown'}`)
  }
  const features = Array.isArray(json.features) ? json.features : []
  return { features, done: features.length < PAGE_SIZE }
}

function toFiniteNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(num) ? num : null
}

function toLngLat(pair: unknown): LngLat | null {
  if (!Array.isArray(pair) || pair.length < 2) return null
  const lng = toFiniteNumber(pair[0])
  const lat = toFiniteNumber(pair[1])
  if (lng === null || lat === null) return null
  if (lng < 100 || lng > 120 || lat < 10 || lat > 30) return null
  return [lng, lat]
}

// Equirectangular projection around Hong Kong, good to millimetres here.
function toMetres(p: LngLat): [number, number] {
  const kx = 111_320 * Math.cos((22.3 * Math.PI) / 180)
  return [p[0] * kx, p[1] * 110_540]
}

function perpendicularDistanceM(point: LngLat, start: LngLat, end: LngLat): number {
  const [px, py] = toMetres(point)
  const [sx, sy] = toMetres(start)
  const [ex, ey] = toMetres(end)
  const dx = ex - sx
  const dy = ey - sy
  if (dx === 0 && dy === 0) return Math.hypot(px - sx, py - sy)
  const t = ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy)
  const cx = sx + t * dx
  const cy = sy + t * dy
  return Math.hypot(px - cx, py - cy)
}

function douglasPeucker(points: LngLat[], toleranceM: number): LngLat[] {
  if (points.length <= 2) return points
  const first = points[0]
  const last = points[points.length - 1]
  let maxDist = 0
  let maxIndex = 0
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistanceM(points[i], first, last)
    if (dist > maxDist) {
      maxDist = dist
      maxIndex = i
    }
  }
  if (maxDist <= toleranceM) return [first, last]
  const left = douglasPeucker(points.slice(0, maxIndex + 1), toleranceM)
  const right = douglasPeucker(points.slice(maxIndex), toleranceM)
  return [...left.slice(0, -1), ...right]
}

function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5
}

async function main(): Promise<void> {
  const lines: Record<string, Array<{ co: string; seq: number; id: number; pts: LngLat[] }>> = {}
  let rawPoints = 0
  let keptPoints = 0
  let skipped = 0
  for (const source of SOURCES) {
    let offset = 0
    for (;;) {
      const { features, done } = await fetchPage(
        source.layerUrl,
        source.nameField,
        source.companyField,
        offset
      )
      console.log(`offset ${offset}: ${features.length} features`)
      for (const feature of features) {
        const attrs = feature.properties ?? {}
        const routeId = toFiniteNumber(attrs.ROUTE_ID)
        const routeSeq = toFiniteNumber(attrs.ROUTE_SEQ)
        const company =
          source.co ??
          (typeof attrs.COMPANY_CODE === 'string' ? attrs.COMPANY_CODE.trim().toUpperCase() : '')
        const rawName = source.nameField === 'ROUTE_NAME' ? attrs.ROUTE_NAME : attrs.ROUTE_NAMEE
        const routeName = typeof rawName === 'string' ? rawName.trim().toUpperCase() : ''
        const parts = feature.geometry?.coordinates
        if (
          routeId === null ||
          (routeSeq !== 1 && routeSeq !== 2) ||
          !company ||
          !routeName ||
          !Array.isArray(parts)
        ) {
          skipped += 1
          continue
        }
        // MultiLineString parts already run in travel order; join them.
        // The GMB layer publishes LineString instead, whose top-level
        // entries are coordinates, not parts.
        const joined: LngLat[] = []
        const addPair = (pair: unknown): void => {
          const point = toLngLat(pair)
          if (!point) return
          const prev = joined[joined.length - 1]
          if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) joined.push(point)
        }
        for (const part of parts) {
          if (!Array.isArray(part)) continue
          // A numeric first element means the pair itself (LineString).
          if (toFiniteNumber(part[0]) !== null) {
            addPair(part)
            continue
          }
          for (const pair of part) addPair(pair)
        }
        if (joined.length < 2) {
          skipped += 1
          continue
        }
        rawPoints += joined.length
        const simplified = douglasPeucker(joined, SIMPLIFY_TOLERANCE_M).map(
          ([lng, lat]): LngLat => [round5(lng), round5(lat)]
        )
        keptPoints += simplified.length
        const bucket = lines[routeName] ?? []
        bucket.push({ co: company, seq: routeSeq, id: routeId, pts: simplified })
        lines[routeName] = bucket
      }
      if (done) break
      offset += PAGE_SIZE
    }
  }

  const payload = {
    meta: {
      source: SOURCES.map((s) => s.layerUrl),
      dataset: 'https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson',
      generatedAt: new Date().toISOString(),
      simplifyToleranceM: SIMPLIFY_TOLERANCE_M,
      routes: Object.keys(lines).length,
    },
    lines,
  }
  await writeFile(OUT_PATH, `${JSON.stringify(payload)}\n`)
  console.log(
    `routes: ${Object.keys(lines).length}, skipped: ${skipped}, ` +
      `points ${rawPoints} -> ${keptPoints} ` +
      `(${((100 * keptPoints) / Math.max(1, rawPoints)).toFixed(1)}% kept)`
  )
  console.log(`wrote ${OUT_PATH}`)
}

await main()
