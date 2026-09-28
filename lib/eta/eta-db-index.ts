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
}

export type KmbRouteInfoLite = {
  co: Company
  route: string
  bound: 'I' | 'O' | string
  serviceType: string
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
  /** All operators serving this merged variant, sorted. Present once listKmbRoutes merges. */
  operators?: Company[]
  /** Per-operator origin/destination for the joint-route naming rule. */
  namesByOperator?: Record<
    string,
    {
      origin: { en: string; tc: string; sc: string }
      destination: { en: string; tc: string; sc: string }
    }
  >
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
  /** Normalized to String() at index build: raw db rows mix number and string. */
  serviceType: string
  seq: number
}

export type RouteVariantKey = {
  co: Company
  route: string
  bound: string
  serviceType: string
}

export function routeVariantKey(k: RouteVariantKey): string {
  return `${k.co}|${k.route.toUpperCase()}|${k.bound}|${k.serviceType}`
}

export type MergedRouteVariantKey = {
  route: string
  bound: string
  serviceType: string
}

/** Joint-route identity: route plus bound plus service type, ignoring operator. */
export function mergedRouteVariantKey(k: MergedRouteVariantKey): string {
  return `${k.route.toUpperCase()}|${normalizeBound(k.bound)}|${String(k.serviceType ?? '')}`
}

export type ParsedRouteVariantKey = {
  co?: string
  route: string
  bound: string
  serviceType: string
}

/** Parse both legacy `co|route|bound|st` and merged `route|bound|st` keys. */
export function parseRouteVariantKey(key: string): ParsedRouteVariantKey | null {
  const parts = String(key ?? '').split('|')
  if (parts.length === 4) {
    const [co = '', route = '', bound = '', serviceType = ''] = parts
    if (!route) return null
    return { co, route: route.toUpperCase(), bound: normalizeBound(bound), serviceType }
  }
  if (parts.length === 3) {
    const [route = '', bound = '', serviceType = ''] = parts
    if (!route) return null
    return { route: route.toUpperCase(), bound: normalizeBound(bound), serviceType }
  }
  return null
}

/** Strip the operator prefix from a legacy key, pass merged keys through. */
export function toMergedKey(key: string): string {
  const parsed = parseRouteVariantKey(key)
  if (!parsed) return key
  return mergedRouteVariantKey({
    route: parsed.route,
    bound: parsed.bound,
    serviceType: parsed.serviceType,
  })
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
  /**
   * Physical-stop equivalence: stopId → canonical stopId. Built from mutual
   * stopMap pairs (A lists B and B lists A), preferring the KMB id as
   * canonical. KMB and CTB use different stop ids for the same boarding
   * point, so joint-route merging must go through this map.
   */
  stopEquivalents: Map<string, string>
  /** Joint-route entries merged across raw rows and operators. */
  mergedDbEntries: MergedDbEntry[]
  /** Merged variant key → joint-route entry. */
  mergedVariantIndex: Map<string, MergedDbEntry>
}

/**
 * Canonical bound letter for a variant: the KMB letter when KMB serves the
 * entry, else the first sorted operator's letter. KMB and CTB use opposite
 * letters on some joint routes (101: ctb O = kmb I) and identical letters on
 * others (N121), so raw letters can never be compared across operators.
 * Returns the raw letter when the entry is unknown.
 */
export function canonicalVariantBound(
  routeVariantIndex: Map<string, RouteListEntry>,
  params: { co: string; route: string; bound: string; serviceType: string }
): string {
  const raw = normalizeBound(params.bound)
  const co = String(params.co ?? 'kmb') as Company
  const route = String(params.route ?? '').toUpperCase()
  const serviceType = String(params.serviceType ?? '')
  const entry = routeVariantIndex.get(routeVariantKey({ co, route, bound: raw, serviceType }))
  if (!entry) return raw
  const ops = entry.co.filter((c) => entry.stops[c]?.length)
  const preferred = ops.includes('kmb') ? 'kmb' : [...ops].sort()[0]
  if (!preferred) return raw
  return normalizeBound(entry.bound[preferred] ?? raw)
}

