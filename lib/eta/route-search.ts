import type { KmbRouteInfoLite, KmbRouteStopLite } from '@/lib/eta/client'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { normalizeOperator } from '@/lib/eta/operator-colors'
import { pickLang } from '@/lib/eta/pick-lang'
import { isKmbStop } from '@/lib/eta/types'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'

/**
 * Ranked search over bus routes. One entry per co|route, matching on the
 * route number plus termini and stop names in all three languages.
 */

export type RouteSearchEntry = {
  key: string
  co: string
  route: string
  operators: string[]
  origin: { en: string; tc: string; sc: string }
  destination: { en: string; tc: string; sc: string }
  /** Ordered stop ids along the route, deduped and capped. */
  stopIds: string[]
  /** One direction of stop ids in seq order, deduped, for the via line. */
  viaStopIds: string[]
  /** Lowercased stop names across all languages, capped, for matching. */
  stopNames: string[]
  /** Lowercased join of number, termini, and stops for fuzzy matching. */
  haystack: string
  /** Lowercased origin/destination names across all variants, so short workings match. */
  altNames: string[]
  stopCount: number
  /** Longest single-direction stop count, drives the via-line count. */
  viaStopCount: number
  variantCount: number
  serviceTypes: string[]
  directions: string[]
}

export type RouteMatchReason = {
  kind: 'number' | 'terminus' | 'stop'
  text: string
}

export type RouteSearchHit = {
  entry: RouteSearchEntry
  score: number
  matchReason?: RouteMatchReason
}

/** Structural Fuse instance so callers can lazy-load fuse.js like stop-search does. */
export type RouteFuseInstance = {
  search: (query: string) => Array<{ item: RouteSearchEntry; score?: number }>
}

export const ROUTE_FUSE_OPTIONS = {
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
  shouldSort: true,
  keys: [
    { name: 'route', weight: 0.5 },
    { name: 'haystack', weight: 0.5 },
  ],
}

/** Lazy-load fuse.js and build an index over the docs. Null when unavailable. */
export async function loadRouteFuseIndex(
  docs: RouteSearchEntry[]
): Promise<RouteFuseInstance | null> {
  try {
    const mod = await import('fuse.js')
    const instance = new mod.default(docs, ROUTE_FUSE_OPTIONS)
    return {
      search: (query: string) =>
        instance.search(query).map((r) => ({ item: r.item, score: r.score })),
    }
  } catch {
    return null
  }
}

const MAX_STOP_IDS_PER_ROUTE = 40
const MAX_STOP_NAMES_PER_ROUTE = 60

export function normalizeRouteQuery(query: string): {
  raw: string
  lower: string
  upper: string
  number: string
} {
  const raw = query.trim()
  return {
    raw,
    lower: raw.toLowerCase(),
    upper: raw.toUpperCase(),
    number: raw.toUpperCase().replace(/\s+/g, ''),
  }
}

export function compareRouteEntries(a: RouteSearchEntry, b: RouteSearchEntry): number {
  return a.route.localeCompare(b.route, undefined, { numeric: true }) || a.co.localeCompare(b.co)
}

function entryDisplayText(
  entry: RouteSearchEntry,
  field: 'origin' | 'destination',
  lang: UiLanguage
): string {
  return pickLang(entry[field], lang)
}

function canonicalRouteSearchKey(co: unknown, route: unknown): string {
  return `${normalizeOperator(String(co ?? ''))}|${String(route ?? '').toUpperCase()}`
}

/**
 * Build one search entry per co|route from the variant list plus the full
 * route-stop table joined with stop names. Pure and memo-friendly.
 */
