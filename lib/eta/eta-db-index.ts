import type { Company, EtaDb, RouteListEntry } from 'hk-bus-eta'

import type { AppCompany } from '@/lib/eta/companies'
import { isKmbFamily, isLwbRoute, resolveAppCompany } from '@/lib/eta/companies'
import {
  inferJointRouteNumbers,
  jointCrossPairKey,
  jointRouteGroupKey,
  jointVariantKeyForEntry,
  resolveJointOperators,
  type JointRouteManifest,
} from '@/lib/eta/joint-routes'

/**
 * Index entries are reclassified so LWB has its own company/stops/bound.
 * Read stops directly; LWB is never folded into KMB here.
 */
function stopsForCo(entry: RouteListEntry, co: string): string[] | undefined {
  return (entry.stops as Record<string, string[] | undefined>)[co]
}

/**
 * Manifest-space mapping for joint matching: the TD manifest files
 * KMB-family joints (S1/R8 agency LWB+CTB) as kmb+ctb while the index keeps
 * the LWB half under `lwb`.
 */
function toJointMatchCo(co: string): string {
  const lower = String(co ?? '')
    .trim()
    .toLowerCase()
  return lower === 'lwb' ? 'kmb' : lower
}

/**
 * Manifest-matched joint operators mapped back to actual index companies so
 * S1/R8 joints report `lwb`, not `kmb`.
 */
function resolveJointOperatorsForEntry(
  manifest: JointRouteManifest | null | undefined,
  route: string,
  actualCos: string[]
): string[] {
  const matched = resolveJointOperators(manifest, route, actualCos.map(toJointMatchCo))
  if (matched.length < 2) return []
  const actual = new Set(
    actualCos.map((co) =>
      String(co ?? '')
        .trim()
        .toLowerCase()
    )
  )
  return matched.map((op) => (op === 'kmb' && !actual.has('kmb') && actual.has('lwb') ? 'lwb' : op))
}
import type { KmbStopSearchItem } from '@/lib/eta/types'

export type { KmbStopSearchItem }

/** Operators that appear in the app route list, in display preference order. */
const OPERATOR_PRIORITY = ['kmb', 'lwb', 'ctb', 'nlb', 'gmb', 'lrtfeeder'] as const

/**
 * Primary operator for a joint route row. An explicit preference wins when
 * that operator serves the route; otherwise KMB comes first, then the rest.
 * The `kmb` preference covers the LWB half of LWB+CTB joints (S1/R8), which
 * the index keeps under its own `lwb` company.
 */
export function pickPrimaryOperator(
  operators: Iterable<string>,
  preferred?: string | null
): string {
  const set = new Set<string>()
  for (const op of operators) {
    const lower = String(op ?? '')
      .trim()
      .toLowerCase()
    if (lower) set.add(lower)
  }
  const preferredLower = String(preferred ?? '')
    .trim()
    .toLowerCase()
  if (preferredLower && set.has(preferredLower)) return preferredLower
  if (preferredLower === 'kmb' && set.has('lwb')) return 'lwb'
  for (const fallback of OPERATOR_PRIORITY) {
    if (set.has(fallback)) return fallback
  }
  return Array.from(set).sort()[0] ?? 'kmb'
}

/** Sorted lowercase operator list, used for stable joint keys. */
export function normalizeOperatorList(operators: Iterable<string>): string[] {
  const set = new Set<string>()
  for (const op of operators) {
    const lower = String(op ?? '')
      .trim()
      .toLowerCase()
    if (lower) set.add(lower)
  }
  return Array.from(set).sort()
}

/** Tail of a region key (`co|ROUTE|n` -> `n`), used to compare joint regions. */
export function regionOrdinal(region: string | null | undefined): string {
  const parts = String(region ?? '').split('|')
  return parts.length >= 3 ? parts.slice(2).join('|') : String(region ?? '')
}

export type KmbRouteStopLite = {
  co: AppCompany
  route: string
  bound: 'I' | 'O' | string
  serviceType: string
  seq: number
  stopId: string
  /** Upstream gtfsId: the stable discriminator for same-number routes in
   * different regions (e.g. GMB 1 in HKI vs Kowloon). Empty when upstream
   * provides none. */
  gtfsId: string
  /** Region group within (co, route): gtfsIds sharing stops merge into one
   * region (branches/short workings); disjoint gtfsIds split (HKI vs
   * Kowloon vs NT minibus routes). Joint routes use one `joint|ROUTE|n`
   * region for every operator so search and the route view can merge them. */
  region: string
  /** Operators serving this variant. More than one means jointly operated. */
  operators?: string[]
  /** Route-level key for a jointly operated route number, including specials. */
  routeGroupKey?: string
  /** Shared identity for one physical variant across its operators. */
  jointVariantKey?: string
  /** Shared identity for one paired physical stop across its operators. */
  jointGroupKey?: string
  /** Stop ids for the other operators at the same physical stop. */
  siblingStopIds?: string[]
}

export type KmbRouteInfoLite = {
  co: AppCompany
  route: string
  bound: 'I' | 'O' | string
  serviceType: string
  gtfsId: string
  /** Region group within (co, route), matching KmbRouteStopLite.region. */
  region: string
  /** Operators serving this variant. More than one means jointly operated. */
  operators?: string[]
  /** Route-level key for a jointly operated route number, including specials. */
  routeGroupKey?: string
  /** Shared identity for one physical variant across its operators. */
  jointVariantKey?: string
  origin: {
    en: string
    tc: string
    sc: string
  }
  destination: {
    en: string
    tc: string
    sc: string
  }
  routeEntry: RouteListEntry
}

