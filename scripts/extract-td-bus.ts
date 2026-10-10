/**
 * One-off extractor for Transport Department bus enrichment data.
 *
 * Downloads the full TD routes/fares GeoJSON (~78 MB, updated biweekly) plus
 * the hk-bus-eta route database, joins TD route variants to hk-bus-eta
 * variants by stop-coordinate alignment, and writes only the fields the app
 * needs to `lib/data/td-bus-variants.json`.
 *
 * Run with: `bun scripts/extract-td-bus.ts`
 *
 * The app never fetches the 78 MB file at runtime; it static-imports the
 * generated per-variant file through `lib/eta/td-bus.ts`.
 */

import { writeFile } from 'node:fs/promises'

const TD_URL = 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json'
const HK_BUS_DB_URL = 'https://hkbus.github.io/hk-bus-crawling/routeFareList.min.json'
const OUT_PATH = new URL('../lib/data/td-bus-variants.json', import.meta.url)

// TD company codes in scope, matched against hk-bus-eta `co` values.
const TD_COMPANIES = new Set(['KMB', 'CTB', 'KMB+CTB', 'NLB'])
const HK_COMPANIES = new Set(['kmb', 'ctb', 'nlb'])

// Max distance (metres) for a TD stop point to count as the same physical
// stop as an hk-bus-eta stop. TD and hk coordinates for route 1 align within
// ~65 m; 150 m leaves headroom without merging neighbouring stops.
const MATCH_TOLERANCE_M = 150
const MIN_MATCH_SCORE = 0.6

type TdStop = { lat: number; lng: number; pickDrop: number }
type TdVariant = {
  routeId: number
  routeSeq: number
  companies: string[]
  routeName: string
  serviceMode: string
  specialType: number
  journeyTime: number | null
  fullFare: number | null
  stops: TdStop[]
}

type HkVariant = {
  key: string
  co: string
  route: string
  bound: string
  serviceType: string
  stops: { lat: number; lng: number }[]
}

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function nearestWithin(
  stops: TdStop[],
  lat: number,
  lng: number,
  toleranceM: number
): TdStop | null {
  let best: TdStop | null = null
  let bestDist = toleranceM
  for (const stop of stops) {
    const dist = haversineM(lat, lng, stop.lat, stop.lng)
    if (dist <= bestDist) {
      bestDist = dist
      best = stop
    }
  }
  return best
}

/** Fraction of hk stops that have a TD stop within tolerance. */
function alignmentScore(hk: HkVariant, td: TdVariant): number {
  if (hk.stops.length === 0 || td.stops.length === 0) return 0
  let matched = 0
  for (const stop of hk.stops) {
    if (nearestWithin(td.stops, stop.lat, stop.lng, MATCH_TOLERANCE_M)) matched += 1
  }
  const coverage = matched / hk.stops.length
  const lengthFactor =
    Math.min(hk.stops.length, td.stops.length) / Math.max(hk.stops.length, td.stops.length)
  return coverage * (0.5 + 0.5 * lengthFactor)
}

function isRegular(td: TdVariant): boolean {
  return td.serviceMode === 'R' && td.specialType === 0
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
  return await res.json()
}

