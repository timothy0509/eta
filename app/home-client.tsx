'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'

import { BottomNav, SideRail, TopAppBar } from '@/components/eta/app-shell'
import { PaneSkeleton } from '@/components/eta/pane-skeleton'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { decodeUrlState, encodeUrlState, type UrlEncodeInput } from '@/lib/eta/url-state'
import type {
  LrtStationSearchItem,
  MtrStationSearchItem,
  SubView,
  TransportMode,
  UiLanguage,
} from '@/lib/eta/types'
import { isLanguageSupported } from '@/lib/eta/types'
import { useAutoRefresh } from '@/lib/eta/use-auto-refresh'
import { clearKmbStopNameCache } from '@/lib/eta/kmb-stop-name'
import { getMtrLineName } from '@/lib/eta/line-colors'
import { initWebVitalsSampler } from '@/lib/eta/perf'
import { registerServiceWorker } from '@/lib/eta/sw-register'
import { usePaneStore } from '@/lib/eta/pane-store'
import { useAppStore, type FavoritesItem } from '@/lib/store'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useShallow } from 'zustand/shallow'

const KmbPane = dynamic(
  () => import('@/components/eta/panes/kmb-pane').then((mod) => mod.KmbPane),
  { loading: () => <PaneSkeleton />, ssr: false }
)
const MtrPane = dynamic(
  () => import('@/components/eta/panes/mtr-pane').then((mod) => mod.MtrPane),
  { loading: () => <PaneSkeleton />, ssr: false }
)
const LrtPane = dynamic(
  () => import('@/components/eta/panes/lrt-pane').then((mod) => mod.LrtPane),
  { loading: () => <PaneSkeleton />, ssr: false }
)

const KmbResults = dynamic(
  () => import('@/components/eta/results-kmb').then((mod) => ({ default: mod.KmbResults })),
  { loading: () => <ResultsSkeleton />, ssr: false }
)
const MtrResults = dynamic(
  () => import('@/components/eta/results-mtr').then((mod) => ({ default: mod.MtrResults })),
  { loading: () => <ResultsSkeleton />, ssr: false }
)
const LrtResults = dynamic(
  () => import('@/components/eta/results-lrt').then((mod) => ({ default: mod.LrtResults })),
  { loading: () => <ResultsSkeleton />, ssr: false }
)

const FavoritesAndRecents = dynamic(
  () =>
    import('@/components/eta/favorites').then((mod) => ({
      default: mod.FavoritesAndRecents,
    })),
  { loading: () => <ResultsSkeleton />, ssr: false }
)
const KmbRoutesView = dynamic(
  () =>
    import('@/components/eta/views/kmb-routes-view').then((mod) => ({
      default: mod.KmbRoutesView,
    })),
  { loading: () => <ResultsSkeleton />, ssr: false }
)
const MtrRoutesView = dynamic(
  () =>
    import('@/components/eta/views/mtr-routes-view').then((mod) => ({
      default: mod.MtrRoutesView,
    })),
  { loading: () => <ResultsSkeleton />, ssr: false }
)
const LrtRoutesView = dynamic(
  () =>
    import('@/components/eta/views/lrt-routes-view').then((mod) => ({
      default: mod.LrtRoutesView,
    })),
  { loading: () => <ResultsSkeleton />, ssr: false }
)
const NearbyView = dynamic(
  () => import('@/components/eta/views/nearby-view').then((mod) => ({ default: mod.NearbyView })),
  { loading: () => <ResultsSkeleton />, ssr: false }
)
const SettingsView = dynamic(
  () =>
    import('@/components/eta/views/settings-view').then((mod) => ({
      default: mod.SettingsView,
    })),
  { loading: () => <ResultsSkeleton />, ssr: false }
)

const useAppStoreState = () =>
  useAppStore(
    useShallow((s) => ({
      mode: s.mode,
      subView: s.subView,
      lang: s.lang,
      routeFilterMode: s.routeFilterMode,
      autoRefreshSeconds: s.autoRefreshSeconds,
    }))
  )

