import type { Company, RouteListEntry, StopList } from 'hk-bus-eta'

import { normalizeBound, normalizeStopId } from '@/lib/eta/eta-db-index'
import { haversineDistanceKm } from '@/lib/eta/geo'

/**
 * Static-data matching layer between Transport Department (TD) GeoJSON stop
 * points and the hk-bus-eta ETA database.
 *
 * Problem: TD files (`JSON_BUS.json`, `JSON_GMB.json`, updated biweekly) key
 * every stop point by TD's own `stopId` namespace, while realtime ETA queries
 * (`fetchEtas` via `lib/eta/direct/eta-db.ts`) key stops by hk-bus-eta stop ID
 * plus route variant (`co`, `route`, `bound`, `serviceType`, `seq`). This
 * module links a TD stop point (coordinates plus trilingual `stopNameC/S/E`,
 * sitting at `stopSeq` inside a route variant identified by route name and
 * `routeSeq`) to one hk-bus-eta route variant and 0-indexed stop sequence.
 *
 * Matching is coordinate-first with trilingual names as a supporting signal,
 * because the two datasets name the same physical stops differently. Anything
 * that cannot be resolved confidently comes back as `unresolved`, never as a
 * guess. A persistent override table (keyed for JSON storage) takes precedence
 * over the automatic match for cases a human has reviewed.
 *
 * A matched result plugs into realtime queries directly:
 * `fetchEtas({ ...match.entry, co: [match.eta.co], seq: match.eta.seq, language })`
 */

export type TdStopPoint = {
  companyCode: string
  routeName: string
  routeId: number | null
  routeSeq: number
  stopSeq: number
  tdStopId: number | string
  lat: number
  lng: number
  stopNameC: string
  stopNameS: string
  stopNameE: string
}

export type TdStopRef = {
  companyCode: string
  routeName: string
  routeId: number | null
  routeSeq: number
  stopSeq: number
  tdStopId: number | string
}

/** One hk-bus-eta route variant expanded per company, with ordered stops. */
export type EtaVariantCandidate = {
  entry: RouteListEntry
  co: Company
  bound: string
  serviceType: string
  stopIds: string[]
}

/**
 * Resolved ETA target. `seq` is 0-indexed so it plugs straight into
 * `fetchEtas`, matching the convention in `fetchKmbEtasForStop`.
 */
export type EtaStopRef = {
  co: Company
  route: string
  bound: string
  serviceType: string
  stopId: string
  seq: number
}

export type TdStopOverride =
  { type: 'match'; ref: EtaStopRef } | { type: 'unresolved'; reason?: string }

/** Persistent override table: override key -> reviewed outcome. */
export type TdOverrideTable = Record<string, TdStopOverride>

export type TdMatcherOptions = {
  /** Distance at or under which a coordinate hit counts as exact. Default 0.03 km. */
  exactDistanceKm?: number
  /** Hard ceiling for automatic matches. Default 0.15 km. */
  maxDistanceKm?: number
  /** Runner-up within this margin of the best hit means ambiguous. Default 0.03 km. */
  ambiguityMarginKm?: number
}

export type TdMatcherContext = {
  stopList: StopList
  variants: EtaVariantCandidate[]
  overrides?: TdOverrideTable
  options?: TdMatcherOptions
}

export type TdMatchConfidence = 'override' | 'exact' | 'high' | 'medium'

export type TdUnresolvedReason =
  | 'invalid-coordinates'
  | 'unsupported-company'
  | 'no-variant'
  | 'no-candidate-in-range'
  | 'ambiguous'
  | 'name-mismatch'
  | 'override-forced'
  | 'stale-override'

export type TdMatchedStop = {
  status: 'matched'
  td: TdStopRef
  eta: EtaStopRef
  /** The hk-bus-eta route entry to spread into `fetchEtas`. */
  entry: RouteListEntry
  confidence: TdMatchConfidence
  distanceKm: number
  nameMatched: boolean
}

export type TdUnresolvedStop = {
  status: 'unresolved'
  td: TdStopRef
  reason: TdUnresolvedReason
  detail: string
  distanceKm: number | null
  nameMatched: boolean
}

