import type { UiLanguage } from '@/lib/eta/types'

/**
 * Shared language picker. Single source of truth for choosing the
 * display string for the active UI language. Falls back to
 * Traditional Chinese, which has the best transit data coverage.
 */
export function pickLang<T>(record: { en: T; tc: T; sc: T }, lang: UiLanguage): T {
  if (lang === 'sc') return record.sc
  if (lang === 'en') return record.en
  return record.tc
}

/** Variant for records that use a `zh` key instead of `tc` (MTR/LRT data). */
export function pickLangZh<T>(record: { en: T; zh: T }, lang: UiLanguage): T {
  if (lang === 'en') return record.en
  return record.zh
}

/**
 * Secondary display name: the companion-language name shown under the
 * primary name in search rows. English UI shows Traditional Chinese,
 * Chinese UI shows English.
 */
export function pickSecondaryName(record: { en: string; tc: string }, lang: UiLanguage): string {
  if (lang === 'en') return record.tc
  return record.en
}
