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
  const lastHydratedSearchRef = React.useRef<string | null>(null)
  const pendingOwnWriteRef = React.useRef<string | null>(null)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const applyDecodedUrl = React.useCallback(
    (search: string) => {
      const decoded = decodeUrlState(search)
      const nextMode = decoded.state.mode ?? decoded.selectedItem?.mode
      if (nextMode) setMode(nextMode)
      if (decoded.state.subView) setSubView(decoded.state.subView)
      // decode never populates lang, routeFilterMode, or autoRefreshSeconds:
      // hydrate applies nav only so a shared link never overwrites prefs.
      // Decoded ids are deterministic, so re-hydrating the same URL keeps
      // the existing selection object instead of churning pane restores.
      setSelectedItem((prev) =>
        prev?.id === decoded.selectedItem?.id ? prev : decoded.selectedItem
      )
      // Seed with the canonical nav-only encoding of the decoded state so
      // the encode effect skips its first replace until pane snapshots load.
      lastEncodedRef.current = encodeUrlState({
        mode: decoded.state.mode ?? mode,
        subView: decoded.state.subView ?? subView,
        lang,
        routeFilterMode,
        autoRefreshSeconds,
        kmb: null,
        mtr: { sta: null },
        lrt: { stationId: null },
      })
      didHydrateFromUrlRef.current = true
    },
    [autoRefreshSeconds, lang, mode, routeFilterMode, setMode, setSelectedItem, setSubView, subView]
  )

  React.useEffect(() => {
    const search = searchParams?.toString() ?? ''
    // Writes from our own router.replace land here: consume and skip so we
    // never re-hydrate (and degrade) the selection we just encoded.
    if (pendingOwnWriteRef.current !== null) {
      if (search === pendingOwnWriteRef.current) {
        pendingOwnWriteRef.current = null
        lastHydratedSearchRef.current = search
        didHydrateFromUrlRef.current = true
        return
      }
      pendingOwnWriteRef.current = null
    }
    // Same URL (e.g. store updates re-running this effect): nothing to do.
    // Anything else is external: initial load or back/forward navigation.
    if (search === lastHydratedSearchRef.current) return
    lastHydratedSearchRef.current = search
    applyDecodedUrl(search)
  }, [applyDecodedUrl, searchParams])

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
    pendingOwnWriteRef.current = query

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
