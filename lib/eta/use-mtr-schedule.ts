'use client'

import * as React from 'react'

import { fetchMtrSchedules } from '@/lib/eta/client'
import { translations } from '@/lib/eta/i18n'
import type { MtrScheduleResponse } from '@/lib/eta/mtr'
import { pickLangZh } from '@/lib/eta/pick-lang'
import type { MtrStationSearchItem, UiLanguage } from '@/lib/eta/types'

export function useMtrSchedule(params: { lang: UiLanguage; stations: MtrStationSearchItem[] }) {
  const { lang, stations } = params

  const stationsById = React.useMemo(() => {
    return new Map(stations.map((station) => [station.sta, station]))
  }, [stations])

  const [sta, setSta] = React.useState<string | undefined>(undefined)
  const [schedule, setSchedule] = React.useState<MtrScheduleResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number | null>(null)
  const [stale, setStale] = React.useState(false)

  // AbortController for cancelling in-flight requests
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const refresh = React.useCallback(
    async (options?: { toastOnError?: boolean; sta?: string }) => {
      // Accept an explicit id so callers can refresh without depending on
      // closure freshness (e.g. reselecting the current station, where
      // setSta bails out and the sta-change effect never fires).
      const activeSta = options?.sta ?? sta
      if (!activeSta) return

      const station = stationsById.get(activeSta)
      if (!station) return

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      setLoading(true)
      try {
        setError(null)
        const mtrLang = lang === 'en' ? 'EN' : 'TC'

        // Use the new batched endpoint - one request for all lines at this station
        const queries = station.lines.map((line) => ({
          line,
          sta: activeSta,
          lang: mtrLang as 'EN' | 'TC',
        }))

        const result = await fetchMtrSchedules(queries, { signal: controller.signal })

        if (controller.signal.aborted) return

        // result.fetched === 0 means every line was served from cache, so
        // the data is as old as the entry, not this poll tick. Keep the
        // previous timestamp so "just now" and the age-based stale check
        // reflect the data, not the poll.
        const allCached = result.fetched === 0 && Object.keys(result.byKey).length > 0

        // Merge schedules from all lines
        let baseline: MtrScheduleResponse | null = null
        const mergedData: Record<string, NonNullable<MtrScheduleResponse['data']>[string]> = {}

        for (const item of Object.values(result.byKey)) {
          baseline ??= item
          if (item.status !== 1) continue
          Object.assign(mergedData, item.data ?? {})
        }

        if (!baseline) {
          setError('Failed to load schedule')
          setStale(true)
          return
        }

        const hadErrors = result.errors.length > 0

        setSchedule({
          ...baseline,
          status: Object.keys(mergedData).length ? 1 : baseline.status,
          data: Object.keys(mergedData).length ? mergedData : baseline.data,
        })
        if (!allCached) {
          setLastUpdatedAt(Date.now())
        } else {
          // Cache hits carry data as old as the entry, not this poll
          // tick. Keep the previous timestamp so "just now" and the
          // age-based stale check reflect the data, not the poll, but
          // still stamp first load (previous timestamp is null).
          setLastUpdatedAt((prev) => prev ?? Date.now())
        }
        setStale(hadErrors)

        // Warn if we hit rate limiting
        if (result.backoff) {
          console.warn('[MTR] Rate limited - using cached data')
        }
      } catch (error) {
        if (controller.signal.aborted) return

        const message = error instanceof Error ? error.message : 'Failed to load schedule'
        setError(message)
        setStale(true)
        if (options?.toastOnError) {
          const { toast } = await import('sonner')
          toast.error(message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    },
    [lang, sta, stationsById]
  )

  // Cleanup abort controller on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  React.useEffect(() => {
    if (!sta) return
    const id = setTimeout(() => {
      void refresh({ toastOnError: false })
    }, 0)
    return () => clearTimeout(id)
  }, [refresh, sta])

  const title = React.useMemo(() => {
    if (!sta) return translations.mtr.title[lang]
    const station = stationsById.get(sta)
    return station
      ? pickLangZh({ en: station.nameEn, zh: station.nameTc }, lang)
      : translations.common.stationWithId[lang].replace('{id}', sta)
  }, [lang, sta, stationsById])

  return {
    sta,
    setSta,
    schedule,
    loading,
    error,
    stale,
    lastUpdatedAt,
    refresh,
    title,
  }
}