const useAppStoreActions = () =>
  useAppStore(
    useShallow((s) => ({
      setMode: s.setMode,
      setSubView: s.setSubView,
      setLang: s.setLang,
      setRouteFilterMode: s.setRouteFilterMode,
      setAutoRefreshSeconds: s.setAutoRefreshSeconds,
      addFavorite: s.addFavorite,
      addRecent: s.addRecent,
    }))
  )

function KmbResultsFromStore({ fallbackLang }: { fallbackLang: UiLanguage }) {
  const data = usePaneStore(
    useShallow((s) =>
      !s.kmb
        ? null
        : {
            lang: s.kmb.lang,
            title: s.kmb.title,
            stopCode: s.kmb.stopCode,
            routes: s.kmb.routeFilter.routes,
            eta: s.kmb.eta,
            routeInfos: s.kmb.routeInfos,
            faresByVariantKey: s.kmb.faresByVariantKey,
            hasQuery: s.kmb.hasQuery,
            error: s.kmb.error,
            stale: s.kmb.stale,
            staleByStopId: s.kmb.staleByStopId,
            lastUpdatedAt: s.kmb.lastUpdatedAt,
            loading: s.kmb.loading,
            stops: s.kmb.stops,
            multipleStops: s.kmb.multipleStops,
            isKeyphraseMode: s.kmb.isKeyphraseMode,
            etaByStopId: s.kmb.etaByStopId,
            loadedStopIds: s.kmb.loadedStopIds,
            hasMoreStops: s.kmb.hasMoreStops,
            onLoadMore: s.kmb.onLoadMore,
            precomputedGroups: s.kmb.precomputedGroups,
            refresh: s.kmb.refresh,
          }
    )
  )
  const refreshFn = data?.refresh
  const onRefresh = React.useCallback(() => void refreshFn?.({ toastOnError: true }), [refreshFn])
  return (
    <KmbResults
      lang={data?.lang ?? fallbackLang}
      title={data?.title ?? ''}
      stopCode={data?.stopCode ?? null}
      routesFilter={data?.routes ?? ''}
      eta={data?.eta ?? []}
      routeInfos={data?.routeInfos ?? {}}
      faresByVariantKey={data?.faresByVariantKey ?? {}}
      hasQuery={data?.hasQuery ?? false}
      error={data?.error ?? null}
      stale={data?.stale ?? false}
      staleByStopId={data?.staleByStopId}
      lastUpdatedAt={data?.lastUpdatedAt}
      onRefresh={onRefresh}
      loading={data?.loading}
      stops={data?.stops ?? undefined}
      multipleStops={data?.multipleStops}
      isKeyphraseMode={data?.isKeyphraseMode}
      etaByStopId={data?.etaByStopId}
      loadedStopIds={data?.loadedStopIds}
      hasMoreStops={data?.hasMoreStops}
      onLoadMore={data?.onLoadMore}
      precomputedGroups={data?.precomputedGroups}
    />
  )
}

function MtrResultsFromStore({ fallbackLang }: { fallbackLang: UiLanguage }) {
  const data = usePaneStore(
    useShallow((s) =>
      !s.mtr
        ? null
        : {
            title: s.mtr.title,
            lang: s.mtr.lang,
            schedule: s.mtr.schedule,
            error: s.mtr.error,
            stale: s.mtr.stale,
            lastUpdatedAt: s.mtr.lastUpdatedAt,
            loading: s.mtr.loading,
            onRefresh: s.mtr.onRefresh,
          }
    )
  )
  const onRefreshFn = data?.onRefresh
  const onRefresh = React.useCallback(() => {
    onRefreshFn?.()
  }, [onRefreshFn])
  return (
    <MtrResults
      title={data?.title ?? ''}
      lang={data?.lang ?? fallbackLang}
      schedule={data?.schedule ?? null}
      error={data?.error ?? null}
      stale={data?.stale ?? false}
      lastUpdatedAt={data?.lastUpdatedAt ?? null}
      onRefresh={onRefresh}
      loading={data?.loading}
    />
  )
}

