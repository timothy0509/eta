'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'

import { HomeLayout, StopsLayout } from '@/components/eta/home-layout'
import { useRefreshRegistry } from '@/components/eta/hooks/use-refresh-registry'
import { useUrlSync } from '@/components/eta/hooks/use-url-sync'
import { PaneSkeleton } from '@/components/eta/pane-skeleton'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { FadeIn } from '@/components/m3/motion'
import { LRT_STATIONS } from '@/lib/data/lrt-stations'
import { MTR_STATIONS } from '@/lib/data/mtr-stations'
import type {
  LrtStationSearchItem,
  MtrStationSearchItem,
  SubView,
  TransportMode,
} from '@/lib/eta/types'
import { isLanguageSupported } from '@/lib/eta/types'
import { clearKmbStopNameCache } from '@/lib/eta/kmb-stop-name'
import { getMtrLineName } from '@/lib/eta/line-colors'
import { pickLangZh } from '@/lib/eta/pick-lang'
import { prefetchEtaDb } from '@/lib/eta/prefetch'
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
      setAutoRefreshSeconds: s.setAutoRefreshSeconds,
      addFavorite: s.addFavorite,
      addRecent: s.addRecent,
    }))
  )

export default function HomeClient() {
  const { mode, subView, lang, routeFilterMode, autoRefreshSeconds } = useAppStoreState()
  const { setMode, setSubView, setLang, setRouteFilterMode, addFavorite, addRecent } =
    useAppStoreActions()

  const setKmbStops = usePaneStore((s) => s.setKmbStops)

  const canFavoriteRef = React.useRef(false)

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

  // Pane-store snapshots are read-only here. Panes write their own
  // snapshots, and the URL hook below only reads them for encoding.
  const { selectedItem, setSelectedItem } = useUrlSync({
    kmbQuery: kmbPaneState?.querySummary ?? null,
    kmbRouteFilter: kmbPaneState?.routeFilter ?? null,
    mtrSta: mtrPaneState?.sta,
    lrtStationId: lrtPaneState?.stationId,
  })

  const { onRegisterRefresh } = useRefreshRegistry({ mode, subView, autoRefreshSeconds })

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
    return <StopsLayout controls={controls} results={results} />
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
