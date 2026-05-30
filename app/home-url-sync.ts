import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { KmbPaneState } from '@/components/eta/panes/kmb-pane'
import type { LrtPaneState } from '@/components/eta/panes/lrt-pane'
import type { MtrPaneState } from '@/components/eta/panes/mtr-pane'
import { decodeUrlState, encodeUrlState } from '@/lib/eta/url-state'
import type { FavoritesItem } from '@/lib/store'
import type { RouteFilterMode, TransportMode } from '@/lib/store'
import type { UiLanguage } from '@/lib/eta/types'
import { isLanguageSupported } from '@/lib/eta/types'

type UseHomeUrlSyncParams = {
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
}

export function useHomeUrlSync({
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
}: UseHomeUrlSyncParams) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const didHydrateFromUrlRef = React.useRef(false)
  const lastEncodedRef = React.useRef<string>('')

  // Hydrate from URL on mount
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
    didHydrateFromUrlRef.current = true
    lastEncodedRef.current = search
  }, [searchParams, setAutoRefreshSeconds, setLang, setMode, setRouteFilterMode])

  // Sync URL when state changes
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

  return { didHydrateFromUrlRef, lastEncodedRef }
}

export function useHomeLanguageFix(
  mode: TransportMode,
  lang: UiLanguage,
  setLang: (lang: UiLanguage) => void
) {
  React.useEffect(() => {
    if (isLanguageSupported(mode, lang)) return
    setLang('tc')
  }, [lang, mode, setLang])
}

export function useHomeSelectedItem() {
  return React.useState<FavoritesItem | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const decoded = decodeUrlState(window.location.search.slice(1))
      return decoded.selectedItem ?? null
    } catch {
      return null
    }
  })
}
