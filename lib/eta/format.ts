import type { UiLanguage } from '@/lib/eta/types'

export function formatRelativeMinutes(targetIso: string, now: number | Date = new Date()) {
  const target = new Date(targetIso)
  const nowMs = now instanceof Date ? now.getTime() : now
  const diffMs = target.getTime() - nowMs
  const diffMin = Math.round(diffMs / 60000)
  return diffMin
}

/**
 * Compute relative minutes with drift correction.
 * When data is stale (fetched `dataTimestampMs` ago), subtract that age
 * from the computed ETA so the display reflects the *current* expected arrival.
 *
 * Example: if a bus was 3 min away when data was fetched 30s ago,
 * it is now approximately 2.5 min away.
 */
export function formatRelativeMinutesWithDrift(
  targetIso: string,
  dataTimestampIso: string | undefined,
  now: number | Date = new Date()
): number {
  const target = new Date(targetIso)
  const nowMs = now instanceof Date ? now.getTime() : now
  let diffMs = target.getTime() - nowMs

  if (dataTimestampIso) {
    const dataTimestamp = new Date(dataTimestampIso)
    const dataAgeMs = nowMs - dataTimestamp.getTime()
    if (!Number.isNaN(dataAgeMs) && dataAgeMs > 0) {
      diffMs -= dataAgeMs
    }
  }

  const minutes = Math.round(diffMs / 60000)
  // Normalize -0 to 0 for consistent comparisons
  return minutes === 0 ? 0 : minutes
}

export function getUiLocale(lang: UiLanguage) {
  if (lang === 'en') return 'en-HK'
  if (lang === 'sc') return 'zh-Hans-HK'
  return 'zh-Hant-HK'
}

export function formatUiTime(date: Date, lang: UiLanguage) {
  return new Intl.DateTimeFormat(getUiLocale(lang), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

export function formatUiLanguageLabel(lang: UiLanguage) {
  switch (lang) {
    case 'en':
      return 'EN'
    case 'tc':
      return '繁'
    case 'sc':
      return '简'
  }
}
