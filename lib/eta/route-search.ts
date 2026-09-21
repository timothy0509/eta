import type { KmbRouteInfoLite, KmbRouteStopLite } from '@/lib/eta/client'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
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
  /** Lowercased stop names across all languages, capped, for matching. */
  stopNames: string[]
  /** Lowercased join of number, termini, and stops for fuzzy matching. */
  haystack: string
  stopCount: number
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

function normalizeCo(co: string | undefined): string {
  return String(co ?? 'kmb')
    .trim()
    .toLowerCase()
}

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
    const key = `${normalizeCo(String(r.co))}|${r.route}`
    const list = variantsByKey.get(key)
    if (list) list.push(r)
    else variantsByKey.set(key, [r])
  }

  const stopIdsByKey = new Map<string, { ids: string[]; seen: Set<string>; total: number }>()
  for (const rs of routeStops) {
    const key = `${normalizeCo(String(rs.co))}|${rs.route}`
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
    const co = normalizeCo(String(first.co))
    const bucket = stopIdsByKey.get(key)
    const stopIds = bucket?.ids ?? []

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

    const operators = Array.from(new Set(variants.map((v) => normalizeCo(String(v.co)))))
    const serviceTypes = Array.from(new Set(variants.map((v) => String(v.serviceType))))
    const directions = Array.from(new Set(variants.map((v) => String(v.bound))))

    const haystack = [
      first.route,
      first.origin.en,
      first.origin.tc,
      first.origin.sc,
      first.destination.en,
      first.destination.tc,
      first.destination.sc,
      ...stopNames,
    ]
      .join(' ')
      .toLowerCase()

    entries.push({
      key,
      co,
      route: first.route,
      operators,
      origin: first.origin,
      destination: first.destination,
      stopIds,
      stopNames,
      haystack,
      stopCount: bucket?.total ?? 0,
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
  for (const t of termini) {
    if (t.raw.trim().toLowerCase() === norm.lower) {
      return { entry, score: 2, matchReason: { kind: 'terminus', text: t.display } }
    }
  }
  for (const t of termini) {
    if (t.raw.trim().toLowerCase().startsWith(norm.lower)) {
      return { entry, score: 3, matchReason: { kind: 'terminus', text: t.display } }
    }
  }
  for (const t of termini) {
    if (norm.lower && t.raw.toLowerCase().includes(norm.lower)) {
      return { entry, score: 4, matchReason: { kind: 'terminus', text: t.display } }
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
    counts.set(entry.co, (counts.get(entry.co) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
}

/**
 * Pick spread key stops for the via line: first, middle, last intermediates,
 * skipping termini dupes and repeated names.
 */
export function getKeyStops(
  entry: RouteSearchEntry,
  stopsById: Map<string, KmbStopSearchItem>,
  lang: UiLanguage,
  n = 3
): string[] {
  const skip = new Set<string>()
  for (const field of ['origin', 'destination'] as const) {
    for (const name of Object.values(entry[field])) {
      const lowered = String(name ?? '')
        .trim()
        .toLowerCase()
      if (lowered) skip.add(lowered)
    }
  }

  const names: string[] = []
  const seen = new Set<string>()
  for (const stopId of entry.stopIds) {
    const stop = stopsById.get(stopId)
    if (!stop) continue
    const full = pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
    if (skip.has(full.trim().toLowerCase())) continue
    const parsed = parseKmbStopNameCached(full, { isKmb: isKmbStop(stop), lang })
    const name = parsed.name.trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }

  if (names.length <= n) return names
  const picked: string[] = []
  for (let i = 0; i < n; i += 1) {
    const name = names[Math.round((i * (names.length - 1)) / (n - 1))]
    if (name && !picked.includes(name)) picked.push(name)
  }
  return picked
}