export type TdStopMatch = TdMatchedStop | TdUnresolvedStop

export type TdMatchSummary = {
  total: number
  matched: number
  unresolved: number
  byConfidence: Record<TdMatchConfidence, number>
  byReason: Partial<Record<TdUnresolvedReason, number>>
}

const DEFAULT_EXACT_DISTANCE_KM = 0.03
const DEFAULT_MAX_DISTANCE_KM = 0.15
const DEFAULT_AMBIGUITY_MARGIN_KM = 0.03

const ETA_COMPANY_BY_LOWERCASE: Readonly<Record<string, Company>> = {
  kmb: 'kmb',
  ctb: 'ctb',
  nlb: 'nlb',
  gmb: 'gmb',
  lrtfeeder: 'lrtfeeder',
  lightrail: 'lightRail',
  mtr: 'mtr',
  sunferry: 'sunferry',
  hkkf: 'hkkf',
  fortuneferry: 'fortuneferry',
}

/**
 * Maps one TD company token to hk-bus-eta companies. Long Win Bus has no
 * hk-bus-eta namespace of its own. Its routes are served under `kmb`.
 * DB, PI and XB have no hk-bus-eta coverage and map to nothing, so their
 * stops resolve as `unresolved` instead of being mislinked.
 */
function mapSingleTdCompany(token: string): Company[] {
  switch (token) {
    case 'KMB':
    case 'LWB':
      return ['kmb']
    case 'CTB':
      return ['ctb']
    case 'NLB':
      return ['nlb']
    case 'GMB':
      return ['gmb']
    case 'LRTFEEDER':
      return ['lrtfeeder']
    default:
      return []
  }
}

/** Maps a TD `companyCode` (`KMB`, `KMB+CTB`, ...) to hk-bus-eta companies. */
export function mapTdCompanyToEtaCos(companyCode: string): Company[] {
  const seen = new Set<Company>()
  for (const token of String(companyCode ?? '')
    .toUpperCase()
    .split('+')) {
    for (const co of mapSingleTdCompany(token.trim())) seen.add(co)
  }
  return Array.from(seen)
}

/** Generic override key: `COMPANY|ROUTE|ROUTESEQ|STOPSEQ`. Survives TD `routeId` churn. */
export function tdOverrideKey(point: {
  companyCode: string
  routeName: string
  routeSeq: number
  stopSeq: number
}): string {
  return `${String(point.companyCode ?? '')
    .trim()
    .toUpperCase()}|${String(point.routeName ?? '')
    .trim()
    .toUpperCase()}|${point.routeSeq}|${point.stopSeq}`
}

/**
 * Specific override key with TD `routeId`: `COMPANY|ROUTE|ROUTEID|ROUTESEQ|STOPSEQ`.
 * Null when the point carries no route ID.
 */
export function tdSpecificOverrideKey(point: {
  companyCode: string
  routeName: string
  routeId: number | null
  routeSeq: number
  stopSeq: number
}): string | null {
  if (point.routeId === null || point.routeId === undefined) return null
  return `${String(point.companyCode ?? '')
    .trim()
    .toUpperCase()}|${String(point.routeName ?? '')
    .trim()
    .toUpperCase()}|${point.routeId}|${point.routeSeq}|${point.stopSeq}`
}

/** Override keys in lookup order: specific first, then the generic fallback. */
export function tdOverrideKeysForPoint(point: TdStopRef): string[] {
  const keys: string[] = []
  const specific = tdSpecificOverrideKey(point)
  if (specific) keys.push(specific)
  keys.push(tdOverrideKey(point))
  return keys
}

function lookupOverride(
  point: TdStopRef,
  table: TdOverrideTable | undefined
): TdStopOverride | null {
  if (!table) return null
  for (const key of tdOverrideKeysForPoint(point)) {
    const found = table[key]
    if (found) return found
  }
  return null
}