export function buildRouteSearchIndex(
  routes: KmbRouteInfoLite[],
  routeStops: KmbRouteStopLite[],
  stopsById: Map<string, KmbStopSearchItem>
): RouteSearchEntry[] {
  const variantsByKey = new Map<string, KmbRouteInfoLite[]>()
  for (const r of routes) {
    const key = canonicalRouteSearchKey(r.co, r.route)
    const list = variantsByKey.get(key)
    if (list) list.push(r)
    else variantsByKey.set(key, [r])
  }

  const stopIdsByKey = new Map<string, { ids: string[]; seen: Set<string>; total: number }>()
  // Group raw rows by co|route plus bound plus service type so each
  // direction stays separate, keeping seq order for the via line.
  const rowsByVariantKey = new Map<string, KmbRouteStopLite[]>()
  for (const rs of routeStops) {
    const routeKey = canonicalRouteSearchKey(rs.co, rs.route)
    if (!variantsByKey.has(routeKey)) continue
    const variantKey = `${routeKey}|${String(rs.bound ?? '')}|${String(rs.serviceType ?? '')}`
    const list = rowsByVariantKey.get(variantKey)
    if (list) list.push(rs)
    else rowsByVariantKey.set(variantKey, [rs])
  }
  for (const rows of rowsByVariantKey.values()) {
    rows.sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0))
  }
  for (const rs of routeStops) {
    const key = canonicalRouteSearchKey(rs.co, rs.route)
    if (!variantsByKey.has(key)) continue
    let bucket = stopIdsByKey.get(key)
    if (!bucket) {
      bucket = { ids: [], seen: new Set(), total: 0 }
      stopIdsByKey.set(key, bucket)
    }
    if (bucket.seen.has(rs.stopId)) continue
    bucket.seen.add(rs.stopId)
    bucket.total += 1
    if (bucket.ids.length < MAX_STOP_IDS_PER_ROUTE) bucket.ids.push(rs.stopId)
  }

  const entries: RouteSearchEntry[] = []
  for (const [key, variants] of variantsByKey) {
    const first = variants[0]
    if (!first) continue
    const co = normalizeOperator(String(first.co))
    const bucket = stopIdsByKey.get(key)
    const stopIds = bucket?.ids ?? []

    // Via line uses one representative variant (the longest
    // bound|serviceType group in seq order) so O and I stops never mix.
    let viaStopIds: string[] = []
    let viaStopCount = 0
    for (const [variantKey, rows] of rowsByVariantKey) {
      if (!variantKey.startsWith(`${key}|`)) continue
      const ids: string[] = []
      const seen = new Set<string>()
      for (const row of rows) {
        const stopId = String(row.stopId ?? '').trim()
        if (!stopId || seen.has(stopId)) continue
        seen.add(stopId)
        ids.push(stopId)
      }
      if (ids.length > viaStopIds.length) {
        viaStopIds = ids
        viaStopCount = ids.length
      }
    }
    if (!viaStopIds.length) viaStopIds = bucket?.ids ?? []

    const stopNames: string[] = []
    const stopNameSeen = new Set<string>()
    for (const stopId of stopIds) {
      const stop = stopsById.get(stopId)
      if (!stop) continue
      for (const name of [stop.nameEn, stop.nameTc, stop.nameSc]) {
        const lowered = String(name ?? '')
          .trim()
          .toLowerCase()
        if (!lowered || stopNameSeen.has(lowered)) continue
        stopNameSeen.add(lowered)
        if (stopNames.length < MAX_STOP_NAMES_PER_ROUTE) stopNames.push(lowered)
      }
    }

    const operators = Array.from(new Set(variants.map((v) => normalizeOperator(String(v.co)))))
    const serviceTypes = Array.from(new Set(variants.map((v) => String(v.serviceType))))
    const directions = Array.from(new Set(variants.map((v) => String(v.bound))))

    const altNameSeen = new Set<string>()
    const altNames: string[] = []
    for (const v of variants) {
      for (const record of [v.origin, v.destination]) {
        for (const name of [record.en, record.tc, record.sc]) {
          const lowered = String(name ?? '')
            .trim()
            .toLowerCase()
          if (!lowered || altNameSeen.has(lowered)) continue
          altNameSeen.add(lowered)
          altNames.push(lowered)
        }
      }
    }

    const haystack = [first.route, ...altNames, ...stopNames].join(' ').toLowerCase()

    entries.push({
      key,
      co,
      route: first.route,
      operators,
      origin: first.origin,
      destination: first.destination,
      stopIds,
      viaStopIds,
      stopNames,
      haystack,
      altNames,
      stopCount: bucket?.total ?? 0,
      /** Longest single-direction stop count, drives the via-line count. */
      viaStopCount,
      variantCount: variants.length,
      serviceTypes,
      directions,
    })
  }

  return entries.sort(compareRouteEntries)
}