type BusRouteCandidate = {
  entry: RouteListEntry
  co: AppCompany
}

export type StopRouteEntry = {
  stopId: string
  co: AppCompany
  route: string
  bound: string
  serviceType: string
  seq: number
  gtfsId: string
  region: string
  /** Operators serving this variant. More than one means jointly operated. */
  operators?: string[]
  /** Route-level key for a jointly operated route number, including specials. */
  routeGroupKey?: string
  /** Shared identity for one physical variant across its operators. */
  jointVariantKey?: string
  /** Shared identity for one paired physical stop across its operators. */
  jointGroupKey?: string
  /** Other operators' stop ids at the same physical stop. */
  siblingStopIds?: string[]
}

export type RouteVariantKey = {
  co: AppCompany
  route: string
  bound: string
  serviceType: string
  /** Upstream gtfsId. Same route number in different regions (e.g. GMB 1
   * in HKI vs Kowloon vs NT) carries a distinct gtfsId per region; empty
   * when upstream provides none. */
  gtfsId?: string
}

export function normalizeGtfsId(gtfsId: unknown): string {
  return String(gtfsId ?? '').trim()
}

/**
 * Put an LWB route under its own company. hk-bus-eta files every KMB-group
 * route under co "kmb" (including Long Win). The TD GTFS list is the source
 * of truth for which short names are LWB, so this maps kmb -> lwb for those
 * routes and moves the per-company stops and bound across with it.
 * Non-LWB entries come back untouched.
 */
export function reclassifyLwbRouteEntry(entry: RouteListEntry): RouteListEntry {
  if (!entry.co.includes('kmb') || !isLwbRoute(entry.route)) return entry
  const co = entry.co.map((company) => (company === 'kmb' ? 'lwb' : company)) as Company[]
  const bound = { ...entry.bound } as Record<string, string>
  const stops = { ...entry.stops } as Record<string, string[]>
  if (bound.kmb) {
    bound.lwb = bound.kmb
    delete bound.kmb
  }
  if (stops.kmb) {
    stops.lwb = stops.kmb
    delete stops.kmb
  }
  return {
    ...entry,
    co,
    bound: bound as RouteListEntry['bound'],
    stops: stops as RouteListEntry['stops'],
  }
}

/**
 * Totally order gtfsIds within one (co, route) group so region assignment is
 * stable across rebuilds: numeric ids ascending, then lexicographic, with
 * the empty id (legacy/unknown) sorting last so known regions keep low ids.
 */
function compareGtfsId(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  const na = Number(a)
  const nb = Number(b)
  const aNumeric = a !== '' && Number.isInteger(na)
  const bNumeric = b !== '' && Number.isInteger(nb)
  if (aNumeric && bNumeric && na !== nb) return na - nb
  return a < b ? -1 : 1
}

/**
 * Partition the gtfsIds of one (co, route) route family into region groups.
 * Nodes sharing at least one stop id merge (branches and short workings of
 * one region share stops), disjoint nodes split (HKI vs Kowloon vs NT
 * minibus routes share no stops). Deterministic: members sorted, groups
 * ordered by smallest member. Returns singletons when every node is
 * disjoint, and one group when everything connects.
 */
export function groupRegionStops(
  stopsByGtfsId: Map<string, Set<string>> | Record<string, Set<string> | string[]>
): string[][] {
  const entries: Array<[string, Set<string>]> =
    stopsByGtfsId instanceof Map
      ? Array.from(stopsByGtfsId.entries())
      : Object.entries(stopsByGtfsId).map(([gtfsId, stops]) => [
          gtfsId,
          stops instanceof Set ? stops : new Set(stops),
        ])
  entries.sort(([a], [b]) => compareGtfsId(a, b))
  const parent = new Map<string, string>()
  for (const [gtfsId] of entries) parent.set(gtfsId, gtfsId)
  const find = (x: string): string => {
    let root = x
    while (parent.get(root) !== root) root = parent.get(root) ?? root
    let node = x
    while (parent.get(node) !== root) {
      const next = parent.get(node) ?? root
      parent.set(node, root)
      node = next
    }
    return root
  }
  for (let i = 0; i < entries.length; i += 1) {
    const [aId, aStops] = entries[i]!
    if (aStops.size === 0) continue
    for (let j = i + 1; j < entries.length; j += 1) {
      const [bId, bStops] = entries[j]!
      if (bStops.size === 0) continue
      let shared = false
      const [smaller, larger] = aStops.size <= bStops.size ? [aStops, bStops] : [bStops, aStops]
      for (const stop of smaller) {
        if (larger.has(stop)) {
          shared = true
          break
        }
      }
      if (shared) {
        const ra = find(aId)
        const rb = find(bId)
        if (ra !== rb) {
          const [first, second] = compareGtfsId(ra, rb) <= 0 ? [ra, rb] : [rb, ra]
          parent.set(second, first)
        }
      }
    }
  }
  const groups = new Map<string, string[]>()
  for (const [gtfsId] of entries) {
    const root = find(gtfsId)
    const list = groups.get(root)
    if (list) list.push(gtfsId)
    else groups.set(root, [gtfsId])
  }
  const out = Array.from(groups.values()).map((members) => [...members].sort(compareGtfsId))
  out.sort((a, b) => compareGtfsId(a[0] ?? '', b[0] ?? ''))
  return out
}

