'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { decodeUrlState, encodeUrlState } from '@/lib/eta/url-state'
import type { KmbPaneState } from '@/components/eta/panes/kmb-pane'
import type { LrtPaneState } from '@/components/eta/panes/lrt-pane'
import type { MtrPaneState } from '@/components/eta/panes/mtr-pane'
import type { FavoritesItem, RouteFilterMode } from '@/lib/store'
import type { TransportMode, UiLanguage } from '@/lib/eta/types'

type Params = {
  mode: TransportMode
  lang: UiLanguage
  routeFilterMode: RouteFilterMode
  autoRefreshSeconds: number
  kmbPaneState: KmbPaneState | null
  mtrPaneState: MtrPaneState | null
  lrtPaneState: LrtPaneState | null
  setMode: (mode: TransportMode) => void
  setLang: (lang: UiLanguage) => void
  setRouteFilterMode: (mode: RouteFilterMode) => void
  setAutoRefreshSeconds: (seconds: number) => void
  setSelectedItem: React.Dispatch<React.SetStateAction<FavoritesItem | null>>
}

export function useUrlStateSync(params: Params) {
  const {
    mode,
    lang,
    routeFilterMode,
    autoRefreshSeconds,
    kmbPaneState,
    mtrPaneState,
    lrtPaneState,
    setMode,
    setLang,
    setRouteFilterMode,
    setAutoRefreshSeconds,
    setSelectedItem,
  } = params

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const didHydrateFromUrlRef = React.useRef(false)
  const lastEncodedRef = React.useRef<string>('')

  React.useEffect(() => {
    if (didHydrateFromUrlRef.current) return

    const search = searchParams?.toString() ?? ''
    const decoded = decodeUrlState(search)
    if (decoded.state.mode) {
      setMode(decoded.state.mode)
    } else if (decoded.selectedItem) {
      setMode(decoded.selectedItem.mode)
    }
    if (decoded.state.lang) setLang(decoded.state.lang)
    if (decoded.state.routeFilterMode) setRouteFilterMode(decoded.state.routeFilterMode)
    if (decoded.state.autoRefreshSeconds !== undefined) {
      setAutoRefreshSeconds(decoded.state.autoRefreshSeconds)
    }
    if (decoded.selectedItem) setSelectedItem(decoded.selectedItem)

    didHydrateFromUrlRef.current = true
    lastEncodedRef.current = search
  }, [searchParams, setAutoRefreshSeconds, setLang, setMode, setRouteFilterMode, setSelectedItem])

  React.useEffect(() => {
    if (!didHydrateFromUrlRef.current) return

    const kmbQuery = kmbPaneState?.querySummary ?? null
    const query = encodeUrlState({
      mode,
      lang,
      routeFilterMode,
      autoRefreshSeconds,
      kmb: kmbQuery
        ? {
            query: kmbQuery,
            routeFilter: kmbPaneState?.routeFilter ?? null,
          }
        : null,
      mtr: { sta: mtrPaneState?.sta ?? null },
      lrt: { stationId: lrtPaneState?.stationId ?? null },
    })

    if (query === lastEncodedRef.current) return
    lastEncodedRef.current = query

    const nextUrl = query ? `${pathname}?${query}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [
    autoRefreshSeconds,
    kmbPaneState?.querySummary,
    kmbPaneState?.routeFilter,
    lang,
    lrtPaneState?.stationId,
    mode,
    mtrPaneState?.sta,
    pathname,
    routeFilterMode,
    router,
  ])
}
