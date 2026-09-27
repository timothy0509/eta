import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'
import type { UiLanguage } from '@/lib/eta/types'

/** Ordinal label for the nth departure: 1st/2nd/3rd or 第N班. */
export function formatEtaOrdinals(seq: number, lang: UiLanguage): string {
  if (lang === 'en') {
    if (seq === 1) return '1st'
    if (seq === 2) return '2nd'
    if (seq === 3) return '3rd'
    return `${seq}th`
  }
  return `第${seq}班`
}

export type EtaGroup = {
  key: string
  baseKey: string
  items: KmbEtaEntryWithLeg[]
  hasEta: boolean
  hasFare: boolean
  isArrivingLeg: boolean
  /** Distinct normalized operators in this merged group. */
  operators: string[]
}

export type PrecomputedGroups = {
  byStopId: Record<string, EtaGroup[]>
  flat: EtaGroup[]
}

function hasValidEta(items: KmbEtaEntryWithLeg[]): boolean {
  for (const entry of items) {
    if (!entry.eta) continue
    const t = Date.parse(entry.eta)
    if (!Number.isNaN(t)) return true
  }
  return false
}

function etaTimeMs(entry: KmbEtaEntryWithLeg): number | null {
  if (!entry.eta) return null
  const t = Date.parse(entry.eta)
  return Number.isNaN(t) ? null : t
}

/** Joint-route key: route plus dir plus service type plus leg, ignoring operator. */
export function buildDefaultKey(entry: KmbEtaEntryWithLeg): string {
  const route = (entry.route ?? '').toUpperCase()
  const dir = String(entry.dir ?? '')
  const serviceType = String(entry.service_type ?? '')
  const legSuffix = entry.leg ?? '_'
  return `${route}|${dir}|${serviceType}|${legSuffix}`
}

/** Legacy per-operator key, kept for migration tests and compat lookups. */
export function buildLegacyKey(entry: KmbEtaEntryWithLeg): string {
  const co = String(entry.co ?? 'kmb')
  return `${co}|${buildDefaultKey(entry)}`
}

export type GroupEtasOptions = {
  /** Canonical bound per legacy `co|route|bound|st`, so opposite KMB/CTB letters merge. */
  routeVariantIndex?: Map<string, { bound: Record<string, string> }>
  /** Canonical physical-stop id per stop id, for multi-stop group keys. */
  stopEquivalents?: Map<string, string>
}

function canonicalEntryBound(
  routeVariantIndex: Map<string, { bound: Record<string, string> }> | undefined,
  entry: KmbEtaEntryWithLeg
): string {
  const raw = String(entry.dir ?? '')
  const co = String(entry.co ?? 'kmb')
  if (!routeVariantIndex || !co) return raw
  const legacyKey = `${co}|${(entry.route ?? '').toUpperCase()}|${raw}|${String(entry.service_type ?? '')}`
  const dbEntry = routeVariantIndex.get(legacyKey)
  if (!dbEntry) return raw
  const ops = Object.keys(dbEntry.bound ?? {})
  const preferred = ops.includes('kmb') ? 'kmb' : [...ops].sort()[0]
  if (!preferred) return raw
  return String(dbEntry.bound[preferred] ?? raw)
}

export function defaultMergedKey(entry: KmbEtaEntryWithLeg, options?: GroupEtasOptions): string {
  const bound = canonicalEntryBound(options?.routeVariantIndex, entry)
  return `${(entry.route ?? '').toUpperCase()}|${bound}|${String(entry.service_type ?? '')}|${entry.leg ?? '_'}`
}

export function groupEtasByVariant(
  eta: KmbEtaEntryWithLeg[],
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>,
  buildKey?: (entry: KmbEtaEntryWithLeg) => string,
  options?: GroupEtasOptions
): EtaGroup[] {
  const keyFor = buildKey ?? ((entry: KmbEtaEntryWithLeg) => defaultMergedKey(entry, options))
  const byVariant = new Map<string, KmbEtaEntryWithLeg[]>()
  for (const entry of eta) {
    const key = keyFor(entry)

    const items = byVariant.get(key) ?? []
    items.push(entry)
    byVariant.set(key, items)
  }

  const groups = Array.from(byVariant.entries()).map(([key, items]) => {
    // Both operators restart eta_seq at 1, so merged groups sort by time.
    const sorted = [...items]
      .sort((a, b) => {
        const ta = etaTimeMs(a)
        const tb = etaTimeMs(b)
        if (ta !== null && tb !== null && ta !== tb) return ta - tb
        if (ta !== null && tb === null) return -1
        if (ta === null && tb !== null) return 1
        return (a.eta_seq ?? 0) - (b.eta_seq ?? 0)
      })
      .slice(0, 3)
    const hasEta = hasValidEta(sorted)

    const parts = key.split('|')
    const baseKey = parts.slice(0, 3).join('|')
    const legPart = parts[3]
    const isArrivingLeg = legPart === 'B'

    const hasFare = !isArrivingLeg
    const operators = Array.from(
      new Set(
        sorted
          .map((entry) =>
            String(entry.co ?? 'kmb')
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      )
    ).sort()

    return { key, baseKey, items: sorted, hasEta, hasFare, isArrivingLeg, operators }
  })

  // Single-pass partition + extract route for sort to avoid repeated split+filter
  const withEtaAndFare: EtaGroup[] = []
  const withEtaOnly: EtaGroup[] = []
  const withoutEtas: EtaGroup[] = []

  for (const g of groups) {
    if (!g.hasEta) {
      withoutEtas.push(g)
    } else if (g.hasFare && faresByVariantKey[g.baseKey]) {
      withEtaAndFare.push(g)
    } else {
      withEtaOnly.push(g)
    }
  }

  const routeOf = (g: EtaGroup) => g.key.split('|', 1)[0] ?? ''
  const sortByRoute = (a: EtaGroup, b: EtaGroup) =>
    routeOf(a).localeCompare(routeOf(b), undefined, { numeric: true })

  withEtaAndFare.sort(sortByRoute)
  withEtaOnly.sort(sortByRoute)
  withoutEtas.sort(sortByRoute)

  return [...withEtaAndFare, ...withEtaOnly, ...withoutEtas]
}

export function precomputeRenderGroups(
  etaByStopId: Record<string, KmbEtaEntryWithLeg[]>,
  loadedStopIds: string[],
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>,
  options?: GroupEtasOptions
): PrecomputedGroups {
  const byStopId: Record<string, EtaGroup[]> = {}
  for (const stopId of loadedStopIds) {
    const eta = etaByStopId[stopId] ?? []
    byStopId[stopId] = groupEtasByVariant(eta, faresByVariantKey, undefined, options)
  }

  const allEtas = loadedStopIds.flatMap((stopId) => etaByStopId[stopId] ?? [])
  const flat = groupEtasByVariant(allEtas, faresByVariantKey, undefined, options)

  return { byStopId, flat }
}
