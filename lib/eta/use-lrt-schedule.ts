'use client'

import * as React from 'react'

import { fetchLrtSchedule } from '@/lib/eta/client'
import type { LrtScheduleResponse } from '@/lib/eta/direct/lrt'
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
    async (options?: { toastOnError?: boolean }) => {
      if (!stationId) return

      const station = stationsById.get(stationId)
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

        const schedule = await fetchLrtSchedule({ stationId }, { signal: controller.signal })

        if (controller.signal.aborted) return

        setSchedule(schedule)
        setLastUpdatedAt(Date.now())
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
        if (!controller.signal.aborted) {
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
    if (!stationId) return 'Light Rail'
    const station = stationsById.get(stationId)
    if (station) return lang === 'en' ? station.nameEn : station.nameZh
    return `Station ${stationId}`
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