/**
 * Assign a stable region label per (co, route) family from stop-sharing
 * components of gtfsId nodes: `co|ROUTE|<n>`, n starting at 1 in ascending
 * gtfsId order (empty last). Nodes with no stops each form their own
 * trailing group.
 */
export function assignRouteRegions(
  stopsByGtfsId: Map<string, Set<string>> | Record<string, Set<string> | string[]>,
  prefix: { co: AppCompany; route: string }
): Map<string, string> {
  const groups = groupRegionStops(stopsByGtfsId)
  const co = String(prefix.co ?? '')
  const route = String(prefix.route ?? '').toUpperCase()
  const out = new Map<string, string>()
  groups.forEach((members, index) => {
    const region = `${co}|${route}|${index + 1}`
    for (const gtfsId of members) out.set(gtfsId, region)
  })
  return out
}

/**
 * Compute region assignments for every (co, route) family from built
 * route-stop rows. Rows sharing a stop id merge into one region. Rows with
 * an empty stop id are skipped, so stop-less variants resolve to ''.
 */
export function computeRouteRegions(
  routeStops: Array<{ co: AppCompany; route: string; stopId: string; gtfsId: string }>
): Map<string, Map<string, string>> {
  const stopsByFamily = new Map<string, Map<string, Set<string>>>()
  const coRouteByFamily = new Map<string, { co: AppCompany; route: string }>()
  for (const row of routeStops) {
    const co = row.co
    const route = String(row.route ?? '').toUpperCase()
    const stopId = String(row.stopId ?? '').trim()
    if (!co || !route || !stopId) continue
    const familyKey = `${co}|${route}`
    if (!coRouteByFamily.has(familyKey)) coRouteByFamily.set(familyKey, { co, route })
    let stopsByGtfs = stopsByFamily.get(familyKey)
    if (!stopsByGtfs) {
      stopsByGtfs = new Map()
      stopsByFamily.set(familyKey, stopsByGtfs)
    }
    const gtfsId = normalizeGtfsId(row.gtfsId)
    let stops = stopsByGtfs.get(gtfsId)
    if (!stops) {
      stops = new Set()
      stopsByGtfs.set(gtfsId, stops)
    }
    stops.add(stopId)
  }
  const out = new Map<string, Map<string, string>>()
  for (const [familyKey, stopsByGtfs] of stopsByFamily) {
    const prefix = coRouteByFamily.get(familyKey)
    if (!prefix) continue
    out.set(familyKey, assignRouteRegions(stopsByGtfs, prefix))
  }
  return out
}

/**
 * Canonical variant identity. Always five segments:
 * `co|ROUTE|bound|serviceType|gtfsId`, with an empty gtfsId segment when
 * upstream provides none. Same route number in different regions (GMB 1 in
 * HKI vs Kowloon vs NT) carries a distinct gtfsId per region, so the three
 * routes get distinct keys instead of colliding.
 */
export function routeVariantKey(k: RouteVariantKey): string {
  const co = resolveAppCompany(k.co, k.route)
  return `${co}|${k.route.toUpperCase()}|${k.bound}|${k.serviceType}|${normalizeGtfsId(k.gtfsId)}`
}

export type ParsedVariantKey = {
  co: AppCompany
  route: string
  bound: string
  serviceType: string
  gtfsId: string
}

/**
 * Parse a variant key of any known length: legacy 3-part (`route|bound|st`,
 * assumed kmb), legacy 4-part (`co|route|bound|st`), current 5-part with
 * trailing gtfsId, or 6-part group keys with a leg suffix (`A`/`B`/`_`).
 * The leg suffix is dropped: pass a base key when the leg matters.
 */
export function parseVariantKey(key: string): ParsedVariantKey {
  const parts = String(key ?? '').split('|')
  if (parts.length === 3) {
    const [route = '', bound = '', serviceType = ''] = parts
    return {
      co: resolveAppCompany('kmb', route),
      route,
      bound,
      serviceType,
      gtfsId: '',
    }
  }
  if (parts.length === 6) {
    const [co = 'kmb', route = '', bound = '', serviceType = '', gtfsId = ''] = parts
    return {
      co: resolveAppCompany(co, route),
      route,
      bound,
      serviceType,
      gtfsId: gtfsId ?? '',
    }
  }
  const [co = 'kmb', route = '', bound = '', serviceType = '', gtfsId = ''] = parts
  return {
    co: resolveAppCompany(co, route),
    route,
    bound,
    serviceType,
    gtfsId: gtfsId ?? '',
  }
}

/** Family key without gtfsId: `co|ROUTE|bound|serviceType`. Matches every region. */
export function variantFamilyKey(key: string): string {
  const parsed = parseVariantKey(key)
  return `${String(parsed.co ?? '').toLowerCase()}|${parsed.route.toUpperCase()}|${parsed.bound}|${parsed.serviceType}`
}

/** True when a stored filter key selects an entry key: exact match, a
 * legacy 4-part family key matching any region of that family, or a
 * 5-part family match where either side lacks a gtfsId (KMB official
 * stop-eta rows carry no gtfsId while the index does, e.g. filter
 * `kmb|1A|O|1|1053` vs entry `kmb|1A|O|1|`). Two different non-empty
 * gtfsIds never match, so GMB regions stay separate. */