type ScoredHit = {
  entry: RouteSearchEntry
  score: number
  matchReason?: RouteMatchReason
}

function matchEntrySync(
  entry: RouteSearchEntry,
  norm: ReturnType<typeof normalizeRouteQuery>,
  lang: UiLanguage,
  stopsById?: Map<string, KmbStopSearchItem>
): ScoredHit | null {
  const routeUpper = entry.route.toUpperCase()

  if (norm.number && routeUpper === norm.number) {
    return { entry, score: 0, matchReason: { kind: 'number', text: entry.route } }
  }
  if (norm.number && routeUpper.startsWith(norm.number)) {
    return { entry, score: 1, matchReason: { kind: 'number', text: entry.route } }
  }

  const termini: Array<{ raw: string; display: string }> = []
  for (const field of ['origin', 'destination'] as const) {
    const record = entry[field]
    termini.push({ raw: record.en, display: entryDisplayText(entry, field, lang) })
    termini.push({ raw: record.tc, display: entryDisplayText(entry, field, lang) })
    termini.push({ raw: record.sc, display: entryDisplayText(entry, field, lang) })
  }
  if (norm.lower) {
    for (const t of termini) {
      if (t.raw.trim().toLowerCase() === norm.lower) {
        return { entry, score: 2, matchReason: { kind: 'terminus', text: t.display } }
      }
    }
    for (const name of entry.altNames) {
      if (name === norm.lower) {
        return { entry, score: 2, matchReason: { kind: 'terminus', text: name } }
      }
    }
  }
  if (norm.lower) {
    for (const t of termini) {
      if (t.raw.trim().toLowerCase().startsWith(norm.lower)) {
        return { entry, score: 3, matchReason: { kind: 'terminus', text: t.display } }
      }
    }
    for (const name of entry.altNames) {
      if (name.startsWith(norm.lower)) {
        return { entry, score: 3, matchReason: { kind: 'terminus', text: name } }
      }
    }
    for (const t of termini) {
      if (t.raw.toLowerCase().includes(norm.lower)) {
        return { entry, score: 4, matchReason: { kind: 'terminus', text: t.display } }
      }
    }
    for (const name of entry.altNames) {
      if (name.includes(norm.lower)) {
        return { entry, score: 4, matchReason: { kind: 'terminus', text: name } }
      }
    }
  }

  if (norm.number.length >= 2 && routeUpper.includes(norm.number)) {
    return { entry, score: 5, matchReason: { kind: 'number', text: entry.route } }
  }

  for (const name of entry.stopNames) {
    if (name.startsWith(norm.lower)) {
      return {
        entry,
        score: 6,
        matchReason: stopMatchReason(entry, norm.lower, lang, stopsById) ?? {
          kind: 'stop',
          text: name,
        },
      }
    }
  }
  for (const name of entry.stopNames) {
    if (norm.lower && name.includes(norm.lower)) {
      return {
        entry,
        score: 7,
        matchReason: stopMatchReason(entry, norm.lower, lang, stopsById) ?? {
          kind: 'stop',
          text: name,
        },
      }
    }
  }

  return null
}

function stopMatchReason(
  entry: RouteSearchEntry,
  needle: string,
  lang: UiLanguage,
  stopsById?: Map<string, KmbStopSearchItem>
): RouteMatchReason | undefined {
  if (!stopsById) return undefined
  for (const stopId of entry.stopIds) {
    const stop = stopsById.get(stopId)
    if (!stop) continue
    const names = [stop.nameEn, stop.nameTc, stop.nameSc]
    if (
      names.some((n) =>
        String(n ?? '')
          .toLowerCase()
          .includes(needle)
      )
    ) {
      const full = pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
      const parsed = parseKmbStopNameCached(full, { isKmb: isKmbStop(stop), lang })
      return { kind: 'stop', text: parsed.name }
    }
  }
  return undefined
}

