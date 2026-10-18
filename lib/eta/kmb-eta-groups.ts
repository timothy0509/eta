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

export function buildDefaultKey(entry: KmbEtaEntryWithLeg): string {
  const co = String(entry.co ?? 'kmb')
  const route = (entry.route ?? '').toUpperCase()
  const dir = String(entry.dir ?? '')
  const serviceType = String(entry.service_type ?? '')
  // Region-aware: same number in different regions (GMB HKI/Kowloon/NT)
  // must not merge. The gtfsId scope segment is present only when upstream
  // provides one, so KMB rows keep their exact legacy 5-part shape while
  // GMB rows gain a discriminator. baseKey is everything but the leg.
  const gtfsId = String(entry.gtfsId ?? '').trim()
  const legSuffix = entry.leg ?? '_'
  return gtfsId
    ? `${co}|${route}|${dir}|${serviceType}|${gtfsId}|${legSuffix}`
    : `${co}|${route}|${dir}|${serviceType}|${legSuffix}`
}

/**
 * Base key (fare/schedule lookup) of a default group key: everything but
 * the trailing leg. Key shape is co|route|dir|serviceType|leg, or with a
 * gtfsId scope segment (co|route|dir|serviceType|gtfsId|leg) for
 * region-split variants.
 */
export function baseKeyOfGroupKey(key: string): string {
  const parts = key.split('|')
  return parts.length === 6 ? parts.slice(0, 5).join('|') : parts.slice(0, 4).join('|')
}

export function groupEtasByVariant(
  eta: KmbEtaEntryWithLeg[],
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>,
  buildKey: (entry: KmbEtaEntryWithLeg) => string = buildDefaultKey,
  baseKeyOfKey: (key: string) => string = baseKeyOfGroupKey
): EtaGroup[] {
  const byVariant = new Map<string, KmbEtaEntryWithLeg[]>()
  for (const entry of eta) {
    const key = buildKey(entry)

    const items = byVariant.get(key) ?? []
    items.push(entry)
    byVariant.set(key, items)
  }

  const groups = Array.from(byVariant.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) => a.eta_seq - b.eta_seq)
    const hasEta = hasValidEta(sorted)

    const baseKey = baseKeyOfKey(key)
    const parts = key.split('|')
    const legPart = parts[parts.length - 1]
    const isArrivingLeg = legPart === 'B'

    const hasFare = !isArrivingLeg

    return { key, baseKey, items: sorted, hasEta, hasFare, isArrivingLeg }
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

  const routeOf = (g: EtaGroup) => g.key.split('|', 2)[1] ?? ''
  const sortByRoute = (a: EtaGroup, b: EtaGroup) =>
    routeOf(a).localeCompare(routeOf(b), undefined, { numeric: true })

  withEtaAndFare.sort(sortByRoute)
  withEtaOnly.sort(sortByRoute)
  withoutEtas.sort(sortByRoute)

  return [...withEtaAndFare, ...withEtaOnly, ...withoutEtas]
}

/**
 * Stable-partition only the trailing no-ETA segment so groups with a
 * scheduled fallback (baseKey present in the map) come first. Live groups
 * keep their positions and relative order within each part is preserved.
 * Returns the input array unchanged when there is nothing to reorder.
 */
export function sortScheduledFirst(
  groups: EtaGroup[],
  scheduledByBaseKey: Record<string, unknown>
): EtaGroup[] {
  let lastLive = -1
  for (let i = 0; i < groups.length; i++) {
    if (groups[i]?.hasEta) lastLive = i
  }
  const head = groups.slice(0, lastLive + 1)
  const tail = groups.slice(lastLive + 1)
  if (tail.length < 2) return groups
  const withSchedule: EtaGroup[] = []
  const withoutSchedule: EtaGroup[] = []
  for (const group of tail) {
    if (Object.prototype.hasOwnProperty.call(scheduledByBaseKey, group.baseKey)) {
      withSchedule.push(group)
    } else {
      withoutSchedule.push(group)
    }
  }
  if (withSchedule.length === 0 || withoutSchedule.length === 0) return groups
  return [...head, ...withSchedule, ...withoutSchedule]
}

export function precomputeRenderGroups(
  etaByStopId: Record<string, KmbEtaEntryWithLeg[]>,
  loadedStopIds: string[],
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
): PrecomputedGroups {
  const byStopId: Record<string, EtaGroup[]> = {}
  for (const stopId of loadedStopIds) {
    const eta = etaByStopId[stopId] ?? []
    byStopId[stopId] = groupEtasByVariant(eta, faresByVariantKey)
  }

  const allEtas = loadedStopIds.flatMap((stopId) => etaByStopId[stopId] ?? [])
  const flat = groupEtasByVariant(allEtas, faresByVariantKey)

  return { byStopId, flat }
}