/** Groups TD points by route variant for batch workflows. */
export function groupTdPointsByVariant(points: TdStopPoint[]): Map<string, TdStopPoint[]> {
  const groups = new Map<string, TdStopPoint[]>()
  for (const point of points) {
    const specific = tdSpecificOverrideKey(point)
    const key = specific
      ? `${point.companyCode.trim().toUpperCase()}|${point.routeName.trim().toUpperCase()}|${point.routeId}|${point.routeSeq}`
      : `${point.companyCode.trim().toUpperCase()}|${point.routeName.trim().toUpperCase()}||${point.routeSeq}`
    const list = groups.get(key) ?? []
    list.push(point)
    groups.set(key, list)
  }
  return groups
}

/** Expands route entries into per-company candidates with ordered stop IDs. */
export function buildEtaVariantCandidates(
  routeList: Record<string, RouteListEntry>
): EtaVariantCandidate[] {
  const candidates: EtaVariantCandidate[] = []
  for (const entry of Object.values(routeList)) {
    if (!entry || !Array.isArray(entry.co)) continue
    for (const co of entry.co) {
      const stops = entry.stops?.[co] ?? []
      if (!Array.isArray(stops) || stops.length === 0) continue
      candidates.push({
        entry,
        co,
        bound: normalizeBound(entry.bound?.[co]),
        serviceType: String(entry.serviceType ?? ''),
        stopIds: stops.map((stopId) => normalizeStopId(stopId)).filter(Boolean),
      })
    }
  }
  return candidates
}

/**
 * Normalizes a stop name for cross-dataset comparison: uppercases, drops HTML
 * line breaks and parenthetical bay suffixes such as `(WT916)`, strips
 * punctuation, and collapses whitespace.
 */