function compareHits(a: ScoredHit, b: ScoredHit): number {
  if (a.score !== b.score) return a.score - b.score
  return compareRouteEntries(a.entry, b.entry)
}

export type SearchRouteOptions = {
  operator?: string | null
  lang?: UiLanguage
  limit?: number
  fuse?: RouteFuseInstance | null
  stopsById?: Map<string, KmbStopSearchItem>
}

/** Rank entries for a query. Empty query returns numeric order. */
export function searchRouteIndex(
  index: RouteSearchEntry[],
  query: string,
  opts: SearchRouteOptions = {}
): RouteSearchHit[] {
  const operator = opts.operator?.trim().toLowerCase() || null
  const lang = opts.lang ?? 'tc'
  const limit = opts.limit ?? 500
  const norm = normalizeRouteQuery(query)

  const pool = operator
    ? index.filter((e) => e.operators.some((o) => o.toLowerCase() === operator))
    : index

  if (!norm.lower) {
    return pool.map((entry) => ({ entry, score: 0 })).slice(0, limit)
  }

  const hits: ScoredHit[] = []
  for (const entry of pool) {
    const m = matchEntrySync(entry, norm, lang, opts.stopsById)
    if (m) hits.push(m)
  }
  hits.sort(compareHits)

  if (opts.fuse && hits.length < 20) {
    const seen = new Set(hits.map((h) => h.entry.key))
    for (const r of opts.fuse.search(norm.lower).slice(0, 60)) {
      if (seen.has(r.item.key)) continue
      if (operator && !r.item.operators.some((o) => o.toLowerCase() === operator)) continue
      hits.push({ entry: r.item, score: 8 + (r.score ?? 0.5) })
    }
    hits.sort(compareHits)
  }

  return hits
    .slice(0, limit)
    .map(({ entry, score, matchReason }) => ({ entry, score, matchReason }))
}

