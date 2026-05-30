import type { KmbEtaEntryWithLeg, KmbRouteInfoLite } from '@/lib/eta/client'
import type { UiLanguage } from '@/lib/eta/types'

export function pickLang(fields: { en: string; tc: string; sc: string }, lang: UiLanguage) {
  if (lang === 'sc') return fields.sc
  if (lang === 'en') return fields.en
  return fields.tc
}

export function formatOperatorLabel(co: string | undefined, lang: UiLanguage) {
  const key = String(co ?? 'kmb').toLowerCase()
  const map: Record<string, { en: string; tc: string; sc: string }> = {
    kmb: { en: 'KMB', tc: '九巴', sc: '九巴' },
    ctb: { en: 'CTB', tc: '城巴', sc: '城巴' },
    nwfb: { en: 'NWFB', tc: '新巴', sc: '新巴' },
    nlb: { en: 'NLB', tc: '嶼巴', sc: '屿巴' },
    gmb: { en: 'GMB', tc: '小巴', sc: '小巴' },
    lrtfeeder: { en: 'LRTF', tc: '港鐵巴士', sc: '轻铁接驳' },
    sunferry: { en: 'SF', tc: '新渡輪', sc: '新渡轮' },
    hkkf: { en: 'HKKF', tc: '港九小輪', sc: '港九小轮' },
    fortuneferry: { en: 'FF', tc: '富裕小輪', sc: '富裕小轮' },
  }
  const label = map[key] ?? { en: key.toUpperCase(), tc: key, sc: key }
  return pickLang(label, lang)
}

export function formatRouteVariantLabel(
  info: KmbRouteInfoLite | undefined,
  etaFallback: KmbEtaEntryWithLeg | undefined,
  lang: UiLanguage,
  isArrivingLeg?: boolean,
  stopNameFallback?: string
) {
  if (info) {
    if (isArrivingLeg) {
      const origin = pickLang(info.origin, lang)
      if (origin) return origin
    }
    const destination = pickLang(info.destination, lang)
    if (destination) return destination
  }

  if (isArrivingLeg && stopNameFallback) {
    return stopNameFallback
  }

  if (!etaFallback) return ''

  const dest = pickLang(
    {
      en: etaFallback.dest_en ?? '',
      tc: etaFallback.dest_tc ?? '',
      sc: etaFallback.dest_sc ?? '',
    },
    lang
  )
  return dest
}

export function formatArrivingText(lang: UiLanguage) {
  if (lang === 'en') return 'Now'
  if (lang === 'sc') return '即将到达'
  return '即將到達'
}

export function formatNoScheduledText(lang: UiLanguage) {
  if (lang === 'en') return 'No scheduled buses'
  if (lang === 'sc') return '暂时没有预定班次'
  return '暫時沒有預定班次'
}

export function formatEtaLabel(seq: number, lang: UiLanguage) {
  if (lang === 'en') {
    if (seq === 1) return '1st'
    if (seq === 2) return '2nd'
    if (seq === 3) return '3rd'
    return `${seq}th`
  }
  return `第${seq}${lang === 'sc' ? '班' : '班'}`
}

export function getGroupRemark(items: KmbEtaEntryWithLeg[], lang: UiLanguage): string | null {
  for (const entry of items) {
    const remark = pickLang(
      {
        en: entry.rmk_en ?? '',
        tc: entry.rmk_tc ?? '',
        sc: entry.rmk_sc ?? '',
      },
      lang
    )
    if (remark?.trim()) return remark.trim()
  }
  return null
}

export function pickStopName(
  stop: { nameEn: string; nameTc: string; nameSc: string } | undefined,
  lang: UiLanguage
): string {
  if (!stop) return ''
  if (lang === 'sc') return stop.nameSc
  if (lang === 'en') return stop.nameEn
  return stop.nameTc
}

export function hasValidEta(items: { eta?: string | null }[]): boolean {
  return items.some((entry) => entry.eta && !isNaN(Date.parse(entry.eta)))
}