/** Legacy `co|route|bound|st` (canonicalizing the letter) or merged keys to merged form. */
export function toCanonicalMergedKey(
  routeVariantIndex: Map<string, RouteListEntry> | undefined,
  key: string
): string {
  const parsed = parseRouteVariantKey(key)
  if (!parsed) return key
  const bound =
    parsed.co && routeVariantIndex
      ? canonicalVariantBound(routeVariantIndex, {
          co: parsed.co,
          route: parsed.route,
          bound: parsed.bound,
          serviceType: parsed.serviceType,
        })
      : parsed.bound
  return mergedRouteVariantKey({ route: parsed.route, bound, serviceType: parsed.serviceType })
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
}): string {
  return `${params.co}|${params.route.toUpperCase()}|${normalizeBound(params.bound)}|${String(
    params.serviceType ?? ''
  )}|${normalizeStopId(params.stopId)}`
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const CHUNK_SIZE = 500

/** Structural bound map, so fare helpers accept merged entries without importing hk-bus-eta. */
export type RouteListEntryLike = {
  bound: Record<string, string>
  stops: Record<string, string[]>
}

export type MergedDbEntry = {
  entry: RouteListEntry
  /** Operators with stops, sorted. */
  operators: Company[]
  /** Canonical bound letter (KMB letter when KMB serves the entry). */
  bound: 'I' | 'O' | string
  /** stopId → canonical stopId for cross-operator stop union. */
  stopCanonById: Map<string, string>
  /** Canonical stop ids in display order: KMB seq, then CTB-only extras. */
  orderedStops: string[]
  /** First id per canonical stop, for seq/leg lookups. */
  representativeByCanon: Map<string, string>
}

/**
 * Merge raw routeList rows into joint-route entries. Rows sharing route plus
 * service type plus the same physical termini merge; a short-working row with
 * different termini stays separate. KMB and CTB disagree on origin/dest
 * strings for the same termini, so termini compare by stop-id equality only.
 */
export function mergeRouteListEntries(
  routeListEntries: RouteListEntry[],
  busCompanies: Company[],
  stopEquivalents: Map<string, string>
): MergedDbEntry[] {
  const canonStop = (id: string) => stopEquivalents.get(normalizeStopId(id)) ?? normalizeStopId(id)
  const inScope = (entry: RouteListEntry) =>
    entry.co.filter((co) => busCompanies.includes(co) && entry.stops[co]?.length)
  const preferredOp = (ops: Company[]): Company =>
    ops.includes('kmb' as Company) ? ('kmb' as Company) : [...ops].sort()[0]!

  // Group by route + service type first; termini decide the final merge.
  const byRouteSt = new Map<string, RouteListEntry[]>()
  for (const entry of routeListEntries) {
    if (!inScope(entry).length) continue
    const key = `${String(entry.route ?? '').toUpperCase()}|${String(entry.serviceType ?? '')}`
    const list = byRouteSt.get(key) ?? []
    list.push(entry)
    byRouteSt.set(key, list)
  }

  const merged: MergedDbEntry[] = []
  for (const group of byRouteSt.values()) {
    // Rows whose termini differ (e.g. short workings) must not merge. KMB
    // and CTB disagree on terminus strings for the same termini and keep
    // per-operator stop ids, so compare canonical first/last stops per
    // operator: entry A joins a bucket when every operator they share has
    // equal canonical termini. Full-sequence compares fail on real joint
    // routes since each operator lists slightly different intermediate
    // stops for the same road.
    const terminiByOp = (entry: RouteListEntry): Map<string, [string, string]> => {
      const out = new Map<string, [string, string]>()
      for (const co of inScope(entry)) {
        const stops = entry.stops[co] ?? []
        out.set(co, [canonStop(stops[0] ?? ''), canonStop(stops[stops.length - 1] ?? '')])
      }
      return out
    }
    const buckets: Array<{ termini: Map<string, [string, string]>; entries: RouteListEntry[] }> = []
    for (const entry of group) {
      const termini = terminiByOp(entry)
      const bucket = buckets.find((b) => {
        let shared = 0
        for (const [co, [first, last]] of termini) {
          const other = b.termini.get(co)
          if (!other) continue
          shared += 1
          if (other[0] !== first || other[1] !== last) return false
        }
        // Same raw row key shape always shares co; different termini rows
        // share none and stay separate unless another row bridges them.
        return shared > 0 || b.entries.includes(entry)
      })
      if (bucket) {
        bucket.entries.push(entry)
        for (const [co, pair] of termini) {
          if (!bucket.termini.has(co)) bucket.termini.set(co, pair)
        }
      } else buckets.push({ termini, entries: [entry] })
    }
    for (const bucket of buckets) {
      const operators = Array.from(
        new Set(bucket.entries.flatMap((entry) => inScope(entry)))
      ).sort() as Company[]
      const primaryEntry =
        bucket.entries.find((entry) => inScope(entry).includes('kmb' as Company)) ??
        bucket.entries[0]!
      const preferred = preferredOp(operators)
      const bound = normalizeBound(primaryEntry.bound[preferred] ?? preferred)
      // Display order follows the preferred operator's own sequence, so
      // names, coords, and seq all come from one consistent id space. The
      // representative id is always the preferred operator's own stop id;
      // other operators' ids map onto it through the canonical map.
      const seen = new Set<string>()
      const orderedStops: string[] = []
      const representativeByCanon = new Map<string, string>()
      const preferredIds = new Map<string, string>()
      for (const entry of bucket.entries) {
        for (const id of entry.stops[preferred] ?? []) {
          const canon = canonStop(id)
          if (!preferredIds.has(canon)) preferredIds.set(canon, id)
        }
      }
      for (const entry of bucket.entries) {
        for (const id of entry.stops[preferred] ?? []) {
          const canon = canonStop(id)
          if (seen.has(canon)) continue
          seen.add(canon)
          orderedStops.push(canon)
          representativeByCanon.set(canon, id)
        }
      }
      // Operator-only canonical stops (e.g. a termini tail the preferred
      // operator does not serve) append after, represented by their own id.
      for (const co of operators.filter((op) => op !== preferred)) {
        for (const entry of bucket.entries) {
          for (const id of entry.stops[co] ?? []) {
            const canon = canonStop(id)
            if (seen.has(canon)) continue
            seen.add(canon)
            orderedStops.push(canon)
            representativeByCanon.set(canon, id)
          }
        }
      }
      const stopCanonById = new Map<string, string>()
      for (const entry of bucket.entries) {
        for (const co of inScope(entry)) {
          for (const id of entry.stops[co] ?? []) {
            stopCanonById.set(normalizeStopId(id), canonStop(id))
          }
        }
      }
      merged.push({
        entry: primaryEntry,
        operators,
        bound,
        stopCanonById,
        orderedStops,
        representativeByCanon,
      })
    }
  }
  return merged
}

export async function buildEtaDbIndexes(
  db: EtaDb,
  options: BuildEtaDbIndexesOptions
): Promise<EtaDbIndexes> {
  const { busCompanies } = options

  const stopEquivalents = buildStopEquivalents(db)

  const kmbRouteListEntries = Object.values(db.routeList).filter((entry) =>
    entry.co.some((co) => busCompanies.includes(co) && entry.stops[co]?.length)
  )
  const mergedDbEntries = mergeRouteListEntries(
    Object.values(db.routeList),
    busCompanies,
    stopEquivalents
  )

  const routeStopSeqIndex = new Map<string, number>()
  // Per-operator rows with RAW letters: the fetch, fare, and leg layers all
  // resolve per co, so their lookups must keep working untouched. serviceType
  // normalizes to String since raw rows mix number and string forms.
  const kmbRouteStops: KmbRouteStopLite[] = kmbRouteListEntries.flatMap((entry) =>
    entry.co
      .filter((co) => busCompanies.includes(co))
      .flatMap((co) => {
        const stops = entry.stops[co] ?? []
        const bound = normalizeBound(entry.bound[co])
        const serviceType = String(entry.serviceType ?? '')
        return stops.map((stopId, idx) => {
          const normalizedStopId = normalizeStopId(stopId)
          const seqKey = routeStopSeqKey({
            co,
            route: entry.route,
            bound,
            serviceType,
            stopId: normalizedStopId,
          })
          if (normalizedStopId && !routeStopSeqIndex.has(seqKey)) {
            routeStopSeqIndex.set(seqKey, idx)
          }
          return {
            co,
            route: entry.route,
            bound,
            serviceType,
            seq: idx + 1,
            stopId: normalizedStopId,
          }
        })
      })
  )
  const mergedVariantIndex = new Map<string, MergedDbEntry>()
  for (const merged of mergedDbEntries) {
    const key = mergedRouteVariantKey({
      route: merged.entry.route,
      bound: merged.bound,
      serviceType: merged.entry.serviceType,
    })
    if (!mergedVariantIndex.has(key)) mergedVariantIndex.set(key, merged)
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

  let processed = 0
  for (const entry of kmbRouteListEntries) {
    for (const co of entry.co) {
      if (!busCompanies.includes(co)) continue
      const stops = entry.stops[co] ?? []
      const bound = normalizeBound(entry.bound[co])
      const variantKey = routeVariantKey({
        co,
        route: entry.route,
        bound,
        serviceType: entry.serviceType,
      })
      if (!routeVariantIndex.has(variantKey)) {
        routeVariantIndex.set(variantKey, entry)
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
          serviceType: String(entry.serviceType ?? ''),
          seq: idx,
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
    stopEquivalents,
    mergedDbEntries,
    mergedVariantIndex,
  }
}

/**
 * Mutual stopMap pairs (A lists B and B lists A) mean one physical boarding
 * point with two ids. Canonical id prefers KMB ids, else first sorted.
 */
export function buildStopEquivalents(db: EtaDb): Map<string, string> {
  const stopMap = (db.stopMap ?? {}) as Record<string, Array<[string, string]>>
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    const p = parent.get(id) ?? id
    if (p === id) return id
    const root = find(p)
    parent.set(id, root)
    return root
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const [id, tuples] of Object.entries(stopMap)) {
    const normId = normalizeStopId(id)
    if (!normId) continue
    for (const tuple of tuples ?? []) {
      const other = normalizeStopId(tuple?.[1] ?? '')
      if (!other || other === normId) continue
      const back = stopMap[tuple?.[1] ?? ''] ?? stopMap[other] ?? []
      const mutual = (back ?? []).some(([, backId]) => normalizeStopId(backId ?? '') === normId)
      if (mutual) union(normId, other)
    }
  }
  const groups = new Map<string, string[]>()
  for (const id of parent.keys()) {
    const root = find(id)
    const list = groups.get(root) ?? []
    list.push(id)
    groups.set(root, list)
  }
  // KMB stop ids appear in kmb stops arrays; prefer one as canonical.
  const kmbStopIds = new Set<string>()
  for (const entry of Object.values((db as EtaDb).routeList ?? {})) {
    for (const id of (entry.stops as Record<string, string[]>).kmb ?? []) {
      const norm = normalizeStopId(id)
      if (norm) kmbStopIds.add(norm)
    }
  }
  const equivalents = new Map<string, string>()
  for (const list of groups.values()) {
    const kmbIds = list.filter((id) => kmbStopIds.has(id))
    const canonical = [...(kmbIds.length ? kmbIds : list)].sort()[0] ?? list[0]
    if (!canonical) continue
    for (const id of list) equivalents.set(id, canonical)
  }
  return equivalents
}

/** Canonical physical-stop id for display union, defaults to the id itself. */
export function canonicalStopId(
  stopEquivalents: Map<string, string> | undefined,
  stopId: string
): string {
  const norm = normalizeStopId(stopId)
  return stopEquivalents?.get(norm) ?? norm
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
  stopEquivalents: [string, string][]
}

function serializeMergedEntry(merged: MergedDbEntry): SerializedMergedDbEntry {
  return {
    entry: merged.entry,
    operators: merged.operators,
    bound: merged.bound,
    stopCanonById: Array.from(merged.stopCanonById.entries()),
    orderedStops: merged.orderedStops,
    representativeByCanon: Array.from(merged.representativeByCanon.entries()),
  }
}

function deserializeMergedEntry(serialized: SerializedMergedDbEntry): MergedDbEntry {
  return {
    entry: serialized.entry,
    operators: serialized.operators,
    bound: serialized.bound,
    stopCanonById: new Map(serialized.stopCanonById),
    orderedStops: serialized.orderedStops,
    representativeByCanon: new Map(serialized.representativeByCanon),
  }
}

export type SerializedMergedDbEntry = {
  entry: RouteListEntry
  operators: Company[]
  bound: 'I' | 'O' | string
  stopCanonById: [string, string][]
  orderedStops: string[]
  representativeByCanon: [string, string][]
}

export function serializeEtaDbIndexes(
  indexes: EtaDbIndexes
): SerializedEtaDbIndexes & { mergedDbEntries: SerializedMergedDbEntry[] } {
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
    stopEquivalents: Array.from(indexes.stopEquivalents.entries()),
    mergedDbEntries: indexes.mergedDbEntries.map(serializeMergedEntry),
  }
}

export function deserializeEtaDbIndexes(
  serialized: SerializedEtaDbIndexes & { mergedDbEntries?: SerializedMergedDbEntry[] }
): EtaDbIndexes {
  const mergedDbEntries = (serialized.mergedDbEntries ?? []).map(deserializeMergedEntry)
  const mergedVariantIndex = new Map<string, MergedDbEntry>()
  for (const merged of mergedDbEntries) {
    const key = mergedRouteVariantKey({
      route: merged.entry.route,
      bound: merged.bound,
      serviceType: merged.entry.serviceType,
    })
    if (!mergedVariantIndex.has(key)) mergedVariantIndex.set(key, merged)
  }
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
    stopEquivalents: new Map(serialized.stopEquivalents ?? []),
    mergedDbEntries,
    mergedVariantIndex,
  }
}
