/**
 * Build the compact TD route-shape extracts served at /data/td-shapes-*.json.
 *
 * The TD source files are ~78 MB (bus) plus ~20 MB (GMB) of per-stop GeoJSON
 * with route fields repeated on every stop, far too heavy for browsers to
 * download at runtime to draw one route polyline. This script compacts each
 * file to one entry per route variant (routeId plus routeSeq) with stop
 * coordinates in stopSeq order as rounded 6dp [lng, lat] pairs. Re-run after
 * each biweekly TD update:
 *
 *   bun scripts/build-td-shapes.ts
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TD_BUS_GEOJSON_URL = 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json'
const TD_GMB_GEOJSON_URL = 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_BUS_PATH = join(ROOT, 'public', 'data', 'td-shapes-bus.json')
const OUT_GMB_PATH = join(ROOT, 'public', 'data', 'td-shapes-gmb.json')

// Hong Kong sits near lat 22.3, lng 114.2. These bounds only drop junk
// coordinates such as swapped lng/lat pairs, never real stops.
const HK_LAT_MIN = 21
const HK_LAT_MAX = 24
const HK_LNG_MIN = 112
const HK_LNG_MAX = 116

type CompactShape = {
  /** TD routeId: distinguishes special departures sharing a route number. */
  id: number
  /** TD routeSeq: 1 and 2 are the two directions of a route. */
  seq: number
  /** Upper-cased TD companyCode as written, e.g. KMB or KMB+CTB. */
  co: string
  /** Stop coordinates in stopSeq order as rounded [lng, lat] pairs. */
  pts: Array<[number, number]>
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`)
  const text = await response.text()
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function isValidStopPoint(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= HK_LAT_MIN &&
    lat <= HK_LAT_MAX &&
    lng >= HK_LNG_MIN &&
    lng <= HK_LNG_MAX
  )
}

type StopSlot = { stopSeq: number; order: number; lng: number; lat: number }

type ShapeGroup = {
  name: string
  id: number
  seq: number
  co: string
  slots: StopSlot[]
}

/**
 * Reduce a TD routes-fares GeoJSON collection to per-route directional
 * shapes. Every feature carries one stop, so features group by route plus
 * routeId plus routeSeq, then sort by stopSeq. routeSeq 1 and 2 stay
 * separate entries because they trace opposite directions. Invalid
 * features are skipped without failing the whole file.
 */
function extractShapes(json: unknown): { shapes: Record<string, CompactShape[]>; skipped: number } {
  const groups = new Map<string, ShapeGroup>()
  let skipped = 0
  const features =
    typeof json === 'object' &&
    json !== null &&
    Array.isArray((json as { features?: unknown }).features)
      ? (json as { features: unknown[] }).features
      : []
  let order = 0
  for (const feature of features) {
    order += 1
    if (typeof feature !== 'object' || feature === null) {
      skipped += 1
      continue
    }
    const { geometry, properties } = feature as { geometry?: unknown; properties?: unknown }

    let lng = Number.NaN
    let lat = Number.NaN
    if (typeof geometry === 'object' && geometry !== null) {
      const { type, coordinates } = geometry as { type?: unknown; coordinates?: unknown }
      if (type === 'Point' && Array.isArray(coordinates) && coordinates.length >= 2) {
        lng = Number(coordinates[0])
        lat = Number(coordinates[1])
      }
    }

    let name = ''
    let routeId = Number.NaN
    let routeSeq = Number.NaN
    let stopSeq = Number.NaN
    let companyCode = ''
    if (typeof properties === 'object' && properties !== null) {
      const props = properties as Record<string, unknown>
      name = String(props.routeNameE ?? '')
        .trim()
        .toUpperCase()
      routeId = Number(props.routeId)
      routeSeq = Number(props.routeSeq)
      stopSeq = Number(props.stopSeq)
      companyCode = String(props.companyCode ?? '')
        .trim()
        .toUpperCase()
    }

    if (
      !isValidStopPoint(lat, lng) ||
      !name ||
      !Number.isFinite(routeId) ||
      !Number.isFinite(routeSeq) ||
      !Number.isFinite(stopSeq) ||
      stopSeq < 1 ||
      !companyCode
    ) {
      skipped += 1
      continue
    }
    const key = `${name}|${routeId}|${routeSeq}`
    let group = groups.get(key)
    if (!group) {
      group = { name, id: routeId, seq: routeSeq, co: companyCode, slots: [] }
      groups.set(key, group)
    }
    group.slots.push({ stopSeq, order, lng: round6(lng), lat: round6(lat) })
  }

  const shapes: Record<string, CompactShape[]> = {}
  for (const group of groups.values()) {
    group.slots.sort((a, b) => a.stopSeq - b.stopSeq || a.order - b.order)
    const pts: Array<[number, number]> = []
    for (const slot of group.slots) {
      const last = pts[pts.length - 1]
      if (last && last[0] === slot.lng && last[1] === slot.lat) continue
      pts.push([slot.lng, slot.lat])
    }
    if (pts.length < 2) {
      skipped += 1
      continue
    }
    const list = shapes[group.name] ?? []
    list.push({ id: group.id, seq: group.seq, co: group.co, pts })
    shapes[group.name] = list
  }
  return { shapes, skipped }
}

async function buildDataset(label: string, url: string, outPath: string): Promise<void> {
  console.log(`fetching ${url}`)
  const text = await fetchText(url)
  console.log(
    `downloaded ${(Buffer.byteLength(text, 'utf8') / 1048576).toFixed(1)} MB of ${label} GeoJSON`
  )
  const { shapes, skipped } = extractShapes(JSON.parse(text) as unknown)
  const variants = Object.values(shapes).reduce((sum, list) => sum + list.length, 0)
  if (variants === 0) throw new Error(`Extract produced no ${label} shapes`)

  const body = JSON.stringify({
    meta: { source: url, generatedAt: new Date().toISOString(), variants },
    shapes,
  })
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, body, 'utf8')
  console.log(
    `wrote ${variants} ${label} variants (${(Buffer.byteLength(body) / 1024).toFixed(0)} KB, skipped ${skipped}) to ${outPath}`
  )
}

async function main(): Promise<void> {
  // Sequential: each source file peaks at several hundred MB of JSON heap.
  await buildDataset('bus', TD_BUS_GEOJSON_URL, OUT_BUS_PATH)
  await buildDataset('gmb', TD_GMB_GEOJSON_URL, OUT_GMB_PATH)
}

await main()