type TdFeature = {
  geometry?: { coordinates?: [number, number] }
  properties: Record<string, unknown>
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

async function main(): Promise<void> {
  console.log(`fetching ${TD_URL}`)
  const td = (await fetchJson(TD_URL)) as { features?: TdFeature[] }
  const features = td.features ?? []
  console.log(`TD features: ${features.length}`)

  const tdByRoute = new Map<string, TdVariant[]>()
  let tdLastUpdate = ''
  for (const feature of features) {
    const p = feature.properties ?? {}
    const companyCode = str(p.companyCode)
    if (!TD_COMPANIES.has(companyCode)) continue
    const coords = feature.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) continue
    const routeName = str(p.routeNameE).trim().toUpperCase()
    if (!routeName) continue
    const routeId = num(p.routeId) ?? 0
    const routeSeq = num(p.routeSeq) ?? 0
    const stopSeq = num(p.stopSeq) ?? 0
    if (stopSeq < 1) continue
    const lastUpdate = str(p.lastUpdateDate)
    if (lastUpdate > tdLastUpdate) tdLastUpdate = lastUpdate
    const groupKey = `${companyCode}|${routeName}`
    let list = tdByRoute.get(groupKey)
    if (!list) {
      list = []
      tdByRoute.set(groupKey, list)
    }
    let variant = list.find((v) => v.routeId === routeId && v.routeSeq === routeSeq)
    if (!variant) {
      variant = {
        routeId,
        routeSeq,
        companies: companyCode.split('+').map((c) => c.trim().toLowerCase()),
        routeName,
        serviceMode: str(p.serviceMode) || 'R',
        specialType: num(p.specialType) ?? 0,
        journeyTime: num(p.journeyTime),
        fullFare: num(p.fullFare),
        stops: [],
      }
      list.push(variant)
    }
    variant.stops.push({
      lat: coords[1] as number,
      lng: coords[0] as number,
      pickDrop: num(p.stopPickDrop) ?? 0,
    })
  }

  console.log(`fetching ${HK_BUS_DB_URL}`)
  const db = (await fetchJson(HK_BUS_DB_URL)) as {
    routeList?: Record<string, Record<string, unknown>>
    stopList?: Record<string, { location?: { lat?: unknown; lng?: unknown } }>
  }
  const routeList = db.routeList ?? {}
  const stopList = db.stopList ?? {}

  const hkVariants: HkVariant[] = []
  for (const entry of Object.values(routeList)) {
    const route = str(entry.route).trim().toUpperCase()
    if (!route) continue
    const serviceType = str(entry.serviceType ?? '')
    const cos = (entry.co ?? []) as string[]
    const stops = (entry.stops ?? {}) as Record<string, string[]>
    const bound = (entry.bound ?? {}) as Record<string, string>
    for (const co of cos) {
      if (!HK_COMPANIES.has(co)) continue
      const stopIds = stops[co] ?? []
      const coords = stopIds
        .map((id) => stopList[id]?.location)
        .filter(
          (loc): loc is { lat: number; lng: number } =>
            !!loc && typeof loc.lat === 'number' && typeof loc.lng === 'number'
        )
      if (!stopIds.length || !coords.length) continue
      hkVariants.push({
        key: `${co}|${route}|${bound[co] ?? ''}|${serviceType}`,
        co,
        route,
        bound: bound[co] ?? '',
        serviceType,
        stops: coords,
      })
    }
  }
  console.log(`hk variants in scope: ${hkVariants.length}`)

  // Index TD variants by route name for candidate lookup.
  const tdByRouteName = new Map<string, TdVariant[]>()
  for (const list of tdByRoute.values()) {
    for (const variant of list) {
      const arr = tdByRouteName.get(variant.routeName) ?? []
      arr.push(variant)
      tdByRouteName.set(variant.routeName, arr)
    }
  }

  const out: Record<
    string,
    { m: string; s: number; t: number | null; f: number | null; p: string; id: number }
  > = {}
  let matched = 0
  let unmatched = 0
  for (const hk of hkVariants) {
    const candidates = (tdByRouteName.get(hk.route) ?? []).filter((td) =>
      td.companies.includes(hk.co)
    )
    let best: TdVariant | null = null
    let bestScore = 0
    for (const td of candidates) {
      const score = alignmentScore(hk, td)
      if (score > bestScore || (score === bestScore && best && isRegular(td) && !isRegular(best))) {
        bestScore = score
        best = td
      }
    }
    if (!best || bestScore < MIN_MATCH_SCORE) {
      unmatched += 1
      continue
    }
    // Align per stop position: nearest TD stop within tolerance, else unknown.
    let pick = ''
    for (const stop of hk.stops) {
      const near = nearestWithin(best.stops, stop.lat, stop.lng, MATCH_TOLERANCE_M)
      const pd = near?.pickDrop ?? 0
      pick += pd === 1 || pd === 2 || pd === 3 ? String(pd) : '0'
    }
    out[hk.key] = {
      m: best.serviceMode,
      s: best.specialType,
      t: best.journeyTime,
      f: best.fullFare,
      p: pick,
      id: best.routeId,
    }
    matched += 1
  }

  const payload = {
    source: TD_URL,
    tdLastUpdate,
    generatedAt: new Date().toISOString(),
    matchToleranceM: MATCH_TOLERANCE_M,
    minMatchScore: MIN_MATCH_SCORE,
    variants: out,
  }
  await writeFile(OUT_PATH, `${JSON.stringify(payload)}\n`)
  console.log(`matched: ${matched}, unmatched: ${unmatched}`)
  console.log(`wrote ${OUT_PATH}`)
}

await main()
