import { tdTrafficKey } from '@/lib/eta/cache/keys'
import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { fetchText } from '@/lib/eta/http'
import type { UiLanguage } from '@/lib/eta/types'

export type TdTrafficRecord = {
  id: string
  heading: string
  detail: string
  location: string
  district: string
  direction: string
  date: string
  status: string
  lat: number | null
  lng: number | null
}

function tdFeedUrl(lang: UiLanguage): string {
  return `https://www.td.gov.hk/${lang}/special_news/trafficnews.xml`
}

function childText(parent: Element, tag: string): string {
  const el = parent.getElementsByTagName(tag)[0]
  return (el?.textContent ?? '').trim()
}

function toNullableCoord(value: string): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Terminal statuses mean the incident cleared, so the banner should drop the record. */
function isLiveStatus(statusEn: string): boolean {
  return !/clear|cancel|close|end|reopen|resume/i.test(statusEn)
}

function parseMessage(message: Element, useEnglish: boolean): TdTrafficRecord | null {
  const suffix = useEnglish ? '_EN' : '_CN'
  const id = childText(message, 'INCIDENT_NUMBER') || childText(message, 'ID')
  const heading = childText(message, `INCIDENT_HEADING${suffix}`)
  const detail =
    childText(message, `CONTENT${suffix}`) || childText(message, `INCIDENT_DETAIL${suffix}`)
  const location = childText(message, `LOCATION${suffix}`)
  const district = childText(message, `DISTRICT${suffix}`)
  const direction = childText(message, `DIRECTION${suffix}`)
  const date = childText(message, 'ANNOUNCEMENT_DATE')
  const status = childText(message, 'INCIDENT_STATUS_EN').toUpperCase()

  if (!isLiveStatus(status)) return null
  if (!id && !heading && !detail && !location) return null

  return {
    id,
    heading,
    detail,
    location,
    district,
    direction,
    date,
    status,
    lat: toNullableCoord(childText(message, 'LATITUDE')),
    lng: toNullableCoord(childText(message, 'LONGITUDE')),
  }
}

export function parseTdTrafficXml(xml: string, lang: UiLanguage): TdTrafficRecord[] {
  try {
    if (typeof DOMParser === 'undefined') return []
    if (!xml.trim()) return []
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    if (doc.getElementsByTagName('parsererror').length > 0) return []
    const messages = doc.getElementsByTagName('message')
    const useEnglish = lang === 'en'
    const records: TdTrafficRecord[] = []
    for (const message of Array.from(messages)) {
      const record = parseMessage(message, useEnglish)
      if (record) records.push(record)
    }
    return records
  } catch {
    return []
  }
}

async function loadTdTraffic(lang: UiLanguage): Promise<TdTrafficRecord[]> {
  const xml = await fetchText(tdFeedUrl(lang), { cache: 'no-store' })
  return parseTdTrafficXml(xml, lang)
}

/**
 * Live Transport Department Special Traffic News. Returns an empty array on
 * empty feed, parse failure, or fetch failure. Never throws.
 */
export async function getTdTrafficAlerts(lang: UiLanguage): Promise<TdTrafficRecord[]> {
  try {
    const cachedValue = await getCachedValue<TdTrafficRecord[]>({
      key: tdTrafficKey(lang),
      policyKey: 'tdTraffic',
      policy: CACHE_POLICIES.tdTraffic,
      fetcher: async () => loadTdTraffic(lang),
    })
    return cachedValue.value
  } catch {
    return []
  }
}
