'use client'

import * as React from 'react'

import { useAutoRefresh } from '@/lib/eta/use-auto-refresh'
import type { SubView, TransportMode } from '@/lib/eta/types'

const MAX_REFRESH_DURATION_MS = 30_000

type Params = {
  mode: TransportMode
  subView: SubView
  autoRefreshSeconds: number
}

/**
 * Owns the per-mode refresh registry plus the auto-refresh loop.
 * Panes register their refresh fn, the loop invokes the active mode.
 */
export function useRefreshRegistry({ mode, subView, autoRefreshSeconds }: Params) {
  const refreshRef = React.useRef<Partial<Record<TransportMode, () => Promise<void>>>>({})
  const inFlightRefreshRef = React.useRef(false)
  const refreshTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const onRegisterRefresh = React.useCallback(
    (transportMode: TransportMode, refresh: () => Promise<void>) => {
      refreshRef.current[transportMode] = refresh
    },
    []
  )

  useAutoRefresh(
    autoRefreshSeconds * 1000,
    React.useCallback(() => {
      if (subView !== 'stops') return
      const refresh = refreshRef.current[mode]
      if (!refresh) return
      if (inFlightRefreshRef.current) return

      inFlightRefreshRef.current = true
      refreshTimeoutRef.current = setTimeout(() => {
        if (inFlightRefreshRef.current) {
          console.warn('Auto-refresh timeout - forcing unlock')
          inFlightRefreshRef.current = false
        }
      }, MAX_REFRESH_DURATION_MS)

      refresh()
        .catch((err) => {
          console.debug('Auto-refresh failed:', err)
        })
        .finally(() => {
          if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current)
            refreshTimeoutRef.current = null
          }
          inFlightRefreshRef.current = false
        })
    }, [mode, subView])
  )

  React.useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    }
  }, [])

  return { onRegisterRefresh }
}
