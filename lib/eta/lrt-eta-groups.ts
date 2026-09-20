import type { LrtScheduleResponse } from '@/lib/eta/direct/lrt'
import { translations } from '@/lib/eta/i18n'
import { pickLangZh } from '@/lib/eta/pick-lang'
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

export function isLrtArrivingText(time: string): boolean {
  const lower = time.toLowerCase()
  return (
    lower.includes('arriv') ||
    time.includes('到達') ||
    time.includes('到达') ||
    time.includes('即將') ||
    time.includes('即将')
  )
}

/** Display text for an entry in the active language. Sorting and display both use this. */
export function getLrtDisplayTime(entry: LrtRouteListEntry, lang: UiLanguage): string {
  return pickLangZh({ en: String(entry.time_en ?? ''), zh: String(entry.time_ch ?? '') }, lang)
}

/** Minutes for sorting. Arriving is 0, '-' and empty are null. */
export function parseLrtMinutes(time: string | number | null | undefined): number | null {
  const text = String(time ?? '').trim()
  if (!text || text === '-') return null
  if (isLrtArrivingText(text)) return 0
  const match = text.match(/(\d+)/)
  if (!match?.[1]) return null
  const minutes = Number(match[1])
  return Number.isNaN(minutes) ? null : minutes
}

function hasValidLrtEta(items: LrtRouteListEntry[], lang: UiLanguage): boolean {
  for (const entry of items) {
    if (parseLrtMinutes(getLrtDisplayTime(entry, lang)) !== null) return true
  }
  return false
}

function buildRouteKey(entry: LrtRouteListEntry): string {
  const route = String(entry.route_no ?? '').toUpperCase()
  const destEn = String(entry.dest_en ?? '')
  const destCh = String(entry.dest_ch ?? '')
  return `${route}|${destEn}|${destCh}`
}

function replaceSeq(template: string, seq: number): string {
  return template.replace('{seq}', String(seq))
}

export function formatLrtEtaLabel(seq: number, lang: UiLanguage): string {
  const lrt = translations.lrt
  if (seq === 1) return lrt.trainOrder1[lang] ?? lrt.trainOrder1.tc
  if (seq === 2) return lrt.trainOrder2[lang] ?? lrt.trainOrder2.tc
  if (seq === 3) return lrt.trainOrder3[lang] ?? lrt.trainOrder3.tc
  const template = lrt.trainOrderN[lang] ?? lrt.trainOrderN.tc
  return replaceSeq(template, seq)
}

export function groupLrtEntriesByRoute(
  routeList: LrtRouteListEntry[],
  lang: UiLanguage = 'tc'
): LrtRouteGroup[] {
  const byRoute = new Map<string, LrtRouteListEntry[]>()
  for (const entry of routeList) {
    const key = buildRouteKey(entry)
    const items = byRoute.get(key) ?? []
    items.push(entry)
    byRoute.set(key, items)
  }

  const groups = Array.from(byRoute.entries()).map(([key, items]) => {
    const sorted = [...items].sort((a, b) => {
      const aMin = parseLrtMinutes(getLrtDisplayTime(a, lang))
      const bMin = parseLrtMinutes(getLrtDisplayTime(b, lang))
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
      hasEta: hasValidLrtEta(sorted, lang),
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
