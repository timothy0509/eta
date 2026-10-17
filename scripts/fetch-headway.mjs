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
 *                        "departures": { "weekday": [depMin,...], ... } }, ...]
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
 * table only count when they fall outside every window that day.
 *
 * Key rules:
 * - co is the lowercased app company (kmb/ctb/gmb/nlb/lrtfeeder). TD agency
 *   LWB rows map onto co "kmb" (the app has no lwb company); joint agencies
 *   (KMB+CTB, LWB+CTB) emit one variant per company. Agencies FERRY, XB, DB,
 *   PI, TRAM and PTRAM, and rows with empty route_short_name, are skipped.
 * - ROUTE is the uppercased route_short_name. bound comes from the TD trip_id
 *   second segment (1 -> O, 2 -> I). serviceType is always "1": TD carries no
 *   serviceType concept, so every key is emitted with serviceType "1" only,
 *   and the lookup MUST fall back to serviceType "1" when an exact key misses.
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

function buildSnapshot(files) {
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
  for (const st of stopTimes) {
    if (st.stop_sequence !== '1') continue
    const dep = toMinutes(st.departure_time)
    if (Number.isNaN(dep)) continue
    const prev = firstDeparture.get(st.trip_id)
    if (prev === undefined || dep < prev) {
      firstDeparture.set(st.trip_id, dep)
      firstStopId.set(st.trip_id, st.stop_id)
    }
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

  let tripsUnknownService = 0
  let tripsUnknownRoute = 0
  let tripsUnknownBound = 0
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
    for (const co of info.coList) {
      const variant = getVariant(`${co}|${info.short}|${bound}|1`)
      variant.src.add(t.route_id)
      addTripSpan(variant, days, dep)
      // Per-route fixed trips for the special-departures section: trips that
      // never appear in frequencies.txt (checked later against freqRids).
      if (!variant.fixedBySrc) variant.fixedBySrc = new Map()
      let perSrc = variant.fixedBySrc.get(t.route_id)
      if (!perSrc) {
        perSrc = { firstStop: originStop, days: {} }
        variant.fixedBySrc.set(t.route_id, perSrc)
      }
      if (perSrc.firstStop === undefined) perSrc.firstStop = originStop
      for (const day of days) {
        if (!perSrc.days[day]) perSrc.days[day] = new Set()
        perSrc.days[day].add(dep)
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
      const variant = getVariant(`${co}|${info.short}|${bound}|1`)
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

  const outVariants = {}
  let spanOnly = 0
  let totalWindows = 0
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
    // only count when they fall outside every window that day (inside ones
    // are presumably the frequency buses themselves).
    const special = []
    if (v.fixedBySrc) {
      const rids = [...v.fixedBySrc.keys()].sort()
      for (const rid of rids) {
        const perSrc = v.fixedBySrc.get(rid)
        const shared = Boolean(v.freqRids && v.freqRids.has(rid))
        const origin = originByStopId.get(perSrc.firstStop) || ''
        const depDays = {}
        for (const day of DAY_TYPES) {
          if (!headway[day]) continue
          const set = perSrc.days[day]
          if (!set || set.size === 0) continue
          let list = [...set]
          if (shared) list = list.filter((dep) => !windowCovers(headway[day], dep))
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
    outVariants[key] = entry
  }

  log(
    `variants=${sortedKeys.length} span-only=${spanOnly} windows=${totalWindows} ` +
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
    const files = await loadGtfs()
    snapshot = buildSnapshot(files)
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
