import type { LrtScheduleResponse } from '@/lib/eta/direct/lrt'
import type { UiLanguage } from '@/lib/eta/types'

export type LrtRouteListEntry = NonNullable<
  NonNullable<LrtScheduleResponse['platform_list']>[number]['route_list']
>[number]

export type LrtRouteGroup = {
  key: string
  routeNo: string
  destEn: string
  destCh: string
  items: LrtRouteListEntry[]
  hasEta: boolean
}

function isArrivingText(time: string): boolean {
  const lower = time.toLowerCase()
  return (
    lower.includes('arriv') ||
    time.includes('到達') ||
    time.includes('到达') ||
    time.includes('即將') ||
    time.includes('即将')
  )
}

/** Minutes for sorting. Arriving is 0, numeric strings parse, '-' and empty are null. */
export function parseLrtMinutes(timeEn: string | number | null | undefined): number | null {
  const text = String(timeEn ?? '').trim()
  if (!text || text === '-') return null
  if (isArrivingText(text)) return 0
  const match = text.match(/(\d+)/)
  if (!match?.[1]) return null
  const minutes = Number(match[1])
  return Number.isNaN(minutes) ? null : minutes
}

function hasValidLrtEta(items: LrtRouteListEntry[]): boolean {
  for (const entry of items) {
    if (parseLrtMinutes(entry.time_en) !== null) return true
    const zh = String(entry.time_ch ?? '').trim()
    if (zh && zh !== '-' && zh !== '') return true
  }
  return false
}

function buildRouteKey(entry: LrtRouteListEntry): string {
  const route = String(entry.route_no ?? '').toUpperCase()
  const destEn = String(entry.dest_en ?? '')
  const destCh = String(entry.dest_ch ?? '')
  return `${route}|${destEn}|${destCh}`
}

export function formatLrtEtaLabel(seq: number, lang: UiLanguage): string {
  if (lang === 'en') {
    if (seq === 1) return '1st'
    if (seq === 2) return '2nd'
    if (seq === 3) return '3rd'
    return `${seq}th`
  }
  return `第${seq}班`
}

export function groupLrtEntriesByRoute(routeList: LrtRouteListEntry[]): LrtRouteGroup[] {
  const byRoute = new Map<string, LrtRouteListEntry[]>()
  for (const entry of routeList) {
    const key = buildRouteKey(entry)
    const items = byRoute.get(key) ?? []
    items.push(entry)
    byRoute.set(key, items)
  }

  const groups = Array.from(byRoute.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) => {
      const aMin = parseLrtMinutes(a.time_en)
      const bMin = parseLrtMinutes(b.time_en)
      if (aMin === null && bMin === null) return 0
      if (aMin === null) return 1
      if (bMin === null) return -1
      return aMin - bMin
    })
    const first = sorted[0]
    return {
      key,
      routeNo: String(first?.route_no ?? ''),
      destEn: String(first?.dest_en ?? ''),
      destCh: String(first?.dest_ch ?? ''),
      items: sorted,
      hasEta: hasValidLrtEta(sorted),
    }
  })

  const withEtas: LrtRouteGroup[] = []
  const withoutEtas: LrtRouteGroup[] = []
  for (const g of groups) {
    if (g.hasEta) withEtas.push(g)
    else withoutEtas.push(g)
  }

  const sortByRoute = (a: LrtRouteGroup, b: LrtRouteGroup) =>
    a.routeNo.localeCompare(b.routeNo, undefined, { numeric: true })

  withEtas.sort(sortByRoute)
  withoutEtas.sort(sortByRoute)

  return [...withEtas, ...withoutEtas]
}