function LrtResultsFromStore({ fallbackLang }: { fallbackLang: UiLanguage }) {
  const data = usePaneStore(
    useShallow((s) =>
      !s.lrt
        ? null
        : {
            title: s.lrt.title,
            lang: s.lrt.lang,
            schedule: s.lrt.schedule,
            stationId: s.lrt.stationId,
            error: s.lrt.error,
            stale: s.lrt.stale,
            lastUpdatedAt: s.lrt.lastUpdatedAt,
            loading: s.lrt.loading,
            onRefresh: s.lrt.onRefresh,
          }
    )
  )
  const onRefreshFn = data?.onRefresh
  const onRefresh = React.useCallback(() => {
    onRefreshFn?.()
  }, [onRefreshFn])
  return (
    <LrtResults
      title={data?.title ?? ''}
      lang={data?.lang ?? fallbackLang}
      schedule={data?.schedule ?? null}
      hasStation={Boolean(data?.stationId)}
      error={data?.error ?? null}
      stale={data?.stale ?? false}
      lastUpdatedAt={data?.lastUpdatedAt ?? null}
      onRefresh={onRefresh}
      loading={data?.loading}
    />
  )
}

export default function HomeClient() {
  const { mode, subView, lang, routeFilterMode, autoRefreshSeconds } = useAppStoreState()
  const {
    setMode,
    setSubView,
    setLang,
    setRouteFilterMode,
    setAutoRefreshSeconds,
    addFavorite,
    addRecent,
  } = useAppStoreActions()

  const setKmbStops = usePaneStore((s) => s.setKmbStops)

  const [selectedItem, setSelectedItem] = React.useState<FavoritesItem | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const decoded = decodeUrlState(window.location.search.slice(1))
      return decoded.selectedItem ?? null
    } catch {
      return null
    }
  })

  const canFavoriteRef = React.useRef(false)
  const didHydrateFromUrlRef = React.useRef(false)
  const lastEncodedRef = React.useRef<string>('')

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Narrow URL-only selectors so ETA map updates do not rerender the shell.
  // Heavy ETA fields stay subscribed inside Kmb/Mtr/LrtResultsFromStore.
  const kmbQuerySummary = usePaneStore((s) => s.kmb?.querySummary ?? null)
  const kmbRouteFilter = usePaneStore((s) => s.kmb?.routeFilter ?? null)
  const mtrSta = usePaneStore((s) => s.mtr?.sta ?? null)
  const lrtStationId = usePaneStore((s) => s.lrt?.stationId ?? null)

  const [mtrStations, setMtrStations] = React.useState<MtrStationSearchItem[]>([])
  const [lrtStations, setLrtStations] = React.useState<LrtStationSearchItem[]>([])

  React.useEffect(() => {
    if (mode !== 'mtr') return
    let cancelled = false
    import('@/lib/data/mtr-stations')
      .then((mod) => {
        if (cancelled) return
        setMtrStations(
          mod.MTR_STATIONS.map((s) => ({
            labelId: s.sta,
            sta: s.sta,
            lines: [...s.lines],
            nameEn: s.nameEn,
            nameTc: s.nameTc,
          }))
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [mode])

  React.useEffect(() => {
    if (mode !== 'lrt') return
    let cancelled = false
    import('@/lib/data/lrt-stations')
      .then((mod) => {
        if (cancelled) return
        setLrtStations(
          mod.LRT_STATIONS.map((s) => ({
            stationId: s.stationId,
            nameEn: s.nameEn,
            nameZh: s.nameZh,
          }))
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [mode])

  React.useEffect(() => {
    clearKmbStopNameCache()
  }, [lang])

  React.useEffect(() => {
    import('@/lib/eta/prefetch').then((mod) => mod.prefetchEtaDb()).catch(() => {})
    registerServiceWorker()
  }, [])

  React.useEffect(() => {
    if (isLanguageSupported(mode, lang)) return
    setLang('tc')
  }, [lang, mode, setLang])

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
    if (decoded.state.lang) setLang(decoded.state.lang)
    if (decoded.state.routeFilterMode) setRouteFilterMode(decoded.state.routeFilterMode)
    if (decoded.state.autoRefreshSeconds !== undefined) {
      setAutoRefreshSeconds(decoded.state.autoRefreshSeconds)
    }
    didHydrateFromUrlRef.current = true
    lastEncodedRef.current = search
  }, [searchParams, setAutoRefreshSeconds, setLang, setMode, setRouteFilterMode, setSubView])

  const refreshRef = React.useRef<Partial<Record<TransportMode, () => Promise<void>>>>({})
  const inFlightRefreshRef = React.useRef(false)
  const refreshTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const MAX_REFRESH_DURATION_MS = 30_000

  const onRegisterRefresh = React.useCallback(
    (transportMode: TransportMode, refresh: () => Promise<void>) => {
      refreshRef.current[transportMode] = refresh
    },
    []
  )

  // Mirrors so the auto-refresh timer only resets when the interval changes,
  // not on every mode/subView render.
  const modeRef = React.useRef(mode)
  const subViewRef = React.useRef(subView)
  React.useEffect(() => {
    modeRef.current = mode
  }, [mode])
  React.useEffect(() => {
    subViewRef.current = subView
  }, [subView])

  // Sample LCP/INP/CLS once per page load (10%, skips saveData). Reads mode
  // through refs so tab switches never resubscribe the observers.
  React.useEffect(() => {
    const cleanup = initWebVitalsSampler({
      mode: modeRef.current,
      subView: subViewRef.current,
    })
    return cleanup
  }, [])

  const autoRefreshCallback = React.useCallback(() => {
    if (subViewRef.current !== 'stops') return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const refresh = refreshRef.current[modeRef.current]
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
      .catch(() => {})
      .finally(() => {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current)
          refreshTimeoutRef.current = null
        }
        inFlightRefreshRef.current = false
      })
  }, [])

  useAutoRefresh(autoRefreshSeconds * 1000, autoRefreshCallback)

  const onRegisterKmbRefresh = React.useCallback(
    (refresh: () => Promise<void>) => onRegisterRefresh('kmb', refresh),
    [onRegisterRefresh]
  )
  const onRegisterMtrRefresh = React.useCallback(
    (refresh: () => Promise<void>) => onRegisterRefresh('mtr', refresh),
    [onRegisterRefresh]
  )
  const onRegisterLrtRefresh = React.useCallback(
    (refresh: () => Promise<void>) => onRegisterRefresh('lrt', refresh),
    [onRegisterRefresh]
  )

  React.useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    }
  }, [])

  const onModeChange = React.useCallback(
    (nextMode: TransportMode) => {
      setMode(nextMode)
    },
    [setMode]
  )

  const onSubViewChange = React.useCallback(
    (nextSubView: SubView) => {
      setSubView(nextSubView)
    },
    [setSubView]
  )

  const onSelectFromLists = React.useCallback(
    (item: FavoritesItem) => {
      setSelectedItem(item)
      setMode(item.mode)
      if (item.mode === 'kmb' && 'routeFilterMode' in item) {
        setRouteFilterMode(item.routeFilterMode ?? 'simple')
      }
      if (item.mode === 'kmb' && 'type' in item && item.type === 'route') {
        setSubView('routes')
      } else {
        setSubView('stops')
      }
    },
    [setMode, setRouteFilterMode, setSubView]
  )

  const kmbRouteInitialSelection = React.useMemo(() => {
    if (selectedItem?.mode === 'kmb' && 'type' in selectedItem && selectedItem.type === 'route') {
      return {
        co: selectedItem.co ?? 'kmb',
        route: selectedItem.route,
        bound: selectedItem.bound,
        serviceType: selectedItem.serviceType,
      }
    }
    return undefined
  }, [selectedItem])

  const onSelectStopGroupFromRoute = React.useCallback(
    ({ stopIds, title, route }: { stopIds: string[]; title: string; route: string }) => {
      const item: FavoritesItem = {
        id: `kmb:stops:${stopIds.join(',')}:${route}`,
        mode: 'kmb',
        title,
        stopIds,
        route,
        routeFilterMode: 'simple',
      }
      setSelectedItem(item)
      setMode('kmb')
      setSubView('stops')
    },
    [setMode, setSubView]
  )

  const onSelectMtrStationFromRoute = React.useCallback(
    (sta: string, line: string, name: string) => {
      const station = mtrStations.find((s) => s.sta === sta)
      const title = station
        ? `${lang === 'en' ? station.nameEn : station.nameTc} · ${station.lines.map((l) => getMtrLineName(l, lang)).join('/')}/${station.sta}`
        : `${name} · ${line}/${sta}`
      const item: FavoritesItem = {
        id: `mtr:${sta}`,
        mode: 'mtr',
        title,
        line: station?.lines[0] ?? line,
        sta,
      }
      setSelectedItem(item)
      setMode('mtr')
      setSubView('stops')
    },
    [lang, mtrStations, setMode, setSubView]
  )

  const onSelectLrtStationFromRoute = React.useCallback(
    (stationId: string, name: string) => {
      const station = lrtStations.find((s) => s.stationId === stationId)
      const title = station
        ? `${lang === 'en' ? station.nameEn : station.nameZh} · ${station.stationId}`
        : `${name} · ${stationId}`
      const item: FavoritesItem = {
        id: `lrt:${stationId}`,
        mode: 'lrt',
        title,
        stationId,
      }
      setSelectedItem(item)
      setMode('lrt')
      setSubView('stops')
    },
    [lang, lrtStations, setMode, setSubView]
  )

  const urlInput: UrlEncodeInput = React.useMemo(
    () => ({
      mode,
      subView,
      lang,
      routeFilterMode,
      autoRefreshSeconds,
      kmb: kmbQuerySummary
        ? {
            query: kmbQuerySummary,
            routeFilter: kmbRouteFilter,
          }
        : null,
      mtr: { sta: mtrSta },
      lrt: { stationId: lrtStationId },
    }),
    [
      autoRefreshSeconds,
      kmbQuerySummary,
      kmbRouteFilter,
      lang,
      lrtStationId,
      mode,
      mtrSta,
      routeFilterMode,
      subView,
    ]
  )

  const pendingQueryRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!didHydrateFromUrlRef.current) return

    // Debounce URL writes by 400ms so rapid pane updates do not churn history.
    pendingQueryRef.current = encodeUrlState(urlInput)
    const id = setTimeout(() => {
      const query = pendingQueryRef.current
      pendingQueryRef.current = null
      if (query === null || query === lastEncodedRef.current) return
      lastEncodedRef.current = query

      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, 400)
    return () => clearTimeout(id)
  }, [urlInput, pathname, router])

  // Flush a pending debounced URL write on fast close so it is not dropped.
  // history.replaceState is synchronous; router.replace may not finish on pagehide.
  React.useEffect(() => {
    const flush = () => {
      const pending = pendingQueryRef.current
      if (pending === null || pending === lastEncodedRef.current) return
      lastEncodedRef.current = pending
      const base = window.location.pathname
      window.history.replaceState(null, '', pending ? `${base}?${pending}` : base)
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  // Back/forward changes the URL without touching store state, so sync the
  // shareable fields back in. router.replace writes never fire popstate, so
  // this cannot loop with the debounced writer above.
  React.useEffect(() => {
    const onPopState = () => {
      const search = window.location.search.startsWith('?')
        ? window.location.search.slice(1)
        : window.location.search
      lastEncodedRef.current = search
      pendingQueryRef.current = null
      const decoded = decodeUrlState(search)
      if (decoded.state.mode) setMode(decoded.state.mode)
      if (decoded.state.subView) setSubView(decoded.state.subView)
      if (decoded.state.lang) setLang(decoded.state.lang)
      if (decoded.state.routeFilterMode) setRouteFilterMode(decoded.state.routeFilterMode)
      if (decoded.state.autoRefreshSeconds !== undefined) {
        setAutoRefreshSeconds(decoded.state.autoRefreshSeconds)
      }
      setSelectedItem(decoded.selectedItem ?? null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [setAutoRefreshSeconds, setLang, setMode, setRouteFilterMode, setSubView])

  const controls = (
    <div className="space-y-4">
      {mode === 'kmb' && (
        <KmbPane
          lang={lang}
          routeFilterMode={routeFilterMode}
          onRouteFilterModeChange={setRouteFilterMode}
          onAddRecent={addRecent}
          onAddFavorite={addFavorite}
          canFavoriteRef={canFavoriteRef}
          selectedItem={selectedItem}
          onRegisterRefresh={onRegisterKmbRefresh}
          onStopsChange={setKmbStops}
        />
      )}
      {mode === 'mtr' && (
        <MtrPane
          lang={lang}
          stations={mtrStations}
          onAddRecent={addRecent}
          onAddFavorite={addFavorite}
          canFavoriteRef={canFavoriteRef}
          onRegisterRefresh={onRegisterMtrRefresh}
          selectedItem={selectedItem}
        />
      )}
      {mode === 'lrt' && (
        <LrtPane
          lang={lang}
          stations={lrtStations}
          onAddRecent={addRecent}
          onAddFavorite={addFavorite}
          canFavoriteRef={canFavoriteRef}
          onRegisterRefresh={onRegisterLrtRefresh}
          selectedItem={selectedItem}
        />
      )}
    </div>
  )

  const results = (
    <>
      {mode === 'kmb' && <KmbResultsFromStore fallbackLang={lang} />}
      {mode === 'mtr' && <MtrResultsFromStore fallbackLang={lang} />}
      {mode === 'lrt' && <LrtResultsFromStore fallbackLang={lang} />}
    </>
  )

  const renderStops = () => {
    return (
      <div className="ui-animate-fade mx-auto max-w-[1280px] lg:grid lg:grid-cols-[360px_1fr] lg:items-start lg:gap-6">
        <div className="lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100dvh-5.5rem)] lg:[scrollbar-width:thin] lg:overflow-y-auto lg:pr-1">
          <div className="card-m3 p-4 sm:p-5 lg:p-5">{controls}</div>
        </div>

        <div className="ui-animate-fade ui-stagger-1 relative mt-4 lg:mt-0">
          <div className="bg-surface-container-lowest relative overflow-hidden rounded-3xl border border-[var(--outline-variant)]/15 p-4 shadow-sm sm:p-6">
            <span className="bg-primary absolute top-0 right-0 left-0 h-[3px]" aria-hidden />
            {results}
          </div>
        </div>
      </div>
    )
  }

  const renderRoutes = () => {
    if (mode === 'kmb')
      return (
        <KmbRoutesView
          lang={lang}
          initialSelection={kmbRouteInitialSelection}
          onSelectStopGroup={onSelectStopGroupFromRoute}
        />
      )
    if (mode === 'mtr')
      return <MtrRoutesView lang={lang} onSelectStation={onSelectMtrStationFromRoute} />
    return <LrtRoutesView lang={lang} onSelectStation={onSelectLrtStationFromRoute} />
  }

  const renderContent = () => {
    switch (subView) {
      case 'routes':
        return renderRoutes()
      case 'stops':
        return renderStops()
      case 'nearby':
        return (
          <NearbyView
            lang={lang}
            mode={mode}
            onSelectStopGroup={onSelectStopGroupFromRoute}
            onSelectMtrStation={onSelectMtrStationFromRoute}
            onSelectLrtStation={onSelectLrtStationFromRoute}
          />
        )
      case 'saved':
        return (
          <div className="ui-animate-fade">
            <FavoritesAndRecents lang={lang} onSelect={onSelectFromLists} />
          </div>
        )
      case 'settings':
        return <SettingsView lang={lang} />
      default:
        return renderStops()
    }
  }

  return (
    <div className="bg-surface min-h-dvh overflow-x-clip pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      <TopAppBar lang={lang} mode={mode} onModeChange={onModeChange} />

      <div className="mx-auto flex max-w-[1280px] gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <SideRail lang={lang} subView={subView} onSubViewChange={onSubViewChange} />

        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1100px]">{renderContent()}</div>
        </div>
      </div>

      <BottomNav lang={lang} subView={subView} onSubViewChange={onSubViewChange} />
    </div>
  )
}
