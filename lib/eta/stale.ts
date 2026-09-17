import { translations } from './i18n'
import type { UiLanguage } from './types'

function normalizeNowMs(now?: number | Date): number {
  if (now instanceof Date) return now.getTime()
  if (typeof now === 'number') return now
  return Date.now()
}

export type StaleMode = 'kmb' | 'mtr' | 'lrt'

export const STALE_THRESHOLDS_MS: Record<StaleMode, number> = {
  kmb: 60_000,
  mtr: 90_000,
  lrt: 90_000,
}

export function isStaleByAge(params: {
  lastUpdatedAt?: number | null
  mode: StaleMode
  now?: number | Date
}) {
  const lastUpdatedAt = params.lastUpdatedAt
  if (!lastUpdatedAt) return false
  const nowMs = normalizeNowMs(params.now)
  return nowMs - lastUpdatedAt > STALE_THRESHOLDS_MS[params.mode]
}

/**
 * Check if data is stale based on both upstream flag and age threshold.
 * Combines upstream stale status with local age-based staleness check.
 */
export function isStaleByFlagOrAge(params: {
  upstreamStale?: boolean
  ageMs?: number | null
  mode: StaleMode
}): boolean {
  // If upstream says it's stale, trust that
  if (params.upstreamStale) return true
  // Otherwise check age against threshold
  if (typeof params.ageMs !== 'number') return false
  return params.ageMs > STALE_THRESHOLDS_MS[params.mode]
}

export function formatRelativeAgeLabel(params: {
  lastUpdatedAt?: number | null
  lang: UiLanguage
  now?: number | Date
}) {
  const lastUpdatedAt = params.lastUpdatedAt
  if (!lastUpdatedAt) return null

  const nowMs = normalizeNowMs(params.now)
  const updatedAtTime = lastUpdatedAt
  if (Number.isNaN(updatedAtTime)) return null

  const lang = params.lang
  const diffMs = nowMs - updatedAtTime
  if (diffMs < 0) return null
  if (diffMs < 30_000) {
    return translations.common.justNow[lang]
  }

  const minutes = Math.abs(Math.round(diffMs / 60000))
  if (minutes < 60) {
    return translations.common.minutesAgo[lang].replace('{minutes}', String(minutes))
  }

  const hours = Math.max(1, Math.round(minutes / 60))
  if (hours === 1) {
    return translations.common.hourAgo[lang].replace('{hours}', String(hours))
  }
  return translations.common.hoursAgo[lang].replace('{hours}', String(hours))
}