/** Operator codes present in the index with entry counts, most common first. */
export function operatorCounts(index: RouteSearchEntry[]): Array<{ code: string; count: number }> {
  const counts = new Map<string, number>()
  for (const entry of index) {
    for (const code of entry.operators) {
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
}

/**
 * Count distinct co|route values per stop-name group (parsed base name,
 * lowercased). Stops sharing a name form one group, so the count is the
 * number of routes serving the group. Used to rank via-line candidates
 * so busy interchanges win over quiet stops.
 */
export function countRoutesByStopName(
  routeStops: Array<{ co: string; route: string; stopId: string }>,
  stopsById: Map<string, KmbStopSearchItem>,
  lang: UiLanguage
): Map<string, number> {
  const nameByStopId = new Map<string, string>()
  for (const [stopId, stop] of stopsById) {
    const full = pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
    const parsed = parseKmbStopNameCached(full, { isKmb: isKmbStop(stop), lang })
    const key = parsed.name.trim().toLowerCase()
    if (key) nameByStopId.set(stopId, key)
  }
  const byName = new Map<string, Set<string>>()
  for (const rs of routeStops) {
    const stopId = String(rs.stopId ?? '').trim()
    if (!stopId) continue
    const key = nameByStopId.get(stopId)
    if (!key) continue
    const routeKey = canonicalRouteSearchKey(rs.co, rs.route)
    let set = byName.get(key)
    if (!set) {
      set = new Set()
      byName.set(key, set)
    }
    set.add(routeKey)
  }
  const out = new Map<string, number>()
  for (const [key, set] of byName) out.set(key, set.size)
  return out
}

/**
 * Absolute cap on via stops shown. resolveKeyStopCount never returns
 * more than this, even if a larger max is passed.
 */
export const MAX_KEY_STOPS = 7

/**
 * How many via stops to show for a route of `totalStops` length,
 * capped at MAX_KEY_STOPS. Short routes show a single midpoint,
 * long routes scale up. Larger `max` values are clamped to the cap.
 */
export function resolveKeyStopCount(totalStops: number, max = MAX_KEY_STOPS): number {
  const cap = Math.max(0, Math.min(MAX_KEY_STOPS, max))
  if (totalStops <= 2) return 0
  if (totalStops <= 5) return Math.min(1, cap)
  if (totalStops <= 12) return Math.min(2, cap)
  if (totalStops <= 20) return Math.min(3, cap)
  if (totalStops <= 30) return Math.min(4, cap)
  if (totalStops <= 45) return Math.min(5, cap)
  if (totalStops <= 65) return Math.min(6, cap)
  return cap
}

/**
 * Pick via-line stops: never the first or last stop, up to MAX_KEY_STOPS
 * based on route length, spread evenly along the route, preferring stops
 * served by many routes within each segment. Falls back to segment centres
 * when no usage data is given.
 */
export function getKeyStops(
  entry: RouteSearchEntry,
  stopsById: Map<string, KmbStopSearchItem>,
  lang: UiLanguage,
  max = MAX_KEY_STOPS,
  usageByStopName?: Map<string, number>
): string[] {
  const orderedIds = entry.viaStopIds.length > 0 ? entry.viaStopIds : entry.stopIds
  const total = orderedIds.length
  if (total <= 2) return []
  const k = resolveKeyStopCount(entry.viaStopCount > 0 ? entry.viaStopCount : total, max)
  if (k <= 0) return []

  const skip = new Set<string>()
  for (const field of ['origin', 'destination'] as const) {
    for (const name of Object.values(entry[field])) {
      const lowered = String(name ?? '')
        .trim()
        .toLowerCase()
      if (lowered) skip.add(lowered)
    }
  }
  for (const name of entry.altNames) skip.add(name)

  // Interior window with an end margin so picks stay clear of the
  // termini. Indices are positions in the single-direction via list.
  let start = Math.max(1, Math.floor(total * 0.12))
  let end = Math.min(total - 1, Math.ceil(total * 0.88))
  if (end <= start) {
    start = 1
    end = total - 1
  }

  type Candidate = { name: string; pos: number; usage: number }
  const candidates: Candidate[] = []
  const seen = new Set<string>()
  for (let idx = start; idx < end; idx += 1) {
    // First and last physical stops never show, even if margins change.
    if (idx <= 0 || idx >= total - 1) continue
    const stopId = orderedIds[idx]
    if (!stopId) continue
    const stop = stopsById.get(stopId)
    if (!stop) continue
    const full = pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
    if (skip.has(full.trim().toLowerCase())) continue
    const parsed = parseKmbStopNameCached(full, { isKmb: isKmbStop(stop), lang })
    const name = parsed.name.trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    // Route index, not filtered index, so the centre tie-break below
    // measures distance along the route.
    candidates.push({ name, pos: idx, usage: usageByStopName?.get(key) ?? 0 })
  }

  if (candidates.length <= k) return candidates.map((c) => c.name)

  // Split the ordered candidates into k contiguous bins and take the
  // highest-usage stop in each bin, breaking ties toward the bin centre
  // so picks stay evenly spaced.
  const picked: Candidate[] = []
  for (let i = 0; i < k; i += 1) {
    const binStart = Math.floor((i * candidates.length) / k)
    const binEnd = Math.floor(((i + 1) * candidates.length) / k)
    const bin = candidates.slice(binStart, binEnd)
    if (!bin.length) continue
    const centre = ((bin[0]?.pos ?? 0) + (bin[bin.length - 1]?.pos ?? 0)) / 2
    let best = bin[0]
    if (!best) continue
    for (const c of bin) {
      if (c.usage !== best.usage) {
        if (c.usage > best.usage) best = c
        continue
      }
      const distC = Math.abs(c.pos - centre)
      const distBest = Math.abs(best.pos - centre)
      if (distC < distBest) best = c
    }
    picked.push(best)
  }
  picked.sort((a, b) => a.pos - b.pos)
  return picked.map((c) => c.name)
}
