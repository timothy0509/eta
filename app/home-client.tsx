'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'

import { HomeLayout, StopsLayout } from '@/components/eta/home-layout'
import { PaneEnter } from '@/components/m3/motion'
import { useRefreshRegistry } from '@/components/eta/hooks/use-refresh-registry'
import { useUrlSync } from '@/components/eta/hooks/use-url-sync'
import { PaneSkeleton } from '@/components/eta/pane-skeleton'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import type {
  LrtStationSearchItem,
  MtrStationSearchItem,
  SubView,
  TransportMode,
  UiLanguage,
} from '@/lib/eta/types'
import { isLanguageSupported } from '@/lib/eta/types'
import { clearKmbStopNameCache } from '@/lib/eta/kmb-stop-name'
import { getMtrLineName } from '@/lib/eta/line-colors'
import { pickLangZh } from '@/lib/eta/pick-lang'
import { initWebVitalsSampler } from '@/lib/eta/perf'
import { registerServiceWorker } from '@/lib/eta/sw-register'
import { usePaneStore } from '@/lib/eta/pane-store'
import { useAppStore, type FavoritesItem } from '@/lib/store'
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
            sta: s.mtr.sta,
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
      sta={data?.sta}
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
      stationId={data?.stationId}
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
  const { setMode, setSubView, setLang, setRouteFilterMode, addFavorite, addRecent } =
    useAppStoreActions()

  const setKmbStops = usePaneStore((s) => s.setKmbStops)

  const canFavoriteRef = React.useRef(false)

  // Narrow URL-only selectors so ETA map updates do not rerender the shell.
  // Heavy ETA fields stay subscribed inside Kmb/Mtr/LrtResultsFromStore.
  const kmbQuerySummary = usePaneStore((s) => s.kmb?.querySummary ?? null)
  const kmbRouteFilter = usePaneStore((s) => s.kmb?.routeFilter ?? null)
  const mtrSta = usePaneStore((s) => s.mtr?.sta ?? null)
  const lrtStationId = usePaneStore((s) => s.lrt?.stationId ?? null)

  // Pane-store snapshots are read-only here. Panes write their own
  // snapshots, and the URL hook below only reads them for encoding.
  // The hook hydrates nav-only state so shared links never overwrite
  // recipient lang, refresh interval, or filter mode.
  const { selectedItem, setSelectedItem } = useUrlSync({
    kmbQuery: kmbQuerySummary,
    kmbRouteFilter,
    mtrSta,
    lrtStationId,
  })

  const { onRegisterRefresh } = useRefreshRegistry({ mode, subView, autoRefreshSeconds })

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

  // Mirrors so the web-vitals sampler reads the active tab without
  // resubscribing its observers on every mode/subView render.
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
    [setMode, setRouteFilterMode, setSelectedItem, setSubView]
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
    [setMode, setSelectedItem, setSubView]
  )

  const onSelectMtrStationFromRoute = React.useCallback(
    (sta: string, line: string, name: string) => {
      const station = mtrStations.find((s) => s.sta === sta)
      const title = station
        ? `${pickLangZh({ en: station.nameEn, zh: station.nameTc }, lang)} · ${station.lines.map((l) => getMtrLineName(l, lang)).join('/')}/${station.sta}`
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
    [lang, mtrStations, setMode, setSelectedItem, setSubView]
  )

  const onSelectLrtStationFromRoute = React.useCallback(
    (stationId: string, name: string) => {
      const station = lrtStations.find((s) => s.stationId === stationId)
      const title = station
        ? `${pickLangZh({ en: station.nameEn, zh: station.nameZh }, lang)} · ${station.stationId}`
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
    [lang, lrtStations, setMode, setSelectedItem, setSubView]
  )

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
    return <StopsLayout controls={controls} results={results} />
  }

  const renderRoutes = () => {
    if (mode === 'kmb')
      return (
        <PaneEnter key="routes:kmb">
          <KmbRoutesView
            lang={lang}
            initialSelection={kmbRouteInitialSelection}
            onSelectStopGroup={onSelectStopGroupFromRoute}
          />
        </PaneEnter>
      )
    if (mode === 'mtr')
      return (
        <PaneEnter key="routes:mtr">
          <MtrRoutesView lang={lang} onSelectStation={onSelectMtrStationFromRoute} />
        </PaneEnter>
      )
    return (
      <PaneEnter key="routes:lrt">
        <LrtRoutesView lang={lang} onSelectStation={onSelectLrtStationFromRoute} />
      </PaneEnter>
    )
  }

  const renderContent = () => {
    switch (subView) {
      case 'routes':
        return renderRoutes()
      case 'stops':
        return renderStops()
      case 'nearby':
        return (
          <PaneEnter key={`nearby:${mode}`}>
            <NearbyView
              lang={lang}
              mode={mode}
              onSelectStopGroup={onSelectStopGroupFromRoute}
              onSelectMtrStation={onSelectMtrStationFromRoute}
              onSelectLrtStation={onSelectLrtStationFromRoute}
            />
          </PaneEnter>
        )
      case 'saved':
        return (
          <PaneEnter key="saved">
            <FavoritesAndRecents lang={lang} onSelect={onSelectFromLists} />
          </PaneEnter>
        )
      case 'settings':
        return (
          <PaneEnter key="settings">
            <SettingsView lang={lang} />
          </PaneEnter>
        )
      default:
        return renderStops()
    }
  }

  return (
    <HomeLayout
      lang={lang}
      mode={mode}
      subView={subView}
      onModeChange={onModeChange}
      onSubViewChange={onSubViewChange}
    >
      {renderContent()}
    </HomeLayout>
  )
}
