'use client'

import * as React from 'react'

import { decodeUrlState, encodeUrlState, type KmbQuerySummary } from '@/lib/eta/url-state'
import { useAppStore, type FavoritesItem } from '@/lib/store'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useShallow } from 'zustand/shallow'

export type UrlSyncPaneBits = {
  kmbQuery: KmbQuerySummary | null
  kmbRouteFilter: {
    routes?: string
    entries?: { variantKey: string }[]
  } | null
  mtrSta: string | null | undefined
  lrtStationId: string | null | undefined
}

/**
 * Owns URL hydration (decode-on-mount into nav state only) and URL encoding
 * (encode-on-change back to the address bar). Prefs such as lang, filter
 * mode, and refresh interval are never read from or written to the URL, so
 * a shared link never overwrites saved preferences. Pane-store snapshots
 * arrive as arguments so this hook is the only place that couples pane
 * state to the URL.
 */
export function useUrlSync({ kmbQuery, kmbRouteFilter, mtrSta, lrtStationId }: UrlSyncPaneBits) {
  // lang, routeFilterMode, and autoRefreshSeconds are read only to satisfy
  // the encode input shape. They are never written from the URL and never
  // encoded without includePrefs, so prefs stay out of the address bar.
  const { mode, subView, lang, routeFilterMode, autoRefreshSeconds } = useAppStore(
    useShallow((s) => ({
      mode: s.mode,
      subView: s.subView,
      lang: s.lang,
      routeFilterMode: s.routeFilterMode,
      autoRefreshSeconds: s.autoRefreshSeconds,
    }))
  )
  const { setMode, setSubView } = useAppStore(
    useShallow((s) => ({
      setMode: s.setMode,
      setSubView: s.setSubView,
    }))
  )

  const [selectedItem, setSelectedItem] = React.useState<FavoritesItem | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const decoded = decodeUrlState(window.location.search.slice(1))
      return decoded.selectedItem ?? null
    } catch {
      return null
    }
  })

  const didHydrateFromUrlRef = React.useRef(false)
  const lastEncodedRef = React.useRef<string>('')

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  React.useEffect(() => {
    if (didHydrateFromUrlRef.current) return

    const search = searchParams?.toString() ?? ''
    const decoded = decodeUrlState(search)
    if (decoded.state.mode) {
      setMode(decoded.state.mode)
    } else if (decoded.selectedItem) {
      setMode(decoded.selectedItem.mode)
    }
    if (decoded.state.subView) setSubView(decoded.state.subView)
    // decode never populates lang, routeFilterMode, or autoRefreshSeconds:
    // hydrate applies nav only so a shared link never overwrites prefs.
    didHydrateFromUrlRef.current = true
    lastEncodedRef.current = search
  }, [searchParams, setMode, setSubView])

  React.useEffect(() => {
    if (!didHydrateFromUrlRef.current) return

    const query = encodeUrlState({
      mode,
      subView,
      lang,
      routeFilterMode,
      autoRefreshSeconds,
      kmb: kmbQuery
        ? {
            query: kmbQuery,
            routeFilter: kmbRouteFilter ?? null,
          }
        : null,
      mtr: { sta: mtrSta ?? null },
      lrt: { stationId: lrtStationId ?? null },
    })

    if (query === lastEncodedRef.current) return
    lastEncodedRef.current = query

    const nextUrl = query ? `${pathname}?${query}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [
    autoRefreshSeconds,
    kmbQuery,
    kmbRouteFilter,
    lang,
    lrtStationId,
    mode,
    mtrSta,
    pathname,
    routeFilterMode,
    router,
    subView,
  ])

  return { selectedItem, setSelectedItem }
}
