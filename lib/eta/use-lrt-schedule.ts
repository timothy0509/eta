'use client'

import * as React from 'react'

import { fetchLrtSchedule } from '@/lib/eta/client'
import { translations } from '@/lib/eta/i18n'
import type { LrtScheduleResponse } from '@/lib/eta/direct/lrt'
import { pickLangZh } from '@/lib/eta/pick-lang'
import type { LrtStationSearchItem, UiLanguage } from '@/lib/eta/types'

export function useLrtSchedule(params: { stations: LrtStationSearchItem[]; lang: UiLanguage }) {
  const { stations, lang } = params

  const stationsById = React.useMemo(() => {
    return new Map(stations.map((station) => [station.stationId, station]))
  }, [stations])

  const [stationId, setStationId] = React.useState<string | undefined>(undefined)
  const [schedule, setSchedule] = React.useState<LrtScheduleResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number | null>(null)
  const [stale, setStale] = React.useState(false)

  // AbortController for cancelling in-flight requests
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const refresh = React.useCallback(
    async (options?: { toastOnError?: boolean; stationId?: string }) => {
      // Accept an explicit id so callers can refresh without depending on
      // closure freshness (e.g. reselecting the current station, where
      // setStationId bails out and the stationId-change effect never fires).
      const activeStationId = options?.stationId ?? stationId
      if (!activeStationId) return

      const station = stationsById.get(activeStationId)
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

        const schedule = await fetchLrtSchedule(
          { stationId: activeStationId },
          { signal: controller.signal }
        )

        if (controller.signal.aborted) return

        setSchedule(schedule)
        // Cache hits carry data as old as the entry, not this poll tick.
        // Keep the previous timestamp so "just now" and the age-based
        // stale check reflect the data, not the poll, but still stamp
        // first load (previous timestamp is null).
        if (schedule.cached) {
          setLastUpdatedAt((prev) => prev ?? Date.now())
        } else {
          setLastUpdatedAt(Date.now())
        }
        setStale(false)
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
        if (abortControllerRef.current === controller) {
          setLoading(false)
        }
      }
    },
    [stationId, stationsById]
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
    if (!stationId) return
    const id = setTimeout(() => {
      void refresh({ toastOnError: false })
    }, 0)
    return () => clearTimeout(id)
  }, [refresh, stationId])

  const title = React.useMemo(() => {
    if (!stationId) return translations.lrt.title[lang]
    const station = stationsById.get(stationId)
    if (station) return pickLangZh({ en: station.nameEn, zh: station.nameZh }, lang)
    return translations.common.stationWithId[lang].replace('{id}', stationId)
  }, [lang, stationId, stationsById])

  return {
    stationId,
    setStationId,
    schedule,
    loading,
    error,
    stale,
    lastUpdatedAt,
    refresh,
    title,
  }
}