export function variantKeyMatches(filterKey: string, entryKey: string): boolean {
  if (filterKey === entryKey) return true
  const filter = String(filterKey ?? '')
  // Fast path: legacy 4-part family keys match any region of the family.
  // Count pipes instead of splitting twice.
  let pipes = 0
  for (let i = 0; i < filter.length; i += 1) if (filter.charCodeAt(i) === 124) pipes += 1
  if (pipes === 3) {
    if (entryKey === filter || entryKey.startsWith(`${filter}|`)) return true
    // Old links saved kmb|A31 before the LWB split; parse through the
    // app company resolver so the family still matches lwb|A31.
    return variantFamilyKey(filter) === variantFamilyKey(entryKey)
  }
  const parsedFilter = parseVariantKey(filter)
  const parsedEntry = parseVariantKey(entryKey)
  if (
    parsedFilter.co.toLowerCase() !== parsedEntry.co.toLowerCase() ||
    parsedFilter.route.toUpperCase() !== parsedEntry.route.toUpperCase() ||
    parsedFilter.bound !== parsedEntry.bound ||
    parsedFilter.serviceType !== parsedEntry.serviceType
  ) {
    return false
  }
  const filterGtfs = parsedFilter.gtfsId.trim()
  const entryGtfs = parsedEntry.gtfsId.trim()
  if (!filterGtfs || !entryGtfs) return true
  return filterGtfs === entryGtfs
}

/**
 * Match a saved route filter against a joint ETA. Joint rows carry both
 * operators, so selecting either operator's variant must keep the whole
 * merged row. Operator and direction are ignored; route, service type and
 * gtfsId still have to agree.
 */
export function jointVariantKeyMatchesFilter(
  filterKey: string,
  eta: {
    route?: unknown
    serviceType?: unknown
    service_type?: unknown
    gtfsId?: unknown
  }
): boolean {
  const parsed = parseVariantKey(filterKey)
  if (parsed.route.toUpperCase() !== String(eta.route ?? '').toUpperCase()) return false
  const serviceType = String(eta.serviceType ?? eta.service_type ?? '')
  if (parsed.serviceType !== serviceType) return false
  const filterGtfs = parsed.gtfsId.trim()
  const etaGtfs = normalizeGtfsId(eta.gtfsId)
  if (filterGtfs && etaGtfs && filterGtfs !== etaGtfs) return false
  return true
}

/**
 * Legacy family fallback: index entry matching co|route|bound|st regardless
 * of gtfsId, used when the caller has no gtfsId (old saves, hand-built
 * keys). Deterministic: smallest key wins, which is the smallest gtfsId
 * since keys sort by segment. Callers that need region …|1 agree with the
 * region numbering, which also assigns 1 to the smallest gtfsId.
 */
export function findRouteEntryByFamily(
  routeVariantIndex: Map<string, RouteListEntry>,
  family: { co: AppCompany; route: string; bound: string; serviceType: string }
): RouteListEntry | undefined {
  // Old saved links carry kmb|A31 after the LWB split; resolve it to lwb.
  const co = resolveAppCompany(family.co, family.route)
  const prefix = `${co}|${family.route.toUpperCase()}|${family.bound}|${family.serviceType}|`
  let best: { key: string; entry: RouteListEntry } | null = null
  for (const [key, entry] of routeVariantIndex) {
    if (key !== prefix.slice(0, -1) && !key.startsWith(prefix)) continue
    if (!(entry.co as string[]).includes(co)) continue
    if (!best || key < best.key) best = { key, entry }
  }
  return best?.entry
}

export type EtaDbIndexes = {
  kmbRouteListEntries: RouteListEntry[]
  kmbStops: KmbStopSearchItem[]
  kmbRouteStops: KmbRouteStopLite[]
  mtrRoutes: RouteListEntry[]
  lrtRoutes: RouteListEntry[]
  stationToRouteIndex: Map<string, BusRouteCandidate[]>
  /** O(1) lookup for stop sequence (0-indexed) by route variant + stopId. */
  routeStopSeqIndex: Map<string, number>
  /** Consolidated index: stopId → route variants with pre-computed sequences. */
  stopRoutesIndex: Map<string, StopRouteEntry[]>
  /** Route variant key → RouteListEntry for fetching ETAs. */
  routeVariantIndex: Map<string, RouteListEntry>
  /** Family key `co|ROUTE` → (gtfsId → region `co|ROUTE|n`). */
  regionIndex: Map<string, Map<string, string>>
  /** Variant key → region, for display plumbing that only has a key. */
  regionByVariantKey: Map<string, string>
}

export type BuildEtaDbIndexesOptions = {
  busCompanies: AppCompany[]
  /** TD GTFS joint route manifest. Missing means fall back to `co` arrays. */
  jointRoutes?: JointRouteManifest | null
}

export function normalizeBound(bound?: string | null): 'I' | 'O' | string {
  if (!bound) return ''
  return bound === 'I' || bound === 'O' ? bound : bound
}

export function normalizeStopId(stopId: string): string {
  return String(stopId ?? '').trim()
}

