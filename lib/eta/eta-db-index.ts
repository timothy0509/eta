import type { Company, EtaDb, RouteListEntry } from 'hk-bus-eta'

import type { KmbStopSearchItem } from '@/lib/eta/types'

export type { KmbStopSearchItem }

export type KmbRouteStopLite = {
  co: Company
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
   * Kowloon vs NT minibus routes). Empty when unknown (legacy). */
  region: string
}

export type KmbRouteInfoLite = {
  co: Company
  route: string
  bound: 'I' | 'O' | string
  serviceType: string
  gtfsId: string
  /** Region group within (co, route), matching KmbRouteStopLite.region. */
  region: string
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
  co: Company
}

export type StopRouteEntry = {
  stopId: string
  co: Company
  route: string
  bound: string
  serviceType: string
  seq: number
  gtfsId: string
  region: string
}

export type RouteVariantKey = {
  co: Company
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
  prefix: { co: Company; route: string }
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
  routeStops: Array<{ co: Company; route: string; stopId: string; gtfsId: string }>
): Map<string, Map<string, string>> {
  const stopsByFamily = new Map<string, Map<string, Set<string>>>()
  const coRouteByFamily = new Map<string, { co: Company; route: string }>()
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
  return `${k.co}|${k.route.toUpperCase()}|${k.bound}|${k.serviceType}|${normalizeGtfsId(k.gtfsId)}`
}

export type ParsedVariantKey = {
  co: string
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
    return { co: 'kmb', route, bound, serviceType, gtfsId: '' }
  }
  if (parts.length === 6) {
    const [co = 'kmb', route = '', bound = '', serviceType = '', gtfsId = ''] = parts
    return { co, route, bound, serviceType, gtfsId: gtfsId ?? '' }
  }
  const [co = 'kmb', route = '', bound = '', serviceType = '', gtfsId = ''] = parts
  return { co, route, bound, serviceType, gtfsId: gtfsId ?? '' }
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
    return entryKey === filter || entryKey.startsWith(`${filter}|`)
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
 * Legacy family fallback: index entry matching co|route|bound|st regardless
 * of gtfsId, used when the caller has no gtfsId (old saves, hand-built
 * keys). Deterministic: smallest key wins, which is the smallest gtfsId
 * since keys sort by segment. Callers that need region …|1 agree with the
 * region numbering, which also assigns 1 to the smallest gtfsId.
 */
export function findRouteEntryByFamily(
  routeVariantIndex: Map<string, RouteListEntry>,
  family: { co: Company; route: string; bound: string; serviceType: string }
): RouteListEntry | undefined {
  const prefix = `${family.co}|${family.route.toUpperCase()}|${family.bound}|${family.serviceType}|`
  let best: { key: string; entry: RouteListEntry } | null = null
  for (const [key, entry] of routeVariantIndex) {
    if (key !== prefix.slice(0, -1) && !key.startsWith(prefix)) continue
    if (!entry.co.includes(family.co)) continue
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
  busCompanies: Company[]
}

export function normalizeBound(bound?: string | null): 'I' | 'O' | string {
  if (!bound) return ''
  return bound === 'I' || bound === 'O' ? bound : bound
}

export function normalizeStopId(stopId: string): string {
  return String(stopId ?? '').trim()
}

export function routeStopSeqKey(params: {
  co: Company
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

export async function buildEtaDbIndexes(
  db: EtaDb,
  options: BuildEtaDbIndexesOptions
): Promise<EtaDbIndexes> {
  const { busCompanies } = options

  const kmbRouteListEntries = Object.values(db.routeList).filter((entry) =>
    entry.co.some((co) => busCompanies.includes(co) && entry.stops[co]?.length)
  )

  const routeStopSeqIndex = new Map<string, number>()
  const kmbRouteStops: KmbRouteStopLite[] = kmbRouteListEntries.flatMap((entry) =>
    entry.co
      .filter((co) => busCompanies.includes(co))
      .flatMap((co) => {
        const stops = entry.stops[co] ?? []
        const bound = normalizeBound(entry.bound[co])
        const gtfsId = normalizeGtfsId(entry.gtfsId)
        return stops.map((stopId, idx) => {
          const normalizedStopId = normalizeStopId(stopId)
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
          return {
            co,
            route: entry.route,
            bound,
            serviceType: entry.serviceType,
            seq: idx + 1,
            stopId: normalizedStopId,
            gtfsId,
            region: '',
          }
        })
      })
  )

  // Region labels merge gtfsIds that share stops (branches/short workings)
  // and split disjoint ones (same GMB number in different regions).
  const regionsByFamily = computeRouteRegions(kmbRouteStops)
  for (const row of kmbRouteStops) {
    const familyKey = `${row.co}|${String(row.route ?? '').toUpperCase()}`
    row.region = regionsByFamily.get(familyKey)?.get(normalizeGtfsId(row.gtfsId)) ?? ''
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
  for (const entry of kmbRouteListEntries) {
    for (const co of entry.co) {
      if (!busCompanies.includes(co)) continue
      const stops = entry.stops[co] ?? []
      const bound = normalizeBound(entry.bound[co])
      const gtfsId = normalizeGtfsId(entry.gtfsId)
      const familyRegion =
        regionsByFamily.get(`${co}|${String(entry.route ?? '').toUpperCase()}`)?.get(gtfsId) ?? ''
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
      for (let idx = 0; idx < stops.length; idx++) {
        const stopId = stops[idx]
        const key = normalizeStopId(stopId)
        if (!key) continue
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
    stop.isKmb = (stopRoutesIndex.get(stop.stopId) ?? []).some((e) => e.co === 'kmb')
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
