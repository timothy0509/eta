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

function buildDefaultKey(entry: KmbEtaEntryWithLeg): string {
  const co = String(entry.co ?? 'kmb')
  const route = (entry.route ?? '').toUpperCase()
  const dir = String(entry.dir ?? '')
  const serviceType = String(entry.service_type ?? '')
  const legSuffix = entry.leg ?? '_'
  return `${co}|${route}|${dir}|${serviceType}|${legSuffix}`
}

export function groupEtasByVariant(
  eta: KmbEtaEntryWithLeg[],
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>,
  buildKey: (entry: KmbEtaEntryWithLeg) => string = buildDefaultKey
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

    const parts = key.split('|')
    const baseKey = parts.slice(0, 4).join('|')
    const legPart = parts[4]
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