export function routeStopSeqKey(params: {
  co: AppCompany
  route: string
  bound: string
  serviceType: string
  stopId: string
  gtfsId?: string
}): string {
  const base = `${params.co}|${params.route.toUpperCase()}|${normalizeBound(params.bound)}|${String(
    params.serviceType ?? ''
  )}`
  const gtfsId = normalizeGtfsId(params.gtfsId)
  const qualified = gtfsId ? `${base}|${gtfsId}` : base
  return `${qualified}|${normalizeStopId(params.stopId)}`
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const CHUNK_SIZE = 500

type StopPoint = { lat: number; lng: number }

type JointStopMeta = {
  operators: string[]
  jointVariantKey: string
  jointGroupKey: string
  siblingStopIds: string[]
}

function approxMeters(a: StopPoint, b: StopPoint): number {
  const dLat = (a.lat - b.lat) * 111320
  const dLng = (a.lng - b.lng) * 101000
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

/** 150 m covers opposite-side carriageway stops without swallowing the next stop. */
const JOINT_STOP_MATCH_RADIUS_M = 150

/**
 * Pair the stop arrays of a jointly operated route entry.
 * The current TD-derived app data has equal-length arrays for every joint
 * entry, so the fast path is a straight index pair. Unequal arrays fall back
 * to nearest unused stop within the match radius.
 */
function buildJointStopMetas(
  entry: RouteListEntry,
  jointVariantKey: string,
  operators: string[],
  stopCoords: Map<string, StopPoint>
): Map<string, JointStopMeta[]> {
  const byCo = new Map<string, JointStopMeta[]>()
  const stopsByCo = new Map<string, string[]>()
  const entryStops = entry.stops as Record<string, string[] | undefined>
  for (const co of operators) {
    const raw = entryStops[co] ?? (co === 'kmb' ? entryStops.lwb : undefined) ?? []
    const stops = raw.map((id) => normalizeStopId(id))
    stopsByCo.set(co, stops)
    byCo.set(
      co,
      stops.map((_, index) => ({
        operators: [co],
        jointVariantKey,
        jointGroupKey: `${jointVariantKey}:${co}:${index}`,
        siblingStopIds: [],
      }))
    )
  }

  const primary = pickPrimaryOperator(
    operators.filter((co) => (stopsByCo.get(co)?.length ?? 0) > 0)
  )
  const primaryStops = stopsByCo.get(primary) ?? []
  if (primaryStops.length === 0) return byCo

  const used = new Map<string, Set<number>>(operators.map((co) => [co, new Set<number>()]))

  for (let index = 0; index < primaryStops.length; index += 1) {
    const primaryStop = primaryStops[index]
    if (!primaryStop) continue
    const primaryPoint = stopCoords.get(primaryStop)
    const group: Array<{ co: string; stopId: string; index: number }> = [
      { co: primary, stopId: primaryStop, index },
    ]
    used.get(primary)?.add(index)

    for (const co of operators) {
      if (co === primary) continue
      const stops = stopsByCo.get(co) ?? []
      if (stops.length === 0) continue
      const usedByCo = used.get(co)
      if (!usedByCo) continue

      let matchIndex = -1
      const sameIndex = stops[index]
      if (sameIndex && !usedByCo.has(index)) {
        const samePoint = stopCoords.get(sameIndex)
        if (
          !primaryPoint ||
          !samePoint ||
          approxMeters(primaryPoint, samePoint) <= JOINT_STOP_MATCH_RADIUS_M
        ) {
          matchIndex = index
        }
      }

      if (matchIndex < 0 && primaryPoint) {
        let bestDistance = Number.POSITIVE_INFINITY
        for (let candidate = 0; candidate < stops.length; candidate += 1) {
          if (usedByCo.has(candidate)) continue
          const stopId = stops[candidate]
          if (!stopId) continue
          const point = stopCoords.get(stopId)
          if (!point) continue
          const distance = approxMeters(primaryPoint, point)
          if (distance <= JOINT_STOP_MATCH_RADIUS_M && distance < bestDistance) {
            bestDistance = distance
            matchIndex = candidate
          }
        }
      }

      if (matchIndex >= 0) {
        const stopId = stops[matchIndex]
        if (stopId) {
          usedByCo.add(matchIndex)
          group.push({ co, stopId, index: matchIndex })
        }
      }
    }

    if (group.length < 2) continue
    const groupOperators = group.map((item) => item.co)
    for (const item of group) {
      const list = byCo.get(item.co)
      if (!list?.[item.index]) continue
      list[item.index] = {
        operators: groupOperators,
        jointVariantKey,
        jointGroupKey: `${jointVariantKey}:${index}`,
        siblingStopIds: group.filter((other) => other.co !== item.co).map((other) => other.stopId),
      }
    }
  }

  return byCo
}

const EMPTY_JOINT_META: Omit<JointStopMeta, 'operators'> = {
  jointVariantKey: '',
  jointGroupKey: '',
  siblingStopIds: [],
}

function jointMetaFor(meta: JointStopMeta | undefined, co: string): JointStopMeta {
  if (meta) return meta
  return { ...EMPTY_JOINT_META, operators: [co] }
}

export async function buildEtaDbIndexes(
  db: EtaDb,
  options: BuildEtaDbIndexesOptions
): Promise<EtaDbIndexes> {
  const { busCompanies, jointRoutes } = options

  const stopCoords = new Map<string, StopPoint>()
  for (const [stopId, stop] of Object.entries(db.stopList)) {
    const id = normalizeStopId(stopId)
    const lat = Number(stop.location?.lat)
    const lng = Number(stop.location?.lng)
    if (id && Number.isFinite(lat) && Number.isFinite(lng)) stopCoords.set(id, { lat, lng })
  }

  const busCompanySet = new Set<AppCompany>(busCompanies)
  const kmbRouteListEntries = Object.values(db.routeList)
    .map((entry) => reclassifyLwbRouteEntry(entry))
    .filter((entry) =>
      entry.co.some(
        (co) =>
          busCompanySet.has(co as AppCompany) && (stopsForCo(entry, co as string)?.length ?? 0) > 0
      )
    )
  const inferredJointRoutes = inferJointRouteNumbers(
    kmbRouteListEntries.map((entry) => ({
      co: entry.co,
      route: entry.route,
      orig: entry.orig,
      dest: entry.dest,
      serviceType: entry.serviceType,
    }))
  )

  const plans = kmbRouteListEntries.map((entry, entryIndex) => {
    const cos = Array.from(new Set(entry.co.map((co) => String(co)))).filter(
      (co) => busCompanySet.has(co as AppCompany) && (stopsForCo(entry, co)?.length ?? 0) > 0
    ) as AppCompany[]
    const jointOperators = resolveJointOperatorsForEntry(jointRoutes, entry.route, cos)
    const joint = jointOperators.length > 1
    const routeUpper = String(entry.route ?? '')
      .trim()
      .toUpperCase()
    const matchCos = cos.map(toJointMatchCo)
    const inferredGroup =
      inferredJointRoutes.has(routeUpper) &&
      matchCos.length > 0 &&
      matchCos.every((co) => co === 'kmb' || co === 'ctb')
        ? `joint|${routeUpper}`
        : ''
    const routeGroupKey = jointRouteGroupKey(jointRoutes, entry.route, matchCos) || inferredGroup
    const jointVariantKey = joint ? jointVariantKeyForEntry(entryIndex) : ''
    const jointMetaByCo = joint
      ? buildJointStopMetas(entry, jointVariantKey, jointOperators, stopCoords)
      : new Map(
          cos.map((co) => [
            co,
            (stopsForCo(entry, co) ?? []).map((_, _index) => ({
              ...EMPTY_JOINT_META,
              operators: [co],
            })),
          ])
        )
    return {
      entry,
      entryIndex,
      cos,
      operators: joint ? jointOperators : cos,
      routeGroupKey,
      joint,
      jointVariantKey,
      jointMetaByCo,
    }
  })

  // Some joint route numbers (101R) arrive as two separate one-operator
  // entries instead of one entry with two stop arrays. Pair those entries
  // by route group, service type and normalized termini so their stops still
  // fan out to both operators. KMB-family matching treats `lwb` as `kmb`
  // so LWB+CTB pairs (S1/R8) still meet, while rows keep actual companies.
  const crossPairCandidates = new Map<string, typeof plans>()
  for (const plan of plans) {
    if (!plan.routeGroupKey || plan.joint || plan.cos.length !== 1) continue
    const matchCo = toJointMatchCo(plan.cos[0] ?? '')
    if (matchCo !== 'kmb' && matchCo !== 'ctb') continue
    const signature = [
      String(plan.entry.orig?.en ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ''),
      String(plan.entry.dest?.en ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ''),
    ]
      .sort()
      .join('|')
    const key = `${plan.routeGroupKey}|${String(plan.entry.serviceType)}|${signature}`
    const list = crossPairCandidates.get(key) ?? []
    list.push(plan)
    crossPairCandidates.set(key, list)
  }

  let crossPairIndex = 0
  for (const list of crossPairCandidates.values()) {
    const kmbPlan = list.find((plan) => toJointMatchCo(plan.cos[0] ?? '') === 'kmb')
    const ctbPlan = list.find((plan) => toJointMatchCo(plan.cos[0] ?? '') === 'ctb')
    if (!kmbPlan || !ctbPlan) continue
    const kmbCo = kmbPlan.cos[0] ?? 'kmb'
    const ctbCo = ctbPlan.cos[0] ?? 'ctb'
    const kmbStops = (stopsForCo(kmbPlan.entry, kmbCo) ?? []).map((id) => normalizeStopId(id))
    const ctbStops = (stopsForCo(ctbPlan.entry, ctbCo) ?? []).map((id) => normalizeStopId(id))
    if (kmbStops.length === 0 || ctbStops.length === 0) continue
    const jointVariantKey = jointCrossPairKey(crossPairIndex)
    crossPairIndex += 1
    const pairOperators = [kmbCo, ctbCo]
    for (const plan of [kmbPlan, ctbPlan]) {
      plan.joint = true
      plan.operators = pairOperators
      plan.jointVariantKey = jointVariantKey
    }
    // Pair stops with the same coordinate guard as same-entry joints:
    // same index only when co-located, else nearest unused stop within
    // the match radius. Pure index pairing attributes the sibling's ETAs
    // to the wrong physical stop on unequal or reordered arrays.
    const usedCtb = new Set<number>()
    let paired = 0
    for (let index = 0; index < kmbStops.length; index += 1) {
      const kmbStop = kmbStops[index]
      if (!kmbStop) continue
      const kmbPoint = stopCoords.get(kmbStop)
      let matchIndex = -1
      const sameStop = ctbStops[index]
      if (sameStop && !usedCtb.has(index)) {
        const samePoint = stopCoords.get(sameStop)
        if (
          !kmbPoint ||
          !samePoint ||
          approxMeters(kmbPoint, samePoint) <= JOINT_STOP_MATCH_RADIUS_M
        ) {
          matchIndex = index
        }
      }
      if (matchIndex < 0 && kmbPoint) {
        let bestDistance = Number.POSITIVE_INFINITY
        for (let candidate = 0; candidate < ctbStops.length; candidate += 1) {
          if (usedCtb.has(candidate)) continue
          const stopId = ctbStops[candidate]
          if (!stopId) continue
          const point = stopCoords.get(stopId)
          if (!point) continue
          const distance = approxMeters(kmbPoint, point)
          if (distance <= JOINT_STOP_MATCH_RADIUS_M && distance < bestDistance) {
            bestDistance = distance
            matchIndex = candidate
          }
        }
      }
      if (matchIndex < 0) continue
      const ctbStop = ctbStops[matchIndex]
      if (!ctbStop) continue
      usedCtb.add(matchIndex)
      const jointGroupKey = `${jointVariantKey}:${paired}`
      paired += 1
      const kmbMeta = kmbPlan.jointMetaByCo.get(kmbCo)
      const ctbMeta = ctbPlan.jointMetaByCo.get(ctbCo)
      if (!kmbMeta || !ctbMeta) continue
      kmbMeta[index] = {
        operators: pairOperators,
        jointVariantKey,
        jointGroupKey,
        siblingStopIds: [ctbStop],
      }
      ctbMeta[matchIndex] = {
        operators: pairOperators,
        jointVariantKey,
        jointGroupKey,
        siblingStopIds: [kmbStop],
      }
    }
  }

  const routeStopSeqIndex = new Map<string, number>()
  const kmbRouteStops: KmbRouteStopLite[] = []
  for (const plan of plans) {
    const { entry, cos, jointMetaByCo } = plan
    for (const co of cos) {
      const stops = stopsForCo(entry, co) ?? []
      const bound = normalizeBound((entry.bound as Record<string, string | undefined>)[co])
      const gtfsId = normalizeGtfsId(entry.gtfsId)
      const metas = jointMetaByCo.get(co) ?? []
      for (let idx = 0; idx < stops.length; idx += 1) {
        const normalizedStopId = normalizeStopId(stops[idx])
        const meta = jointMetaFor(metas[idx], co)
        const seqKey = routeStopSeqKey({
          co,
          route: entry.route,
          bound,
          serviceType: entry.serviceType,
          stopId: normalizedStopId,
          gtfsId,
        })
        if (normalizedStopId && !routeStopSeqIndex.has(seqKey)) {
          routeStopSeqIndex.set(seqKey, idx)
        }
        kmbRouteStops.push({
          co,
          route: entry.route,
          bound,
          serviceType: entry.serviceType,
          seq: idx + 1,
          stopId: normalizedStopId,
          gtfsId,
          region: '',
          operators: meta.operators,
          routeGroupKey: plan.routeGroupKey,
          jointVariantKey: meta.jointVariantKey,
          jointGroupKey: meta.jointGroupKey,
          siblingStopIds: meta.siblingStopIds,
        })
      }
    }
  }

  // Region labels merge gtfsIds that share stops (branches/short workings)
  // and split disjoint ones (same GMB number in different regions).
  const regionsByFamily = computeRouteRegions(kmbRouteStops)

  // Joint variants need one shared region across operators. Take the
  // ordinal from the first operator that has a region and label it
  // `joint|ROUTE|n`, so KMB and CTB rows compare equal without pretending
  // one operator owns the region.
  const jointRegionByVariant = new Map<string, string>()
  for (const plan of plans) {
    if (!plan.joint) continue
    const route = String(plan.entry.route ?? '').toUpperCase()
    // Joint KMB+CTB routes have no cross-region number collisions like
    // minibuses do, so one region keeps every direction and short working
    // in a single search entry.
    jointRegionByVariant.set(plan.jointVariantKey, `joint|${route}|1`)
  }

  for (const row of kmbRouteStops) {
    const jointRegion = row.jointVariantKey
      ? jointRegionByVariant.get(row.jointVariantKey)
      : undefined
    const familyKey = `${row.co}|${String(row.route ?? '').toUpperCase()}`
    row.region =
      jointRegion ?? regionsByFamily.get(familyKey)?.get(normalizeGtfsId(row.gtfsId)) ?? ''
  }

  await yieldToMain()

  const busStopIds = new Set(kmbRouteStops.map((entry) => entry.stopId).filter(Boolean))
  const kmbStops: KmbStopSearchItem[] = Object.entries(db.stopList)
    .map(([stopId, stop]) => ({
      stopId: normalizeStopId(stopId),
      nameEn: (stop.name.en ?? '').trim(),
      nameTc: (stop.name.zh ?? '').trim(),
      nameSc: (stop.name.zh ?? '').trim(),
      lat: stop.location.lat,
      lng: stop.location.lng,
      isKmb: false,
    }))
    .filter((s) => s.stopId && s.nameEn && busStopIds.has(s.stopId))

  await yieldToMain()

  const mtrRoutes = Object.values(db.routeList).filter((entry) => entry.co.includes('mtr'))
  const lrtRoutes = Object.values(db.routeList).filter((entry) => entry.co.includes('lightRail'))

  const stationToRouteIndex = new Map<string, BusRouteCandidate[]>()
  const stationToRouteDedup = new Map<string, Set<string>>()
  const stopRoutesIndex = new Map<string, StopRouteEntry[]>()
  const routeVariantIndex = new Map<string, RouteListEntry>()
  const regionByVariantKey = new Map<string, string>()

  let processed = 0
  for (const plan of plans) {
    const { entry, cos, jointMetaByCo } = plan
    const route = String(entry.route ?? '').toUpperCase()
    for (const co of cos) {
      const stops = stopsForCo(entry, co) ?? []
      const bound = normalizeBound((entry.bound as Record<string, string | undefined>)[co])
      const gtfsId = normalizeGtfsId(entry.gtfsId)
      const familyRegion =
        (plan.joint ? jointRegionByVariant.get(plan.jointVariantKey) : null) ??
        regionsByFamily.get(`${co}|${route}`)?.get(gtfsId) ??
        ''
      const variantKey = routeVariantKey({
        co,
        route: entry.route,
        bound,
        serviceType: entry.serviceType,
        gtfsId,
      })
      if (!routeVariantIndex.has(variantKey)) {
        routeVariantIndex.set(variantKey, entry)
      }
      if (!regionByVariantKey.has(variantKey)) {
        regionByVariantKey.set(variantKey, familyRegion)
      }
      const metas = jointMetaByCo.get(co) ?? []
      for (let idx = 0; idx < stops.length; idx++) {
        const stopId = stops[idx]
        const key = normalizeStopId(stopId)
        if (!key) continue
        const meta = jointMetaFor(metas[idx], co)
        const candidateKey = variantKey
        const seen = stationToRouteDedup.get(key) ?? new Set<string>()
        if (!seen.has(candidateKey)) {
          seen.add(candidateKey)
          stationToRouteDedup.set(key, seen)
          const list = stationToRouteIndex.get(key) ?? []
          list.push({ entry, co })
          stationToRouteIndex.set(key, list)
        }
        const routeList = stopRoutesIndex.get(key) ?? []
        routeList.push({
          stopId: key,
          co,
          route: entry.route,
          bound,
          serviceType: entry.serviceType,
          seq: idx,
          gtfsId,
          region: familyRegion,
          operators: meta.operators,
          routeGroupKey: plan.routeGroupKey,
          jointVariantKey: meta.jointVariantKey,
          jointGroupKey: meta.jointGroupKey,
          siblingStopIds: meta.siblingStopIds,
        })
        stopRoutesIndex.set(key, routeList)
      }
    }
    processed += 1
    if (processed % CHUNK_SIZE === 0) {
      await yieldToMain()
    }
  }

  for (const stop of kmbStops) {
    // LWB shares KMB's stop-name format, so both count as KMB-family here.
    stop.isKmb = (stopRoutesIndex.get(stop.stopId) ?? []).some((e) => isKmbFamily(e.co))
  }

  return {
    kmbRouteListEntries,
    kmbStops,
    kmbRouteStops,
    mtrRoutes,
    lrtRoutes,
    stationToRouteIndex,
    routeStopSeqIndex,
    stopRoutesIndex,
    routeVariantIndex,
    regionIndex: regionsByFamily,
    regionByVariantKey,
  }
}

export type SerializedEtaDbIndexes = {
  kmbRouteListEntries: RouteListEntry[]
  kmbStops: KmbStopSearchItem[]
  kmbRouteStops: KmbRouteStopLite[]
  mtrRoutes: RouteListEntry[]
  lrtRoutes: RouteListEntry[]
  stationToRouteIndex: [string, BusRouteCandidate[]][]
  routeStopSeqIndex: [string, number][]
  stopRoutesIndex: [string, StopRouteEntry[]][]
  routeVariantIndex: [string, RouteListEntry][]
  regionIndex: [string, [string, string][]][]
  regionByVariantKey: [string, string][]
}

export function serializeEtaDbIndexes(indexes: EtaDbIndexes): SerializedEtaDbIndexes {
  return {
    kmbRouteListEntries: indexes.kmbRouteListEntries,
    kmbStops: indexes.kmbStops,
    kmbRouteStops: indexes.kmbRouteStops,
    mtrRoutes: indexes.mtrRoutes,
    lrtRoutes: indexes.lrtRoutes,
    stationToRouteIndex: Array.from(indexes.stationToRouteIndex.entries()),
    routeStopSeqIndex: Array.from(indexes.routeStopSeqIndex.entries()),
    stopRoutesIndex: Array.from(indexes.stopRoutesIndex.entries()),
    routeVariantIndex: Array.from(indexes.routeVariantIndex.entries()),
    regionIndex: Array.from(indexes.regionIndex.entries()).map(([family, byGtfs]) => [
      family,
      Array.from(byGtfs.entries()),
    ]),
    regionByVariantKey: Array.from(indexes.regionByVariantKey.entries()),
  }
}

export function deserializeEtaDbIndexes(serialized: SerializedEtaDbIndexes): EtaDbIndexes {
  return {
    kmbRouteListEntries: serialized.kmbRouteListEntries,
    kmbStops: serialized.kmbStops,
    kmbRouteStops: serialized.kmbRouteStops,
    mtrRoutes: serialized.mtrRoutes,
    lrtRoutes: serialized.lrtRoutes,
    stationToRouteIndex: new Map(serialized.stationToRouteIndex),
    routeStopSeqIndex: new Map(serialized.routeStopSeqIndex),
    stopRoutesIndex: new Map(serialized.stopRoutesIndex),
    routeVariantIndex: new Map(serialized.routeVariantIndex),
    regionIndex: new Map(
      (serialized.regionIndex ?? []).map(([family, byGtfs]) => [family, new Map(byGtfs)])
    ),
    regionByVariantKey: new Map(serialized.regionByVariantKey ?? []),
  }
}

/**
 * Region for an exact (co, route, gtfsId) from a built index. Empty when
 * the family or gtfsId is unknown (legacy data).
 */
export function lookupRegion(
  indexes: Pick<EtaDbIndexes, 'regionIndex'>,
  family: { co: string; route: string; gtfsId: string }
): string {
  const co = String(family.co ?? '')
  const route = String(family.route ?? '').toUpperCase()
  if (!co || !route) return ''
  return indexes.regionIndex.get(`${co}|${route}`)?.get(normalizeGtfsId(family.gtfsId)) ?? ''
}
