#!/usr/bin/env node
/**
 * Downloads the Transport Department headway GTFS feed and compiles it into a
 * same-origin JSON snapshot the app serves from public/headway/:
 * - public/headway/headway.json  (per-variant headway windows + service spans)
 * - public/headway/manifest.json (datasetDate, fetchedAt, routes, windows)
 *
 * Runs as a prebuild/predev step:
 * - skips the rewrite when DATA_LAST_UPDATED_DATE.csv still matches the
 *   checked-in manifest (set FORCE_HEADWAY_FETCH=1 to force)
 * - parses the zip WITHOUT npm deps via the `unzip -p` subprocess; when unzip
 *   is missing it falls back to fetching the individual .txt files
 * - when the network is unusable it keeps any existing snapshot, and only when
 *   no snapshot exists does it write a small hand-written sample (KMB route 1)
 *   so the build works offline; it warns locally and exits 1 under CI
 *   (Vercel sets CI=true) in that no-snapshot case
 * - hosts come from env overrides, so mirrors need no code change:
 *   TD_HEADWAY_GTFS_URL, TD_HEADWAY_BASE_URL, TD_HEADWAY_DATE_URL
 *
 * JSON contract (the lib/eta/headway/* lookup codes against this shape):
 *   { "updated": "YYYY-MM-DD",
 *     "variants": {
 *       "<co>|<ROUTE>|<bound>|<serviceType>": {
 *         "src": ["<td_route_id>"],
 *         "span": { "weekday": ["HHMM","HHMM"], ... },
 *         "headway": { "weekday": [[startMin,endMin,headwayMin],...], ... },
 *         "departures": { "weekday": [depMin,...], ... },
 *         "special": [{ "src": "<td_route_id>", "origin": "<first stop>",
 *                        "departures": { "weekday": [depMin,...], ... } }, ...],
 *         "freqSrc": [<src index into "src">, ...],
 *         "depBySrc": { "<src index>": { "origin": "<first stop>",
 *                        "departures": { "weekday": [depMin,...], ... } }, ... },
 *         "stopCov": { "<app stop id>": [<src index>, ...], ... }
 *       } },
 *     "holidays": ["YYYY-MM-DD", ...] }
 *
 * "departures" holds fixed first-stop departure times (minutes since midnight,
 * values past 1440 mean after midnight) for days that have trips but no
 * frequency windows. Span-only entries (peak-only routes with fixed
 * departures) carry departures plus first/last span but no headway key; mixed
 * variants may carry departures only for the days lacking windows.
 * "special" holds fixed trips (never covered by frequencies.txt) for days
 * that DO have frequency windows: extras the frequency table misses, e.g.
 * peak short workings from another terminus. Each entry names its TD route
 * and first-stop origin. Trips from a route that also feeds the frequency
 * table only count when they fall outside every window that day or their
 * stop pattern differs from every frequency trip pattern (inside-window
 * trips on an identical pattern are presumably the frequency buses
 * themselves).
 * "freqSrc" lists src indexes with frequency trips, "depBySrc" holds
 * per-src fixed departures plus first-stop origin for windowless days, and
 * "stopCov" maps app
 * stop ids (hk-bus-eta unified ids) to the serving src indexes, but only
 * for stops with partial coverage where the display changes: stops no
 * frequency route serves (hide the frequency table there) and stops in
 * span-only variants served by a strict subset of routes (filter the
 * departure list there). Serving sets come from coordinate matching TD
 * stops.txt against the hk-bus-eta stop list (50 m radius); unmapped
 * stops fall back to the variant-level display.
 *
 * Key rules:
 * - co is the lowercased app company (kmb/ctb/gmb/nlb/lrtfeeder). TD agency
 *   LWB rows map onto co "kmb" (the app has no lwb company); joint agencies
 *   (KMB+CTB, LWB+CTB) emit one variant per company. Agencies FERRY, XB, DB,
 *   PI, TRAM and PTRAM, and rows with empty route_short_name, are skipped.
 * - ROUTE is the uppercased route_short_name. bound comes from the TD trip_id
 *   second segment (1 -> O, 2 -> I). serviceType is the app variant's own
 *   service type: trips whose first stop lands near exactly one app variant
 *   first stop (same co/route, within 50 m with 200 m daylight to the
 *   runner-up) accumulate into that variant's key only, so each timetable
 *   pill shows exactly its own trips. Unassigned trips stay in the merged
 *   serviceType "1" key, which doubles as the fallback.
 *   TD and app bound conventions can disagree on specials, so matching
 *   spans every bound and the app bound wins in emitted keys.
 *   The lookup MUST fall back to serviceType "1" when an exact key misses.
 * - Day types fold the calendar.txt weekday bitmasks: any Mon-Fri bit feeds
 *   "weekday", Saturday feeds "saturday", Sunday feeds "sunday". Services that
 *   span several day types (e.g. Mon-Sat, daily) contribute their windows to
 *   each. "holiday" copies the variant's "sunday" windows (holiday service runs
 *   to Sunday timings). The holidays array holds every distinct
 *   calendar_dates.txt exception_type 1 date as YYYY-MM-DD.
 * - Times are minutes-since-midnight ints (values past 1440 mean after
 *   midnight); headway_secs/60 is rounded to whole minutes. Windows are
 *   sorted and overlapping/touching windows with equal headway are merged.
 * - Duplicate TD route_ids for the same (agency, short name) merge into ONE
 *   variant entry: src lists every route_id, windows are unioned. Routes with
 *   trips but zero frequency rows emit a span-only entry (no headway key) so
 *   the UI can still show first/last departures.
 * - manifest "routes" is the variant count; "windows" is the total headway
 *   window count across all variants and day types.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GTFS_BASE = process.env.TD_HEADWAY_BASE_URL || 'https://static.data.gov.hk/td/pt-headway-en'
const GTFS_URL = process.env.TD_HEADWAY_GTFS_URL || `${GTFS_BASE}/gtfs.zip`
const DATE_URL = process.env.TD_HEADWAY_DATE_URL || `${GTFS_BASE}/DATA_LAST_UPDATED_DATE.csv`
const HKBUS_DB_URL = process.env.HKBUS_DB_URL || 'https://data.hkbus.app/routeFareList.min.json'
const OUT_DIR = join(REPO_ROOT, 'public', 'headway')
const HEADWAY_PATH = join(OUT_DIR, 'headway.json')
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json')

const GTFS_FILES = [
  'routes.txt',
  'trips.txt',
  'frequencies.txt',
  'calendar.txt',
  'calendar_dates.txt',
  'stop_times.txt',
  'stops.txt',
]

// TD agencies the app has no company for (plus empty short names, handled at parse).
const SKIP_AGENCIES = new Set(['FERRY', 'XB', 'DB', 'PI', 'TRAM', 'PTRAM'])

// TD agency token (already uppercased) -> app company. LWB folds into kmb.
const AGENCY_TO_CO = {
  KMB: 'kmb',
  LWB: 'kmb',
  CTB: 'ctb',
  GMB: 'gmb',
  NLB: 'nlb',
  LRTFEEDER: 'lrtfeeder',
}

const DAY_TYPES = ['weekday', 'saturday', 'sunday', 'holiday']

function log(msg) {
  console.log(`[fetch-headway] ${msg}`)
}

function isForce() {
  return process.env.FORCE_HEADWAY_FETCH === '1'
}

function isCi() {
  return process.env.CI === 'true'
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (err) {
      lastError = err
      log(`attempt ${attempt} failed for ${url}: ${err}`)
    }
  }
  throw lastError
}

async function fetchTextWithRetry(url, attempts = 3) {
  const bytes = await fetchWithRetry(url, attempts)
  return bytes.toString('utf8')
}

async function writeAtomic(path, bytes) {
  mkdirSync(dirname(path), { recursive: true })
  const tempPath = `${path}.tmp`
  await writeFile(tempPath, bytes)
  await rename(tempPath, path)
}

/** Minimal CSV parser: handles quoted fields, embedded commas and CRLF. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else if (ch !== '\r') {
      field += ch
    }
  }
  row.push(field)
  if (row.length > 1 || row[0] !== '') rows.push(row)
  return rows
}

function rowsToObjects(rows) {
  const header = rows[0].map((h) => h.trim())
  return rows.slice(1).map((cells) => {
    const obj = {}
    for (let i = 0; i < header.length; i += 1) obj[header[i]] = (cells[i] ?? '').trim()
    return obj
  })
}

/** "HH:MM:SS" (hours may exceed 24) -> minutes since midnight. NaN when bad. */
function toMinutes(value) {
  const match = /^(\d{1,3}):(\d{2})(?::(\d{2}))?/.exec(value)
  if (!match) return NaN
  return Number(match[1]) * 60 + Number(match[2])
}

