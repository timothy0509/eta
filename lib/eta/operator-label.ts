import { normalizeOperator } from '@/lib/eta/operator-colors'
import { pickLang } from '@/lib/eta/pick-lang'
import type { UiLanguage } from '@/lib/eta/types'

const OPERATOR_LABELS: Record<string, { en: string; tc: string; sc: string }> = {
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

/** Localized operator name for accessibility and prose. */
export function formatOperatorLabel(co: string | undefined, lang: UiLanguage): string {
  const key = normalizeOperator(co)
  const label = OPERATOR_LABELS[key] ?? { en: key.toUpperCase(), tc: key, sc: key }
  return pickLang(label, lang)
}

/** Compact operator code used inside chips and pills. */
export function formatOperatorCode(co: string | undefined): string {
  return normalizeOperator(co).toUpperCase()
}
