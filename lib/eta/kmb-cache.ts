export const KMB_DAILY_UPDATE_HOUR_HK = 5

const HK_OFFSET_MINUTES = 8 * 60
const KMB_UPDATE_BUFFER_MINUTES = 5

/**
 * KMB static datasets are updated at 05:00 daily (Hong Kong time).
 * HK time is UTC+8 with no DST.
 *
 * Uses a small buffer (05:05) to avoid caching a just-before-update response
 * if the provider updates slightly after 05:00.
 */
export function secondsUntilNextKmbDailyUpdate(now = new Date()): number {
  const nowUtcMs = now.getTime()
  const nowHkMs = nowUtcMs + HK_OFFSET_MINUTES * 60_000
  const nowHk = new Date(nowHkMs)

  const nextHk = new Date(nowHkMs)
  nextHk.setHours(KMB_DAILY_UPDATE_HOUR_HK, KMB_UPDATE_BUFFER_MINUTES, 0, 0)

  if (nextHk.getTime() <= nowHk.getTime()) {
    nextHk.setDate(nextHk.getDate() + 1)
  }

  const nextUtcMs = nextHk.getTime() - HK_OFFSET_MINUTES * 60_000
  const diffSeconds = Math.ceil((nextUtcMs - nowUtcMs) / 1000)

  // Clamp for safety.
  return Math.max(60, Math.min(diffSeconds, 60 * 60 * 24))
}

export function kmbDailyCacheControlHeader(revalidateSeconds: number): string {
  // Cache on the CDN (s-maxage), but always revalidate at origin.
  // Also allow stale content briefly to smooth over revalidation.
  return `public, max-age=0, s-maxage=${revalidateSeconds}, stale-while-revalidate=300`
}

export const KMB_NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
} as const