export function normalizeStopNameForMatch(name: string): string {
  return String(name ?? '')
    .toUpperCase()
    .replace(/<\s*BR\s*\/?>/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitTdNameVariants(name: string): string[] {
  return String(name ?? '')
    .replace(/<\s*BR\s*\/?>/gi, '\n')
    .split(/[\n/]/)
    .map((part) => normalizeStopNameForMatch(part))
    .filter(Boolean)
}

/**
 * True when any TD name variant exactly equals or substantially contains an
 * hk-bus-eta stop name (`en`/`zh`). Substring hits need at least 3 compacted
 * characters so short tokens cannot force a false positive.
 */
export function tdEtaStopNamesMatch(
  td: { stopNameC: string; stopNameS: string; stopNameE: string },
  eta: { en: string; zh: string }
): boolean {
  const tdVariants = [
    ...splitTdNameVariants(td.stopNameC),
    ...splitTdNameVariants(td.stopNameS),
    ...splitTdNameVariants(td.stopNameE),
  ]
  const etaNames = [normalizeStopNameForMatch(eta.en), normalizeStopNameForMatch(eta.zh)].filter(
    Boolean
  )
  for (const tdName of tdVariants) {
    const tdCompact = tdName.replace(/ /g, '')
    for (const etaName of etaNames) {
      if (tdName === etaName) return true
      const etaCompact = etaName.replace(/ /g, '')
      const shorter = Math.min(tdCompact.length, etaCompact.length)
      if (shorter >= 3 && (tdCompact.includes(etaCompact) || etaCompact.includes(tdCompact))) {
        return true
      }
    }
  }
  return false
}

function tdRefOf(point: TdStopPoint): TdStopRef {
  return {
    companyCode: point.companyCode,
    routeName: point.routeName,
    routeId: point.routeId,
    routeSeq: point.routeSeq,
    stopSeq: point.stopSeq,
    tdStopId: point.tdStopId,
  }
}

type ScoredCandidate = {
  variant: EtaVariantCandidate
  stopId: string
  seq: number
  distanceKm: number
}

function isFiniteCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * TD routeSeq 1 covers outbound and circular legs, routeSeq 2 is inbound,
 * matching the hk-bus-eta O/I bound convention.
 */
export function tdRouteSeqMatchesBound(routeSeq: number, bound: string): boolean {
  const b = String(bound ?? '').toUpperCase()
  if (!b) return true
  if (routeSeq === 2) return b === 'I'
  if (routeSeq === 1) return b !== 'I'
  return true
}

/** Links one TD stop point to its hk-bus-eta route variant and stop sequence. */
export function matchTdStopPoint(point: TdStopPoint, ctx: TdMatcherContext): TdStopMatch {
  const td = tdRefOf(point)
  const options = ctx.options ?? {}
  const exactKm = options.exactDistanceKm ?? DEFAULT_EXACT_DISTANCE_KM
  const maxKm = options.maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM
  const marginKm = options.ambiguityMarginKm ?? DEFAULT_AMBIGUITY_MARGIN_KM

  const override = lookupOverride(td, ctx.overrides)
  if (override?.type === 'match') {
    const entry = findOverrideEntry(ctx.variants, override.ref)
    if (!entry) {
      return {
        status: 'unresolved',
        td,
        reason: 'stale-override',
        detail:
          `Override target ${override.ref.co} ${override.ref.route} ` +
          'is no longer in the ETA index. Re-review the override.',
        distanceKm: null,
        nameMatched: false,
      }
    }
    return {
      status: 'matched',
      td,
      eta: override.ref,
      entry,
      confidence: 'override',
      distanceKm: 0,
      nameMatched: false,
    }
  }
  if (override?.type === 'unresolved') {
    return {
      status: 'unresolved',
      td,
      reason: 'override-forced',
      detail: override.reason ?? 'A reviewed override marks this stop as unresolvable.',
      distanceKm: null,
      nameMatched: false,
    }
  }

  if (!isFiniteCoord(point.lat) || !isFiniteCoord(point.lng)) {
    return {
      status: 'unresolved',
      td,
      reason: 'invalid-coordinates',
      detail: 'TD point has no usable coordinates.',
      distanceKm: null,
      nameMatched: false,
    }
  }

  const cos = mapTdCompanyToEtaCos(point.companyCode)
  if (cos.length === 0) {
    return {
      status: 'unresolved',
      td,
      reason: 'unsupported-company',
      detail: `TD company "${point.companyCode}" has no hk-bus-eta coverage.`,
      distanceKm: null,
      nameMatched: false,
    }
  }

  const routeName = point.routeName.trim().toUpperCase()
  const routeVariants = ctx.variants.filter(
    (variant) => variant.entry.route.trim().toUpperCase() === routeName && cos.includes(variant.co)
  )
  if (routeVariants.length === 0) {
    return {
      status: 'unresolved',
      td,
      reason: 'no-variant',
      detail: `No hk-bus-eta variant for route "${point.routeName}" under ${cos.join('/')}.`,
      distanceKm: null,
      nameMatched: false,
    }
  }

  // TD routeSeq 1 covers outbound and circular legs, routeSeq 2 is inbound.
  // Filter candidates by direction so opposite-carriageway stops sharing a
  // corridor cannot cross-link when they fall outside the ambiguity margin.
  const variants = routeVariants.filter((variant) =>
    tdRouteSeqMatchesBound(point.routeSeq, variant.bound)
  )
  if (variants.length === 0) {
    return {
      status: 'unresolved',
      td,
      reason: 'no-variant',
      detail:
        `Route "${point.routeName}" exists under ${cos.join('/')} but no variant ` +
        `runs the TD leg direction (routeSeq ${point.routeSeq}).`,
      distanceKm: null,
      nameMatched: false,
    }
  }

  const origin = { lat: point.lat, lng: point.lng }
  const scored: ScoredCandidate[] = []
  let nearestKm: number | null = null
  for (const variant of variants) {
    for (let seq = 0; seq < variant.stopIds.length; seq++) {
      const stopId = variant.stopIds[seq]
      const location = ctx.stopList[stopId]?.location
      if (!location || !isFiniteCoord(location.lat) || !isFiniteCoord(location.lng)) continue
      const distanceKm = haversineDistanceKm(origin, { lat: location.lat, lng: location.lng })
      if (nearestKm === null || distanceKm < nearestKm) nearestKm = distanceKm
      if (distanceKm <= maxKm) scored.push({ variant, stopId, seq, distanceKm })
    }
  }

  if (scored.length === 0) {
    return {
      status: 'unresolved',
      td,
      reason: 'no-candidate-in-range',
      detail:
        nearestKm === null
          ? 'No candidate stop has coordinates to compare.'
          : `Nearest candidate is ${nearestKm.toFixed(3)} km away, past the ${maxKm} km ceiling.`,
      distanceKm: nearestKm,
      nameMatched: false,
    }
  }

  scored.sort(
    (a, b) =>
      a.distanceKm - b.distanceKm ||
      (a.variant.co < b.variant.co ? -1 : a.variant.co > b.variant.co ? 1 : 0) ||
      a.seq - b.seq
  )

  // Collapse duplicate entries that serve the same physical stop: the stop is
  // unambiguous, only the entry choice needs a deterministic rule.
  const bestPerStop = new Map<string, ScoredCandidate>()
  for (const candidate of scored) {
    if (!bestPerStop.has(candidate.stopId)) bestPerStop.set(candidate.stopId, candidate)
  }
  const distinct = Array.from(bestPerStop.values())
  const best = distinct[0]
  const runnerUp = distinct[1]
  if (runnerUp && runnerUp.distanceKm - best.distanceKm <= marginKm) {
    return {
      status: 'unresolved',
      td,
      reason: 'ambiguous',
      detail:
        `Stops ${best.stopId} and ${runnerUp.stopId} are both ` +
        `within ${marginKm} km of each other (${best.distanceKm.toFixed(3)} km vs ` +
        `${runnerUp.distanceKm.toFixed(3)} km). Needs a reviewed override.`,
      distanceKm: best.distanceKm,
      nameMatched: false,
    }
  }

  const stopEntry = ctx.stopList[best.stopId]
  const nameMatched = stopEntry
    ? tdEtaStopNamesMatch(point, {
        en: stopEntry.name?.en ?? '',
        zh: stopEntry.name?.zh ?? '',
      })
    : false

  // Past exact range a match needs name agreement. A bare coordinate hit
  // inside the ceiling stays unresolved so neighbouring stops never link
  // on proximity alone.
  if (best.distanceKm > exactKm && !nameMatched) {
    return {
      status: 'unresolved',
      td,
      reason: 'name-mismatch',
      detail:
        `Nearest candidate ${best.stopId} is ${best.distanceKm.toFixed(3)} km away ` +
        'with no name agreement. Needs a reviewed override.',
      distanceKm: best.distanceKm,
      nameMatched: false,
    }
  }

  const confidence: TdMatchConfidence = best.distanceKm <= exactKm ? 'exact' : 'high'

  return {
    status: 'matched',
    td,
    eta: {
      co: best.variant.co,
      route: best.variant.entry.route,
      bound: best.variant.bound,
      serviceType: best.variant.serviceType,
      stopId: best.stopId,
      seq: best.seq,
    },
    entry: best.variant.entry,
    confidence,
    distanceKm: best.distanceKm,
    nameMatched,
  }
}

function findOverrideEntry(
  variants: EtaVariantCandidate[],
  ref: EtaStopRef
): RouteListEntry | null {
  const found = variants.find(
    (variant) =>
      variant.co === ref.co &&
      variant.entry.route.trim().toUpperCase() === ref.route.trim().toUpperCase() &&
      variant.bound === ref.bound &&
      String(variant.serviceType) === String(ref.serviceType)
  )
  return found?.entry ?? null
}

/** Matches a batch of TD points, preserving input order. */
export function matchTdStopPoints(points: TdStopPoint[], ctx: TdMatcherContext): TdStopMatch[] {
  return points.map((point) => matchTdStopPoint(point, ctx))
}

export function summarizeTdMatches(matches: TdStopMatch[]): TdMatchSummary {
  const summary: TdMatchSummary = {
    total: matches.length,
    matched: 0,
    unresolved: 0,
    byConfidence: { override: 0, exact: 0, high: 0, medium: 0 },
    byReason: {},
  }
  for (const match of matches) {
    if (match.status === 'matched') {
      summary.matched += 1
      summary.byConfidence[match.confidence] += 1
    } else {
      summary.unresolved += 1
      summary.byReason[match.reason] = (summary.byReason[match.reason] ?? 0) + 1
    }
  }
  return summary
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asOptionalString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Parses one GeoJSON feature into a TD stop point. Null when unusable. */
export function parseTdStopPointFeature(feature: unknown): TdStopPoint | null {
  const record = asRecord(feature)
  if (!record || record.type !== 'Feature') return null
  const geometry = asRecord(record.geometry)
  if (!geometry || geometry.type !== 'Point') return null
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) return null
  const [lng, lat] = geometry.coordinates
  if (!isFiniteCoord(lat) || !isFiniteCoord(lng)) return null

  const props = asRecord(record.properties)
  if (!props) return null
  const companyCode = asNonEmptyString(props.companyCode)
  const routeName =
    asNonEmptyString(props.routeNameE) ??
    asNonEmptyString(props.routeNameC) ??
    asNonEmptyString(props.routeNameS)
  const routeSeq = asFiniteNumber(props.routeSeq)
  const stopSeq = asFiniteNumber(props.stopSeq)
  const stopId = asFiniteNumber(props.stopId) ?? asNonEmptyString(props.stopId)
  if (!companyCode || !routeName || routeSeq === null || stopSeq === null || stopId === null) {
    return null
  }
  const routeId = asFiniteNumber(props.routeId)

  return {
    companyCode,
    routeName,
    routeId,
    routeSeq,
    stopSeq,
    tdStopId: stopId,
    lat,
    lng,
    stopNameC: asOptionalString(props.stopNameC),
    stopNameS: asOptionalString(props.stopNameS),
    stopNameE: asOptionalString(props.stopNameE),
  }
}

/**
 * Parses a TD `FeatureCollection` into stop points. Malformed features are
 * skipped, never coerced, so bad input shrinks the output instead of
 * corrupting matches.
 */
export function parseTdFeatureCollection(data: unknown): TdStopPoint[] {
  const record = asRecord(data)
  if (!record || record.type !== 'FeatureCollection' || !Array.isArray(record.features)) return []
  const points: TdStopPoint[] = []
  for (const feature of record.features) {
    const point = parseTdStopPointFeature(feature)
    if (point) points.push(point)
  }
  return points
}

function parseEtaStopRef(value: unknown): EtaStopRef | null {
  const record = asRecord(value)
  if (!record) return null
  const co = ETA_COMPANY_BY_LOWERCASE[asNonEmptyString(record.co)?.toLowerCase() ?? ''] ?? null
  const route = asNonEmptyString(record.route)
  const bound = typeof record.bound === 'string' ? record.bound : null
  const serviceType =
    typeof record.serviceType === 'string' || typeof record.serviceType === 'number'
      ? String(record.serviceType)
      : null
  const stopId = asNonEmptyString(record.stopId)
  const seq = asFiniteNumber(record.seq)
  if (!co || !route || bound === null || serviceType === null) {
    return null
  }
  if (!stopId || seq === null || !Number.isInteger(seq) || seq < 0) return null
  return { co, route, bound, serviceType, stopId, seq }
}

function parseTdStopOverride(value: unknown): TdStopOverride | null {
  const record = asRecord(value)
  if (!record) return null
  if (record.type === 'match') {
    const ref = parseEtaStopRef(record.ref)
    return ref ? { type: 'match', ref } : null
  }
  if (record.type === 'unresolved') {
    const reason = typeof record.reason === 'string' ? record.reason : undefined
    return { type: 'unresolved', reason }
  }
  return null
}

/**
 * Loads a persisted override table, skipping invalid entries instead of
 * failing the whole file. `JSON.parse` output goes in here.
 */
export function parseTdOverrideTable(data: unknown): TdOverrideTable {
  const record = asRecord(data)
  if (!record) return {}
  const table: TdOverrideTable = {}
  for (const [key, value] of Object.entries(record)) {
    const override = parseTdStopOverride(value)
    if (override) table[key] = override
  }
  return table
}
