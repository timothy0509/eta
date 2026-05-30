import * as React from 'react'

import { useAutoRefresh } from '@/lib/eta/use-auto-refresh'

export function useHomeAutoRefresh(autoRefreshSeconds: number) {
  const refreshRef = React.useRef<(() => Promise<void>) | null>(null)
  const inFlightRefreshRef = React.useRef(false)
  const refreshTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const MAX_REFRESH_DURATION_MS = 30_000

  const onRegisterRefresh = React.useCallback((refresh: () => Promise<void>) => {
    refreshRef.current = refresh
  }, [])

  useAutoRefresh(autoRefreshSeconds * 1000, () => {
    if (!refreshRef.current) return
    if (inFlightRefreshRef.current) return

    inFlightRefreshRef.current = true

    refreshTimeoutRef.current = setTimeout(() => {
      if (inFlightRefreshRef.current) {
        console.warn('Auto-refresh timeout - forcing unlock')
        inFlightRefreshRef.current = false
      }
    }, MAX_REFRESH_DURATION_MS)

    refreshRef
      .current()
      .catch(() => {
        // ignore auto-refresh errors
      })
      .finally(() => {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current)
          refreshTimeoutRef.current = null
        }
        inFlightRefreshRef.current = false
      })
  })

  React.useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  return { onRegisterRefresh }
}
