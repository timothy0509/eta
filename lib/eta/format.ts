import { LANG_LABELS } from '@/lib/eta/i18n'
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

const LOCALE_MAP: Record<UiLanguage, string> = {
  en: 'en-HK',
  sc: 'zh-Hans-HK',
  tc: 'zh-Hant-HK',
}

export function getUiLocale(lang: UiLanguage) {
  return LOCALE_MAP[lang] ?? 'zh-Hant-HK'
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>()

function getTimeFormatter(lang: UiLanguage): Intl.DateTimeFormat {
  const locale = getUiLocale(lang)
  let f = timeFormatters.get(locale)
  if (!f) {
    f = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    timeFormatters.set(locale, f)
  }
  return f
}

export function formatUiTime(date: Date, lang: UiLanguage) {
  return getTimeFormatter(lang).format(date)
}

export function formatUiLanguageLabel(lang: UiLanguage) {
  return LANG_LABELS[lang]
}

/**
 * Format a fare in HKD as a single spaced string like 'HK$ 5.2'.
 * Returns null for non-finite input so callers can skip fare UI entirely.
 */
export function formatFareHkd(hkd: unknown): string | null {
  if (typeof hkd !== 'number' || !Number.isFinite(hkd)) return null
  return `HK$ ${hkd.toFixed(1)}`
}

let exactHmsFormatter: Intl.DateTimeFormat | null = null

function getExactHmsFormatter(): Intl.DateTimeFormat {
  if (!exactHmsFormatter) {
    exactHmsFormatter = new Intl.DateTimeFormat('en-HK', {
      timeZone: 'Asia/Hong_Kong',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
  }
  return exactHmsFormatter
}

/** Format a Date as hh:mm:ss in Hong Kong time. */
export function formatExactHms(date: Date): string {
  return getExactHmsFormatter().format(date)
}

/** Parse an ISO ETA string and format it as hh:mm:ss (HK time). Null when invalid. */
export function formatIsoToExactHms(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return formatExactHms(date)
}

/**
 * Format an MTR `time` field as hh:mm:ss (HK time). The API returns
 * `YYYY-MM-DD HH:mm:ss`, which `new Date` cannot parse reliably, so the
 * space form is interpreted as Hong Kong wall-clock time first.
 */
export function formatMtrTimeToExactHms(time: unknown): string | null {
  if (typeof time !== 'string') return null
  const raw = time.trim()
  if (!raw) return null
  const hkWallClock = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (hkWallClock) {
    const [, y, mo, d, h, mi, s] = hkWallClock
    const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}+08:00`)
    if (Number.isNaN(date.getTime())) return null
    return formatExactHms(date)
  }
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return formatExactHms(date)
}

/** Minutes from now rendered as the arrival wall-clock hh:mm:ss (HK time). */
export function formatMinutesFromNowToExactHms(minutes: number, now: number = Date.now()): string {
  return formatExactHms(new Date(now + minutes * 60_000))
}

/** Minutes since midnight (may exceed 1440 for after-midnight windows) to HH:MM. */
export function minsToDisplay(mins: number): string {
  const normalized = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
