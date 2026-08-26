'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'

import { BottomNav, SideRail, TopAppBar } from '@/components/eta/app-shell'
import { PaneSkeleton } from '@/components/eta/pane-skeleton'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { FadeIn } from '@/components/m3/motion'
import { LRT_STATIONS } from '@/lib/data/lrt-stations'
import { MTR_STATIONS } from '@/lib/data/mtr-stations'
import { decodeUrlState, encodeUrlState } from '@/lib/eta/url-state'
import type {
  LrtStationSearchItem,
  MtrStationSearchItem,
  SubView,
  TransportMode,
} from '@/lib/eta/types'
import { isLanguageSupported } from '@/lib/eta/types'
import { useAutoRefresh } from '@/lib/eta/use-auto-refresh'
import { clearKmbStopNameCache } from '@/lib/eta/kmb-stop-name'
import { getMtrLineName } from '@/lib/eta/line-colors'
import { prefetchEtaDb } from '@/lib/eta/prefetch'
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

  const kmbPaneState = usePaneStore(
    useShallow((s) =>
      mode !== 'kmb' || !s.kmb
        ? null
        : {
            lang: s.kmb.lang,
            title: s.kmb.title,
            stopCode: s.kmb.stopCode,
            routeFilter: s.kmb.routeFilter,
            eta: s.kmb.eta,
            routeInfos: s.kmb.routeInfos,
            faresByVariantKey: s.kmb.faresByVariantKey,
            hasQuery: s.kmb.hasQuery,
            error: s.kmb.error,
            stale: s.kmb.stale,
            lastUpdatedAt: s.kmb.lastUpdatedAt,
            loading: s.kmb.loading,
            stops: s.kmb.stops,
            multipleStops: s.kmb.multipleStops,
            isKeyphraseMode: s.kmb.isKeyphraseMode,
            etaByStopId: s.kmb.etaByStopId,
            loadedStopIds: s.kmb.loadedStopIds,
            sentinelRef: s.kmb.sentinelRef,
            hasMoreStops: s.kmb.hasMoreStops,
            precomputedGroups: s.kmb.precomputedGroups,
            querySummary: s.kmb.querySummary,
            refresh: s.kmb.refresh,
          }
    )
  )
  const mtrPaneState = usePaneStore(
    useShallow((s) =>
      mode !== 'mtr' || !s.mtr
        ? null
        : {
            title: s.mtr.title,
            lang: s.mtr.lang,
            schedule: s.mtr.schedule,
            error: s.mtr.error,
            stale: s.mtr.stale,
            lastUpdatedAt: s.mtr.lastUpdatedAt,
            loading: s.mtr.loading,
            sta: s.mtr.sta,
            onRefresh: s.mtr.onRefresh,
          }
    )
  )
  const lrtPaneState = usePaneStore(
    useShallow((s) =>
      mode !== 'lrt' || !s.lrt
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

  const mtrStations: MtrStationSearchItem[] = React.useMemo(
    () =>
      MTR_STATIONS.map((s) => ({
        labelId: s.sta,
        sta: s.sta,
        lines: [...s.lines],
        nameEn: s.nameEn,
        nameTc: s.nameTc,
      })),
    []
  )

  const lrtStations: LrtStationSearchItem[] = React.useMemo(
    () =>
      LRT_STATIONS.map((s) => ({
        stationId: s.stationId,
        nameEn: s.nameEn,
        nameZh: s.nameZh,
      })),
    []
  )

  React.useEffect(() => {
    clearKmbStopNameCache()
  }, [lang])

  React.useEffect(() => {
    prefetchEtaDb()
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
        .catch(() => {})
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

  React.useEffect(() => {
    if (!didHydrateFromUrlRef.current) return

    const kmbQuery = kmbPaneState?.querySummary ?? null
    const query = encodeUrlState({
      mode,
      subView,
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
    subView,
  ])

  const kmbOnRefresh = React.useCallback(
    () => void kmbPaneState?.refresh({ toastOnError: true }),
    [kmbPaneState]
  )
  const mtrOnRefresh = React.useCallback(() => {
    mtrPaneState?.onRefresh?.()
  }, [mtrPaneState])
  const lrtOnRefresh = React.useCallback(() => {
    lrtPaneState?.onRefresh?.()
  }, [lrtPaneState])

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
          onRegisterRefresh={(refresh) => onRegisterRefresh('kmb', refresh)}
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
          onRegisterRefresh={(refresh) => onRegisterRefresh('mtr', refresh)}
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
          onRegisterRefresh={(refresh) => onRegisterRefresh('lrt', refresh)}
          selectedItem={selectedItem}
        />
      )}
    </div>
  )

  const results = (
    <>
      {mode === 'kmb' && (
        <KmbResults
          lang={kmbPaneState?.lang ?? lang}
          title={kmbPaneState?.title ?? ''}
          stopCode={kmbPaneState?.stopCode ?? null}
          routesFilter={kmbPaneState?.routeFilter.routes ?? ''}
          eta={kmbPaneState?.eta ?? []}
          routeInfos={kmbPaneState?.routeInfos ?? {}}
          faresByVariantKey={kmbPaneState?.faresByVariantKey ?? {}}
          hasQuery={kmbPaneState?.hasQuery ?? false}
          error={kmbPaneState?.error ?? null}
          stale={kmbPaneState?.stale ?? false}
          lastUpdatedAt={kmbPaneState?.lastUpdatedAt}
          onRefresh={kmbOnRefresh}
          loading={kmbPaneState?.loading}
          stops={kmbPaneState?.stops ?? undefined}
          multipleStops={kmbPaneState?.multipleStops}
          isKeyphraseMode={kmbPaneState?.isKeyphraseMode}
          etaByStopId={kmbPaneState?.etaByStopId}
          loadedStopIds={kmbPaneState?.loadedStopIds}
          sentinelRef={kmbPaneState?.sentinelRef}
          hasMoreStops={kmbPaneState?.hasMoreStops}
          precomputedGroups={kmbPaneState?.precomputedGroups}
        />
      )}
      {mode === 'mtr' && (
        <MtrResults
          title={mtrPaneState?.title ?? ''}
          lang={mtrPaneState?.lang ?? lang}
          schedule={mtrPaneState?.schedule ?? null}
          error={mtrPaneState?.error ?? null}
          stale={mtrPaneState?.stale ?? false}
          lastUpdatedAt={mtrPaneState?.lastUpdatedAt ?? null}
          onRefresh={mtrOnRefresh}
          loading={mtrPaneState?.loading}
        />
      )}
      {mode === 'lrt' && (
        <LrtResults
          title={lrtPaneState?.title ?? ''}
          lang={lrtPaneState?.lang ?? lang}
          schedule={lrtPaneState?.schedule ?? null}
          hasStation={Boolean(lrtPaneState?.stationId)}
          error={lrtPaneState?.error ?? null}
          stale={lrtPaneState?.stale ?? false}
          lastUpdatedAt={lrtPaneState?.lastUpdatedAt ?? null}
          onRefresh={lrtOnRefresh}
          loading={lrtPaneState?.loading}
        />
      )}
    </>
  )

  const renderStops = () => {
    return (
      <FadeIn className="mx-auto max-w-[1280px] lg:grid lg:grid-cols-[360px_1fr] lg:items-start lg:gap-6">
        <div className="lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100dvh-5.5rem)] lg:[scrollbar-width:thin] lg:overflow-y-auto lg:pr-1">
          <div className="bg-surface-container-low lg:bg-surface-container-low rounded-3xl border border-[var(--outline-variant)]/15 p-4 shadow-sm sm:p-5 lg:p-5">
            {controls}
          </div>
        </div>

        <FadeIn className="relative mt-4 lg:mt-0" delay={0.05}>
          <div className="bg-surface-container-lowest relative overflow-hidden rounded-3xl border border-[var(--outline-variant)]/15 p-4 shadow-sm sm:p-6">
            <span className="bg-primary absolute top-0 right-0 left-0 h-[3px]" aria-hidden />
            {results}
          </div>
        </FadeIn>
      </FadeIn>
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
        return <NearbyView lang={lang} mode={mode} />
      case 'saved':
        return (
          <FadeIn>
            <FavoritesAndRecents lang={lang} onSelect={onSelectFromLists} />
          </FadeIn>
        )
      case 'settings':
        return <SettingsView lang={lang} />
      default:
        return renderStops()
    }
  }

  return (
    <div className="bg-surface min-h-dvh overflow-x-clip pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <TopAppBar lang={lang} mode={mode} onModeChange={onModeChange} />

      <div className="mx-auto flex max-w-[1280px] gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <SideRail lang={lang} subView={subView} onSubViewChange={onSubViewChange} />

        <main className="min-w-0 flex-1 overflow-hidden">
          <div className="mx-auto max-w-[1100px]">{renderContent()}</div>
        </main>
      </div>

      <BottomNav lang={lang} subView={subView} onSubViewChange={onSubViewChange} />
    </div>
  )
}
