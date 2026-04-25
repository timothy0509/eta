import { formatRelativeMinutes } from './format'
import type { UiLanguage } from './types'

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
  const nowMs =
    params.now instanceof Date
      ? params.now.getTime()
      : typeof params.now === 'number'
        ? params.now
        : Date.now()
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
  now?: Date
}) {
  const lastUpdatedAt = params.lastUpdatedAt
  if (!lastUpdatedAt) return null

  const now = params.now ?? new Date()
  const updatedAt = new Date(lastUpdatedAt)
  const updatedAtTime = updatedAt.getTime()
  if (Number.isNaN(updatedAtTime)) return null

  const diffMs = now.getTime() - updatedAtTime
  if (diffMs < 0) return null
  if (diffMs < 30_000) {
    return params.lang === 'en' ? 'just now' : params.lang === 'sc' ? '刚刚' : '剛剛'
  }

  const minutes = Math.abs(formatRelativeMinutes(updatedAt.toISOString(), now))
  if (minutes < 60) {
    if (params.lang === 'en') return `${minutes} min ago`
    return `${minutes} ${params.lang === 'sc' ? '分钟前' : '分鐘前'}`
  }

  const hours = Math.max(1, Math.round(minutes / 60))
  if (params.lang === 'en') return `${hours} hr${hours === 1 ? '' : 's'} ago`
  return `${hours} ${params.lang === 'sc' ? '小时前' : '小時前'}`
}