/** Minutes since midnight -> zero-padded "HHMM" (hours may exceed 24). */
function toHHMM(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}${m}`
}

function toIsoDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}

function parseDatasetDate(csvText) {
  const match = csvText.replace(/^\uFEFF/, '').match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
  } catch {
    return null
  }
}

function hasUnzip() {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** Download the zip and extract the six GTFS files via `unzip -p` (no npm deps). */
async function loadViaZip() {
  const zipBytes = await fetchWithRetry(GTFS_URL)
  const tmpPath = join(tmpdir(), `td-headway-${Date.now()}.zip`)
  await writeFile(tmpPath, zipBytes)
  try {
    const out = {}
    for (const name of GTFS_FILES) {
      const bytes = execFileSync('unzip', ['-p', tmpPath, name], { maxBuffer: 256 * 1024 * 1024 })
      out[name] = bytes.toString('utf8')
      log(`unzipped ${name} (${bytes.length} bytes)`)
    }
    return out
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}

/** Fallback when `unzip` is unavailable: fetch each .txt file individually. */
async function loadViaIndividualFiles() {
  const out = {}
  for (const name of GTFS_FILES) {
    const text = await fetchTextWithRetry(`${GTFS_BASE}/${name}`)
    out[name] = text
    log(`fetched ${name} (${text.length} chars)`)
  }
  return out
}

async function loadGtfs() {
  if (hasUnzip()) {
    log(`downloading ${GTFS_URL}`)
    return loadViaZip()
  }
  log('unzip not found, fetching individual .txt files')
  return loadViaIndividualFiles()
}

/** Fold a calendar.txt weekday bitmask into lookup day types. */
function classifyDays(cal) {
  const days = []
  if (cal.monday || cal.tuesday || cal.wednesday || cal.thursday || cal.friday) {
    days.push('weekday')
  }
  if (cal.saturday) days.push('saturday')
  if (cal.sunday) days.push('sunday')
  return days
}

/** Sort windows and merge overlapping/touching ones with equal headway. */
function mergeWindows(windows) {
  const sorted = [...windows].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged = []
  for (const w of sorted) {
    const last = merged[merged.length - 1]
    if (last && last[2] === w[2] && w[0] <= last[1]) {
      last[1] = Math.max(last[1], w[1])
    } else {
      merged.push([...w])
    }
  }
  return merged
}

function newVariant() {
  return { src: new Set(), spanFirst: {}, spanLast: {}, windows: {}, fixed: {} }
}

/**
 * Clean a TD stop_name into a short origin label. Names join agency segments
 * with "|", e.g. "[CTB] PO TAT ESTATE|[KMB+CTB] PO TAT BUS TERMINUS/<BR>PO TAT".
 * Prefer a KMB segment, strip the "[AGENCY]" prefix, cut at "<BR".
 */
function cleanOriginName(raw) {
  const text = String(raw ?? '')
  if (!text) return ''
  const segments = text
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
  const picked = segments.find((s) => s.includes('KMB')) ?? segments[0] ?? ''
  const cut = picked
    .replace(/^\[[^\]]*\]\s*/, '')
    .split('<BR')[0]
    .trim()
  return cut.replace(/\/+$/, '').trim()
}

/** Half-open [start, end) match with overnight wrap (mirrors the app lookup). */
function windowCovers(windows, dep) {
  for (const [start, end] of windows) {
    if (end < start) {
      if (dep >= start || dep < end) return true
    } else if (dep >= start && dep < end) {
      return true
    }
  }
  return false
}

/**
 * Fetch hk-bus-eta stop coordinates for TD->app stop matching. Returns a
 * Map of unified stop id -> { lat, lng }, or null when unreachable (the
 * snapshot still builds, just without per-stop coverage tables).
 */
async function fetchAppStops() {
  try {
    const bytes = await fetchWithRetry(HKBUS_DB_URL)
    const db = JSON.parse(bytes.toString('utf8'))
    const stopList = db?.stopList
    if (!stopList || typeof stopList !== 'object') {
      log('hk-bus-eta db has no stopList, skipping stop coverage')
      return null
    }
    const out = new Map()
    for (const [id, stop] of Object.entries(stopList)) {
      const lat = Number(stop?.location?.lat)
      const lng = Number(stop?.location?.lng)
      if (String(id) && Number.isFinite(lat) && Number.isFinite(lng)) {
        out.set(String(id).trim(), { lat, lng })
      }
    }
    const routeList = db?.routeList
    const routes =
      routeList && typeof routeList === 'object' ? Object.values(routeList) : null
    log(`loaded ${out.size} hk-bus-eta stops for coverage matching`)
    if (routes) log(`loaded ${routes.length} hk-bus-eta routes for variant matching`)
    return { stops: out, routes }
  } catch (err) {
    log(`hk-bus-eta stop fetch failed, skipping stop coverage: ${err}`)
    return null
  }
}

/** Grid index over app stops for radius lookup (0.001 deg cells). */
function buildStopGrid(appStops) {
  const grid = new Map()
  for (const [id, { lat, lng }] of appStops) {
    const key = `${Math.round(lat * 1000)},${Math.round(lng * 1000)}`
    let cell = grid.get(key)
    if (!cell) {
      cell = []
      grid.set(key, cell)
    }
    cell.push([id, lat, lng])
  }
  return grid
}

const STOP_MATCH_RADIUS_M = 50

function approxMeters(lat1, lng1, lat2, lng2) {
  const dLat = (lat1 - lat2) * 111320
  const dLng = (lng1 - lng2) * 101000
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

/** Every app stop id within the match radius of a TD stop coordinate. */
function appStopsNear(grid, lat, lng) {
  const out = []
  const latC = Math.round(lat * 1000)
  const lngC = Math.round(lng * 1000)
  for (let dLat = -2; dLat <= 2; dLat += 1) {
    for (let dLng = -2; dLng <= 2; dLng += 1) {
      const cell = grid.get(`${latC + dLat},${lngC + dLng}`)
      if (!cell) continue
      for (const [id, aLat, aLng] of cell) {
        if (approxMeters(lat, lng, aLat, aLng) <= STOP_MATCH_RADIUS_M) out.push(id)
      }
    }
  }
  return out
}

function buildSnapshot(files, appStops) {
  const routes = rowsToObjects(parseCsv(files['routes.txt']))
  const trips = rowsToObjects(parseCsv(files['trips.txt']))
  const frequencies = rowsToObjects(parseCsv(files['frequencies.txt']))
  const calendars = rowsToObjects(parseCsv(files['calendar.txt']))
  const calendarDates = rowsToObjects(parseCsv(files['calendar_dates.txt']))
  const stopTimes = rowsToObjects(parseCsv(files['stop_times.txt']))
  const stops = rowsToObjects(parseCsv(files['stops.txt']))
  log(
    `parsed routes=${routes.length} trips=${trips.length} frequencies=${frequencies.length} ` +
      `calendar=${calendars.length} calendar_dates=${calendarDates.length} ` +
      `stop_times=${stopTimes.length} stops=${stops.length}`
  )

  // route_id -> { coList, short }
  const routeInfo = new Map()
  let skippedAgency = 0
  let skippedShort = 0
  for (const r of routes) {
    const agency = (r.agency_id || '').toUpperCase()
    const short = (r.route_short_name || '').toUpperCase()
    if (!short) {
      skippedShort += 1
      continue
    }
    const tokens = agency.split('+').map((t) => t.trim())
    if (tokens.some((t) => SKIP_AGENCIES.has(t))) {
      skippedAgency += 1
      continue
    }
    const coList = []
    for (const token of tokens) {
      const co = AGENCY_TO_CO[token]
      if (co && !coList.includes(co)) coList.push(co)
    }
    if (coList.length === 0) {
      skippedAgency += 1
      continue
    }
    routeInfo.set(r.route_id, { coList, short })
  }

  // service_id -> weekday bitmask
  const calendarsById = new Map()
  for (const c of calendars) {
    calendarsById.set(c.service_id, {
      monday: c.monday === '1',
      tuesday: c.tuesday === '1',
      wednesday: c.wednesday === '1',
      thursday: c.thursday === '1',
      friday: c.friday === '1',
      saturday: c.saturday === '1',
      sunday: c.sunday === '1',
    })
  }

  // Every exception_type 1 date is a holiday the lookup treats as holiday day-type.
  const holidaySet = new Set()
  for (const cd of calendarDates) {
    if (cd.exception_type === '1' && /^\d{8}$/.test(cd.date)) {
      holidaySet.add(toIsoDate(cd.date))
    }
  }
  const holidays = [...holidaySet].sort()

  // trip_id -> { routeId, serviceId }
  const tripInfo = new Map()
  for (const t of trips) {
    tripInfo.set(t.trip_id, { routeId: t.route_id, serviceId: t.service_id })
  }

  // trip_id -> first-stop departure in minutes
  const firstDeparture = new Map()
  // trip_id -> first stop_id (for special-departure origin labels)
  const firstStopId = new Map()
  // trip_id -> every TD stop_id it serves (for pattern + coverage analysis)
  const tripStops = new Map()
  for (const st of stopTimes) {
    if (st.stop_id) {
      let set = tripStops.get(st.trip_id)
      if (!set) {
        set = new Set()
        tripStops.set(st.trip_id, set)
      }
      set.add(st.stop_id)
    }
    if (st.stop_sequence !== '1') continue
    const dep = toMinutes(st.departure_time)
    if (Number.isNaN(dep)) continue
    const prev = firstDeparture.get(st.trip_id)
    if (prev === undefined || dep < prev) {
      firstDeparture.set(st.trip_id, dep)
      firstStopId.set(st.trip_id, st.stop_id)
    }
  }

  // TD stop_id -> coordinates for app-stop matching.
  const stopCoords = new Map()
  for (const s of stops) {
    if (!s.stop_id) continue
    const lat = Number(s.stop_lat)
    const lng = Number(s.stop_lon)
    if (Number.isFinite(lat) && Number.isFinite(lng)) stopCoords.set(s.stop_id, [lat, lng])
  }

  // TD stop_id -> cleaned origin label for special departures.
  const originByStopId = new Map()
  for (const s of stops) {
    if (!s.stop_id) continue
    originByStopId.set(s.stop_id, cleanOriginName(s.stop_name))
  }

  const variants = new Map()
  const getVariant = (key) => {
    let v = variants.get(key)
    if (!v) {
      v = newVariant()
      variants.set(key, v)
    }
    return v
  }

  const addTripSpan = (variant, days, dep) => {
    for (const day of days) {
      const first = variant.spanFirst[day]
      if (first === undefined || dep < first) variant.spanFirst[day] = dep
      const last = variant.spanLast[day]
      if (last === undefined || dep > last) variant.spanLast[day] = dep
      // Keep every fixed first-stop departure: days that end up with no
      // frequency windows render these instead of a bare first/last span.
      if (!variant.fixed[day]) variant.fixed[day] = new Set()
      variant.fixed[day].add(dep)
    }
  }

  const resolveTrip = (tripId) => {
    const known = tripInfo.get(tripId)
    if (known) return known
    // Defensive fallback: parse the trip_id segments directly.
    const segs = tripId.split('-')
    if (segs.length < 3) return null
    return { routeId: segs[0], serviceId: segs[2], boundSeg: segs[1], suffix: segs[3] }
  }

  const boundOf = (tripId, routeId) => {
    // seg2: 1 -> O, 2 -> I. Prefer the full trip_id, else the route-bound prefix.
    const seg = tripId.split('-')[1] ?? routeId.split('-')[1]
    if (seg === '1') return 'O'
    if (seg === '2') return 'I'
    return null
  }

  const depOf = (tripId) => {
    const dep = firstDeparture.get(tripId)
    if (dep !== undefined) return dep
    const suffix = tripId.split('-')[3] ?? ''
    const match = /^(\d{2})(\d{2})$/.exec(suffix)
    return match ? Number(match[1]) * 60 + Number(match[2]) : NaN
  }

  const appStopMap = appStops?.stops ?? null
  // App route variants from hk-bus-eta, keyed by co|ROUTE: every
  // (bound, serviceType, first-stop coordinate) triple. Special workings
  // (peak-only branches, short workings) are first-class variants here with
  // their own serviceType, while TD GTFS merges them under one route_id
  // family. TD and app bound conventions can disagree on specials, so
  // matching spans every bound and the app bound wins in emitted keys.
  const appVariantIndex = new Map()
  for (const entry of appStops?.routes ?? []) {
    if (!entry || typeof entry.route !== 'string') continue
    const short = entry.route.toUpperCase()
    if (!short || !entry.co || !entry.bound || !entry.stops) continue
    for (const rawCo of entry.co) {
      const up = String(rawCo ?? '').toUpperCase()
      const co = AGENCY_TO_CO[up] ?? String(rawCo ?? '').toLowerCase()
      if (!co) continue
      const boundKey = entry.bound[rawCo] ?? entry.bound[co]
      if (boundKey !== 'I' && boundKey !== 'O') continue
      const firstId = entry.stops[rawCo]?.[0] ?? entry.stops[co]?.[0]
      const coords = firstId !== undefined ? appStopMap?.get(String(firstId).trim()) : undefined
      if (!coords) continue
      const key = `${co}|${short}`
      let list = appVariantIndex.get(key)
      if (!list) {
        list = []
        appVariantIndex.set(key, list)
      }
      const serviceType = String(entry.serviceType ?? '')
      if (!list.some((c) => c.serviceType === serviceType && c.bound === boundKey)) {
        list.push({ serviceType, bound: boundKey, flat: coords.lat, flng: coords.lng })
      }
    }
  }

  // Assign a TD trip to an app variant key via first-stop proximity: the
  // trip's first TD stop must land near exactly one candidate variant's
  // first stop. Returns a full variant key or null (merged entry only).
  // Trips assigned to serviceType "1" (or single-candidate groups) need no
  // extra entry, so only cross-serviceType splits are returned.
  const ASSIGN_RADIUS_M = 50
  const ASSIGN_MARGIN_M = 200
  let assignedTrips = 0
  let ambiguousTrips = 0
  const assignVariantKey = (co, short, tdFirstStopId) => {
    const cands = appVariantIndex.get(`${co}|${short}`)
    if (!cands || cands.length < 2) return null
    const coords = tdFirstStopId !== undefined ? stopCoords.get(tdFirstStopId) : undefined
    if (!coords) return null
    let best = null
    let second = null
    for (const c of cands) {
      const d = approxMeters(coords[0], coords[1], c.flat, c.flng)
      if (best === null || d < best.d) {
        second = best
        best = { d, c }
      } else if (second === null || d < second.d) {
        second = { d, c }
      }
    }
    if (!best || best.d > ASSIGN_RADIUS_M) return null
    if (second && second.d - best.d < ASSIGN_MARGIN_M) {
      ambiguousTrips += 1
      return null
    }
    if (best.c.serviceType === '1') return null
    assignedTrips += 1
    return `${co}|${short}|${best.c.bound}|${best.c.serviceType}`
  }
  // trip_id|co -> assigned variant key (or null) for the frequencies pass.
  const tripAssign = new Map()

  let tripsUnknownService = 0
  let tripsUnknownRoute = 0
  let tripsUnknownBound = 0
  // Raw trip_ids referenced by frequencies.txt: membership decides whether a
  // trip is a frequency bus without needing trip_id resolution.
  const freqTripIdSet = new Set()
  for (const f of frequencies) {
    if (f.trip_id) freqTripIdSet.add(f.trip_id)
  }
  for (const t of trips) {
    const info = routeInfo.get(t.route_id)
    if (!info) {
      tripsUnknownRoute += 1
      continue
    }
    const cal = calendarsById.get(t.service_id)
    if (!cal) {
      tripsUnknownService += 1
      continue
    }
    const days = classifyDays(cal)
    if (days.length === 0) continue
    const bound = boundOf(t.trip_id, t.route_id)
    if (!bound) {
      tripsUnknownBound += 1
      continue
    }
    const dep = depOf(t.trip_id)
    if (Number.isNaN(dep)) continue
    const originStop = firstStopId.get(t.trip_id)
    const isFreq = freqTripIdSet.has(t.trip_id)
    const stopSet = tripStops.get(t.trip_id)
    const pattern = stopSet ? [...stopSet].sort().join(',') : ''
    for (const co of info.coList) {
      const mergedKey = `${co}|${info.short}|${bound}|1`
      const extraKey = assignVariantKey(co, info.short, originStop)
      tripAssign.set(`${t.trip_id}|${co}`, extraKey && extraKey !== mergedKey ? extraKey : null)
      // Trips confidently assigned to another service type leave the merged
      // entry: each timetable pill shows exactly its own trips.
      const targetKeys = extraKey && extraKey !== mergedKey ? [extraKey] : [mergedKey]
      for (const key of targetKeys) {
        const variant = getVariant(key)
        variant.src.add(t.route_id)
        addTripSpan(variant, days, dep)
        // Per-route TD stop union for app-stop coverage mapping.
        if (!variant.srcStops) variant.srcStops = new Map()
        let stopUnion = variant.srcStops.get(t.route_id)
        if (!stopUnion) {
          stopUnion = new Set()
          variant.srcStops.set(t.route_id, stopUnion)
        }
        if (stopSet) for (const s of stopSet) stopUnion.add(s)
        if (isFreq) {
          // Frequency trip patterns: shared-route fixed trips on an
          // identical pattern are the frequency buses themselves.
          if (!variant.freqPatterns) variant.freqPatterns = new Set()
          if (pattern) variant.freqPatterns.add(pattern)
        } else {
          // Per-route fixed trips for the special-departures section.
          if (!variant.fixedBySrc) variant.fixedBySrc = new Map()
          let perSrc = variant.fixedBySrc.get(t.route_id)
          if (!perSrc) {
            perSrc = { firstStop: originStop, days: {}, patterns: new Set() }
            variant.fixedBySrc.set(t.route_id, perSrc)
          }
          if (perSrc.firstStop === undefined) perSrc.firstStop = originStop
          if (pattern) perSrc.patterns.add(pattern)
          for (const day of days) {
            if (!perSrc.days[day]) perSrc.days[day] = new Set()
            perSrc.days[day].add(dep)
          }
        }
      }
    }
  }

  let freqOrphans = 0
  let freqBadTime = 0
  for (const f of frequencies) {
    const resolved = resolveTrip(f.trip_id)
    if (!resolved) {
      freqOrphans += 1
      continue
    }
    const info = routeInfo.get(resolved.routeId)
    if (!info) continue
    const cal = calendarsById.get(resolved.serviceId)
    if (!cal) continue
    const days = classifyDays(cal)
    if (days.length === 0) continue
    const bound = boundOf(f.trip_id, resolved.routeId)
    if (!bound) continue
    const start = toMinutes(f.start_time)
    const end = toMinutes(f.end_time)
    const headway = Math.round(Number(f.headway_secs) / 60)
    if (Number.isNaN(start) || Number.isNaN(end) || !(headway > 0) || end <= start) {
      freqBadTime += 1
      continue
    }
    for (const co of info.coList) {
      const mergedKey = `${co}|${info.short}|${bound}|1`
      const extraKey = tripAssign.get(`${f.trip_id}|${co}`)
      const targetKeys = extraKey && extraKey !== mergedKey ? [extraKey] : [mergedKey]
      for (const key of targetKeys) {
        const variant = getVariant(key)
        variant.src.add(resolved.routeId)
        if (!variant.freqRids) variant.freqRids = new Set()
        variant.freqRids.add(resolved.routeId)
        for (const day of days) {
          if (!variant.windows[day]) variant.windows[day] = []
          variant.windows[day].push([start, end, headway])
          // Frequency window ends extend past the last trip's first departure,
          // so fold them into the span: first bus ~= first window start,
          // last bus ~= last window end.
          const first = variant.spanFirst[day]
          if (first === undefined || start < first) variant.spanFirst[day] = start
          const last = variant.spanLast[day]
          if (last === undefined || end > last) variant.spanLast[day] = end
        }
      }
    }
  }

  const outVariants = {}
  let spanOnly = 0
  let totalWindows = 0
  let stopCovVariants = 0
  let stopCovEntries = 0
  const appStopGrid =
    appStopMap && appStopMap.size > 0 ? buildStopGrid(appStopMap) : null
  if (!appStopGrid) log('no app stop grid, skipping per-stop coverage tables')
  const sortedKeys = [...variants.keys()].sort()
  for (const key of sortedKeys) {
    const v = variants.get(key)
    const span = {}
    for (const day of DAY_TYPES) {
      const first = v.spanFirst[day]
      const last = v.spanLast[day]
      if (first !== undefined && last !== undefined) span[day] = [toHHMM(first), toHHMM(last)]
    }
    // Holiday service runs to Sunday timings: copy sunday when holiday is empty.
    if (!span.holiday && span.sunday) span.holiday = [...span.sunday]
    const headway = {}
    for (const day of DAY_TYPES) {
      const list = v.windows[day]
      if (list && list.length > 0) headway[day] = mergeWindows(list)
    }
    if (headway.sunday && !headway.holiday) headway.holiday = headway.sunday.map((w) => [...w])
    for (const list of Object.values(headway)) totalWindows += list.length
    if (Object.keys(span).length === 0 && Object.keys(headway).length === 0) continue
    const entry = { src: [...v.src].sort(), span }
    if (Object.keys(headway).length > 0) {
      entry.headway = headway
    } else {
      spanOnly += 1
    }
    // Fixed departures for days with trips but no frequency windows. Sorted
    // minutes since midnight (may exceed 1440 for after-midnight trips).
    const departures = {}
    for (const day of DAY_TYPES) {
      if (headway[day]) continue
      const set = v.fixed[day]
      if (set && set.size > 0) departures[day] = [...set].sort((a, b) => a - b)
    }
    if (!departures.holiday && departures.sunday) departures.holiday = [...departures.sunday]
    if (Object.keys(departures).length > 0) entry.departures = departures
    // Special departures: fixed trips (never in frequencies.txt) from a TD
    // route, for days that DO have frequency windows. These are extras the
    // frequency table does not describe, e.g. peak short workings from a
    // different terminus. Trips from a route that also has frequency trips
    // only count when they fall outside every window that day or run a
    // stop pattern no frequency trip runs (inside-window trips on an
    // identical pattern are presumably the frequency buses themselves).
    const special = []
    if (v.fixedBySrc) {
      const rids = [...v.fixedBySrc.keys()].sort()
      for (const rid of rids) {
        const perSrc = v.fixedBySrc.get(rid)
        const shared = Boolean(v.freqRids && v.freqRids.has(rid))
        const hasDistinctPattern =
          !perSrc.patterns ||
          perSrc.patterns.size === 0 ||
          [...perSrc.patterns].some((p) => !v.freqPatterns || !v.freqPatterns.has(p))
        const origin = originByStopId.get(perSrc.firstStop) || ''
        const depDays = {}
        for (const day of DAY_TYPES) {
          if (!headway[day]) continue
          const set = perSrc.days[day]
          if (!set || set.size === 0) continue
          let list = [...set]
          if (shared && !hasDistinctPattern) {
            list = list.filter((dep) => !windowCovers(headway[day], dep))
          }
          if (list.length === 0) continue
          depDays[day] = list.sort((a, b) => a - b)
        }
        if (!depDays.holiday && depDays.sunday) depDays.holiday = [...depDays.sunday]
        if (Object.keys(depDays).length > 0) {
          special.push({ src: rid, origin, departures: depDays })
        }
      }
    }
    if (special.length > 0) entry.special = special
    // Per-stop coverage: app stops with partial TD-route coverage where the
    // display changes. Serving sets use indexes into the sorted src array.
    // A: windowed variants, stops no frequency route serves (hide the
    // frequency table there). S: variants with windowless-day departures,
    // stops served by a strict subset of routes (filter departures there).
    if (appStopGrid && v.srcStops && v.src.size > 1) {
      const sortedSrc = entry.src
      const srcIndex = new Map(sortedSrc.map((rid, i) => [rid, i]))
      const freqIdx = new Set(
        [...(v.freqRids ?? [])].map((rid) => srcIndex.get(rid)).filter((i) => i !== undefined)
      )
      const hasWindows = Object.keys(headway).length > 0
      const hasWindowlessDepartures = Object.keys(departures).length > 0
      if ((hasWindows && freqIdx.size > 0) || hasWindowlessDepartures) {
        const tdServing = new Map()
        for (const [rid, stopUnion] of v.srcStops) {
          for (const s of stopUnion) {
            let set = tdServing.get(s)
            if (!set) {
              set = new Set()
              tdServing.set(s, set)
            }
            set.add(rid)
          }
        }
        const appServing = new Map()
        for (const [tdStop, ridSet] of tdServing) {
          if (ridSet.size === sortedSrc.length) continue
          const coords = stopCoords.get(tdStop)
          if (!coords) continue
          for (const appId of appStopsNear(appStopGrid, coords[0], coords[1])) {
            let set = appServing.get(appId)
            if (!set) {
              set = new Set()
              appServing.set(appId, set)
            }
            for (const rid of ridSet) set.add(rid)
          }
        }
        const stopCov = {}
        for (const [appId, ridSet] of appServing) {
          if (ridSet.size === sortedSrc.length) continue
          const isSpecialOnly =
            hasWindows &&
            freqIdx.size > 0 &&
            [...ridSet].every((rid) => !freqIdx.has(srcIndex.get(rid)))
          if (!isSpecialOnly && !hasWindowlessDepartures) continue
          stopCov[appId] = [...ridSet]
            .map((rid) => srcIndex.get(rid))
            .filter((i) => i !== undefined)
            .sort((a, b) => a - b)
        }
        if (Object.keys(stopCov).length > 0) {
          entry.stopCov = stopCov
          stopCovVariants += 1
          stopCovEntries += Object.keys(stopCov).length
          if (freqIdx.size > 0) entry.freqSrc = [...freqIdx].sort((a, b) => a - b)
          // Per-src fixed departures for windowless days, so stops can
          // filter the merged departures table to their serving routes.
          // Origins ride along so split timetables can label each group.
          const depBySrc = {}
          for (const [rid, perSrc] of v.fixedBySrc ?? []) {
            const idx = srcIndex.get(rid)
            if (idx === undefined) continue
            const table = {}
            for (const day of DAY_TYPES) {
              if (headway[day]) continue
              const set = perSrc.days[day]
              if (set && set.size > 0) table[day] = [...set].sort((a, b) => a - b)
            }
            if (!table.holiday && table.sunday) table.holiday = [...table.sunday]
            if (Object.keys(table).length > 0) {
              depBySrc[String(idx)] = {
                origin: originByStopId.get(perSrc.firstStop) || '',
                departures: table,
              }
            }
          }
          if (Object.keys(depBySrc).length > 0) entry.depBySrc = depBySrc
        }
      }
    }
    outVariants[key] = entry
  }

  // Fallback safety: groups left without a serviceType "1" entry (every
  // trip confidently assigned elsewhere) get a |1 union, so unknown
  // service types resolve something instead of nothing, as before.
  let fallbackSynth = 0
  const groupKeys = new Map()
  for (const key of Object.keys(outVariants)) {
    const sep = key.lastIndexOf('|')
    const group = key.slice(0, sep)
    let list = groupKeys.get(group)
    if (!list) {
      list = []
      groupKeys.set(group, list)
    }
    list.push(key)
  }
  for (const [group, keys] of groupKeys) {
    if (keys.some((key) => key.endsWith('|1'))) continue
    const sortedSrc = [...new Set(keys.flatMap((key) => outVariants[key].src))].sort()
    const srcIndex = new Map(sortedSrc.map((rid, i) => [rid, i]))
    const union = { src: sortedSrc, span: {} }
    const spanFirst = {}
    const spanLast = {}
    const windowLists = {}
    const depSets = {}
    const specialBySrc = new Map()
    const freqIdx = new Set()
    const covSets = new Map()
    const covDepBySrc = {}
    for (const key of keys) {
      const sib = outVariants[key]
      const sibIdx = new Map(sib.src.map((rid, i) => [rid, i]))
      for (const [day, range] of Object.entries(sib.span ?? {})) {
        if (
          spanFirst[day] === undefined ||
          range[0] < spanFirst[day]
        ) {
          spanFirst[day] = range[0]
        }
        if (spanLast[day] === undefined || range[1] > spanLast[day]) {
          spanLast[day] = range[1]
        }
      }
      for (const [day, list] of Object.entries(sib.headway ?? {})) {
        if (!windowLists[day]) windowLists[day] = []
        windowLists[day].push(...list.map((w) => [...w]))
      }
      for (const [day, list] of Object.entries(sib.departures ?? {})) {
        if (!depSets[day]) depSets[day] = new Set()
        for (const dep of list) depSets[day].add(dep)
      }
      for (const entry of sib.special ?? []) {
        let agg = specialBySrc.get(entry.src)
        if (!agg) {
          agg = { src: entry.src, origin: entry.origin, departures: {} }
          specialBySrc.set(entry.src, agg)
        }
        for (const [day, list] of Object.entries(entry.departures ?? {})) {
          const set = new Set(agg.departures[day] ?? [])
          for (const dep of list) set.add(dep)
          agg.departures[day] = [...set].sort((a, b) => a - b)
        }
      }
      for (const i of sib.freqSrc ?? []) {
        const rid = sib.src[i]
        const mapped = rid !== undefined ? srcIndex.get(rid) : undefined
        if (mapped !== undefined) freqIdx.add(mapped)
      }
      for (const [appId, idxList] of Object.entries(sib.stopCov ?? {})) {
        let set = covSets.get(appId)
        if (!set) {
          set = new Set()
          covSets.set(appId, set)
        }
        for (const i of idxList) {
          const rid = sib.src[i]
          const mapped = rid !== undefined ? srcIndex.get(rid) : undefined
          if (mapped !== undefined) set.add(mapped)
        }
      }
      for (const [idxStr, table] of Object.entries(sib.depBySrc ?? {})) {
        const rid = sib.src[Number(idxStr)]
        const mapped = rid !== undefined ? srcIndex.get(rid) : undefined
        if (mapped === undefined || !table || typeof table !== 'object') continue
        covDepBySrc[String(mapped)] = {
          origin: table.origin ?? '',
          departures: { ...(table.departures ?? {}) },
        }
      }
    }
    for (const day of DAY_TYPES) {
      if (spanFirst[day] !== undefined && spanLast[day] !== undefined) {
        union.span[day] = [spanFirst[day], spanLast[day]]
      }
    }
    if (Object.keys(union.span).length === 0) continue
    const unionHeadway = {}
    for (const [day, list] of Object.entries(windowLists)) {
      if (list.length > 0) unionHeadway[day] = mergeWindows(list)
    }
    if (Object.keys(unionHeadway).length > 0) {
      union.headway = unionHeadway
    } else {
      spanOnly += 1
    }
    for (const list of Object.values(unionHeadway)) totalWindows += list.length
    const unionDepartures = {}
    for (const [day, set] of Object.entries(depSets)) {
      if (set.size > 0) unionDepartures[day] = [...set].sort((a, b) => a - b)
    }
    if (Object.keys(unionDepartures).length > 0) union.departures = unionDepartures
    if (specialBySrc.size > 0) union.special = [...specialBySrc.values()]
    if (freqIdx.size > 0) union.freqSrc = [...freqIdx].sort((a, b) => a - b)
    if (covSets.size > 0) {
      const stopCov = {}
      for (const [appId, set] of covSets) {
        if (set.size === 0 || set.size === sortedSrc.length) continue
        stopCov[appId] = [...set].sort((a, b) => a - b)
      }
      if (Object.keys(stopCov).length > 0) {
        union.stopCov = stopCov
        stopCovVariants += 1
        stopCovEntries += Object.keys(stopCov).length
      }
    }
    if (Object.keys(covDepBySrc).length > 0) union.depBySrc = covDepBySrc
    outVariants[`${group}|1`] = union
    fallbackSynth += 1
  }

  log(
    `variants=${Object.keys(outVariants).length} span-only=${spanOnly} windows=${totalWindows} ` +
      `stopCovVariants=${stopCovVariants} stopCovEntries=${stopCovEntries} ` +
      `assignedTrips=${assignedTrips} ambiguousTrips=${ambiguousTrips} fallbackSynth=${fallbackSynth} ` +
      `holidays=${holidays.length} skippedAgency=${skippedAgency} skippedShort=${skippedShort} ` +
      `tripsUnknownRoute=${tripsUnknownRoute} tripsUnknownService=${tripsUnknownService} ` +
      `tripsUnknownBound=${tripsUnknownBound} freqOrphans=${freqOrphans} freqBadTime=${freqBadTime}`
  )
  return { variants: outVariants, holidays, totalWindows }
}

/** Offline fallback: hand-written sample covering KMB route 1, both bounds. */
function buildSample() {
  const variants = {
    'kmb|1|O|1': {
      src: ['1001'],
      span: {
        weekday: ['0535', '2340'],
        saturday: ['0535', '2340'],
        sunday: ['0535', '2340'],
        holiday: ['0535', '2340'],
      },
      headway: {
        weekday: [
          [335, 425, 15],
          [425, 485, 10],
          [485, 545, 12],
          [545, 665, 15],
          [665, 1025, 12],
          [1025, 1055, 15],
          [1055, 1295, 20],
          [1295, 1420, 25],
        ],
        saturday: [
          [335, 395, 20],
          [395, 485, 15],
          [485, 545, 12],
          [545, 605, 10],
          [605, 1145, 12],
          [1145, 1265, 20],
          [1265, 1420, 25],
        ],
        sunday: [
          [335, 455, 20],
          [455, 485, 15],
          [485, 545, 12],
          [545, 845, 10],
          [845, 965, 12],
          [965, 1130, 15],
          [1130, 1270, 20],
          [1270, 1420, 25],
        ],
        holiday: [
          [335, 455, 20],
          [455, 485, 15],
          [485, 545, 12],
          [545, 845, 10],
          [845, 965, 12],
          [965, 1130, 15],
          [1130, 1270, 20],
          [1270, 1420, 25],
        ],
      },
    },
    'kmb|1|I|1': {
      src: ['1001'],
      span: {
        weekday: ['0630', '2445'],
        saturday: ['0630', '2340'],
        sunday: ['0630', '2340'],
        holiday: ['0630', '2340'],
      },
      headway: {
        weekday: [
          [390, 640, 25],
          [640, 700, 20],
          [700, 790, 15],
          [790, 848, 10],
          [848, 1109, 9],
          [1109, 1175, 12],
          [1175, 1345, 17],
          [1345, 1485, 25],
        ],
        saturday: [
          [390, 465, 25],
          [465, 765, 20],
          [765, 795, 15],
          [795, 1155, 12],
          [1155, 1420, 20],
        ],
        sunday: [
          [390, 480, 20],
          [480, 720, 15],
          [720, 1200, 12],
          [1200, 1420, 20],
        ],
        holiday: [
          [390, 480, 20],
          [480, 720, 15],
          [720, 1200, 12],
          [1200, 1420, 20],
        ],
      },
    },
  }
  const holidays = ['2026-02-17', '2026-02-18', '2026-02-19']
  const totalWindows = Object.values(variants).reduce(
    (sum, v) => sum + Object.values(v.headway).reduce((n, list) => n + list.length, 0),
    0
  )
  return { variants, holidays, totalWindows, sample: true }
}

async function main() {
  let datasetDate = null
  try {
    datasetDate = parseDatasetDate(await fetchTextWithRetry(DATE_URL))
    log(`dataset revision date: ${datasetDate ?? '(unparseable)'}`)
  } catch (err) {
    log(`revision-date fetch failed: ${err}`)
  }

  const manifest = await readManifest()
  if (
    !isForce() &&
    datasetDate &&
    manifest?.datasetDate === datasetDate &&
    existsSync(HEADWAY_PATH)
  ) {
    log(`snapshot already at revision ${datasetDate}, skipping`)
    return
  }

  let snapshot = null
  let source = 'live'
  let effectiveDate = datasetDate
  try {
    const [files, appStops] = await Promise.all([loadGtfs(), fetchAppStops()])
    snapshot = buildSnapshot(files, appStops)
  } catch (err) {
    log(`GTFS load failed: ${err}`)
    snapshot = null
  }

  if (!snapshot) {
    if (existsSync(HEADWAY_PATH) && existsSync(MANIFEST_PATH)) {
      log('keeping existing snapshot after failed refresh')
      return
    }
    if (isCi()) {
      console.error('[fetch-headway] giving up: no snapshot exists and the feed is unreachable.')
      process.exitCode = 1
      return
    }
    log('no snapshot exists and the feed is unreachable, writing offline sample fallback')
    source = 'sample'
    effectiveDate = datasetDate ?? '1970-01-01'
    snapshot = buildSample()
  }

  const updated = effectiveDate ?? new Date().toISOString().slice(0, 10)
  const headwayJson = JSON.stringify({
    updated,
    variants: snapshot.variants,
    holidays: snapshot.holidays,
  })
  const manifestJson =
    JSON.stringify({
      datasetDate: updated,
      fetchedAt: new Date().toISOString(),
      routes: Object.keys(snapshot.variants).length,
      windows: snapshot.totalWindows,
      source,
    }) + '\n'
  await writeAtomic(HEADWAY_PATH, headwayJson)
  await writeAtomic(MANIFEST_PATH, manifestJson)
  log(
    `wrote ${HEADWAY_PATH} (${headwayJson.length} bytes) and ${MANIFEST_PATH} ` +
      `(${manifestJson.length} bytes) source=${source} updated=${updated}`
  )
}

main().catch((err) => {
  console.error('[fetch-headway] failed:', err)
  process.exitCode = 1
})
