import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'

export type FareByVariantKey = Record<
  string,
  { hkd: number; dayCode?: number; source: 'hk-bus-eta' }
>

export type EtaGroup = {
  key: string
  /** Base variant key without leg suffix (co|route|dir|service_type) for fare lookup */
  baseKey: string
  items: KmbEtaEntryWithLeg[]
  hasEta: boolean
  /** Whether this group should display a fare badge (true for non-arriving legs) */
  hasFare: boolean
  /** Whether this is the "arriving/returning" leg (leg B) - should show origin instead of destination */
  isArrivingLeg: boolean
}

export type PrecomputedGroups = {
  /** Groups by stop ID for sectioned rendering */
  byStopId: Record<string, EtaGroup[]>
  /** Flat groups for legacy rendering (non-keyphrase mode) */
  flat: EtaGroup[]
}

type GroupOptions = {
  /** Include stopId in the key to avoid merging across stops */
  includeStopIdInKey?: boolean
}

function hasValidEta(items: KmbEtaEntryWithLeg[]): boolean {
  return items.some((entry) => entry.eta && !isNaN(Date.parse(entry.eta)))
}

export function groupEtasByVariant(
  eta: KmbEtaEntryWithLeg[],
  faresByVariantKey?: FareByVariantKey,
  options?: GroupOptions
): EtaGroup[] {
  const includeStopId = Boolean(options?.includeStopIdInKey)
  const byVariant = new Map<string, KmbEtaEntryWithLeg[]>()

  for (const entry of eta) {
    const co = String(entry.co ?? 'kmb')
    const route = (entry.route ?? '').toUpperCase()
    const dir = String(entry.dir ?? '')
    const serviceType = String(entry.service_type ?? '')
    // Include leg in key to separate departing/arriving ETAs for circular routes
    const legSuffix = entry.leg ?? '_'
    const baseKey = `${co}|${route}|${dir}|${serviceType}`
    const stopSuffix = includeStopId ? `|${String(entry.stop ?? '').trim()}` : ''
    const key = `${baseKey}|${legSuffix}${stopSuffix}`

    const items = byVariant.get(key) ?? []
    items.push(entry)
    byVariant.set(key, items)
  }

  const groups = Array.from(byVariant.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) => a.eta_seq - b.eta_seq)
    const parts = key.split('|')
    const baseKey = parts.slice(0, 4).join('|')
    const legPart = parts[4]
    const isArrivingLeg = legPart === 'B'

    // hasFare = should show fare badge (true for non-arriving legs)
    // The actual fare may or may not be loaded yet (deferred loading)
    const hasFare = !isArrivingLeg

    return {
      key,
      baseKey,
      items: sorted,
      hasEta: hasValidEta(sorted),
      hasFare,
      isArrivingLeg,
    }
  })

  // Sort with 3-tier ordering:
  // 1) ETA + fare loaded (hasEta && hasFare && fare exists in faresByVariantKey)
  // 2) ETA only (hasEta && (!hasFare || fare not loaded))
  // 3) No ETA
  // Within each tier, sort alphabetically by route number
  const sortByRoute = (a: { key: string }, b: { key: string }) => {
    const [, routeA = ''] = a.key.split('|')
    const [, routeB = ''] = b.key.split('|')
    return routeA.localeCompare(routeB, undefined, { numeric: true })
  }

  const hasFareLoaded = (g: EtaGroup) => g.hasFare && Boolean(faresByVariantKey?.[g.baseKey])

  // Tier 1: ETA + fare loaded
  const withEtaAndFare = groups.filter((g) => g.hasEta && hasFareLoaded(g)).sort(sortByRoute)
  // Tier 2: ETA only (no fare or fare not loaded yet)
  const withEtaOnly = groups.filter((g) => g.hasEta && !hasFareLoaded(g)).sort(sortByRoute)
  // Tier 3: No ETA
  const withoutEtas = groups.filter((g) => !g.hasEta).sort(sortByRoute)

  return [...withEtaAndFare, ...withEtaOnly, ...withoutEtas]
}

export function precomputeRenderGroups(
  etaByStopId: Record<string, KmbEtaEntryWithLeg[]>,
  loadedStopIds: string[],
  faresByVariantKey: FareByVariantKey
): PrecomputedGroups {
  // Precompute groups by stop ID
  const byStopId: Record<string, EtaGroup[]> = {}
  for (const stopId of loadedStopIds) {
    const eta = etaByStopId[stopId] ?? []
    byStopId[stopId] = groupEtasByVariant(eta, faresByVariantKey)
  }

  // Precompute flat groups (for non-keyphrase mode)
  const allEtas = loadedStopIds.flatMap((stopId) => etaByStopId[stopId] ?? [])
  const flat = groupEtasByVariant(allEtas, faresByVariantKey)

  return { byStopId, flat }
}
