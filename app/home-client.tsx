'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import dynamic from 'next/dynamic'

import { AutoRefreshMenu } from '@/components/eta/auto-refresh'
import { LanguageToggle } from '@/components/eta/language-toggle'
import { ModeTabs } from '@/components/eta/mode-tabs'
import { PaneSkeleton } from '@/components/eta/pane-skeleton'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { LRT_STATIONS } from '@/lib/data/lrt-stations'
import { MTR_STATIONS } from '@/lib/data/mtr-stations'
import { decodeUrlState, encodeUrlState } from '@/lib/eta/url-state'
import type { KmbStopSearchItem, LrtStationSearchItem, MtrStationSearchItem } from '@/lib/eta/types'
import { isLanguageSupported } from '@/lib/eta/types'
import { useAutoRefresh } from '@/lib/eta/use-auto-refresh'
import { clearKmbStopNameCache } from '@/lib/eta/kmb-stop-name'
import { prefetchEtaDb } from '@/lib/eta/prefetch'
import { usePaneStore } from '@/lib/eta/pane-store'
import { useAppStore, type FavoritesItem } from '@/lib/store'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useShallow } from 'zustand/shallow'
import { useTranslations } from '@/lib/eta/i18n'

// Dynamic imports for transport mode panes - loaded only when needed
// This significantly reduces initial bundle size
const KmbPane = dynamic(
  () => import('@/components/eta/panes/kmb-pane').then((mod) => mod.KmbPane),
  {
    loading: () => <PaneSkeleton />,
    ssr: false,
  }
)

const MtrPane = dynamic(
  () => import('@/components/eta/panes/mtr-pane').then((mod) => mod.MtrPane),
  {
    loading: () => <PaneSkeleton />,
    ssr: false,
  }
)

const LrtPane = dynamic(
  () => import('@/components/eta/panes/lrt-pane').then((mod) => mod.LrtPane),
  {
    loading: () => <PaneSkeleton />,
    ssr: false,
  }
)

const KmbResults = dynamic(
  () => import('@/components/eta/results-kmb').then((mod) => ({ default: mod.KmbResults })),
  {
    loading: () => <ResultsSkeleton />,
    ssr: false,
  }
)

const MtrResults = dynamic(
  () => import('@/components/eta/results-mtr').then((mod) => ({ default: mod.MtrResults })),
  {
    loading: () => <ResultsSkeleton />,
    ssr: false,
  }
)

const LrtResults = dynamic(
  () => import('@/components/eta/results-lrt').then((mod) => ({ default: mod.LrtResults })),
  {
    loading: () => <ResultsSkeleton />,
    ssr: false,
  }
)

const FavoritesAndRecents = dynamic(
  () => import('@/components/eta/favorites').then((mod) => ({ default: mod.FavoritesAndRecents })),
  {
    ssr: false,
    loading: () => <PaneSkeleton />,
  }
)

// ============================================================================
// Consolidated store selectors with shallow equality for stable snapshots
// ============================================================================
const useAppStoreState = () =>
  useAppStore(
    useShallow((s) => ({
      mode: s.mode,
      lang: s.lang,
      routeFilterMode: s.routeFilterMode,
      autoRefreshSeconds: s.autoRefreshSeconds,
    }))
  )

const useAppStoreActions = () =>
  useAppStore(
    useShallow((s) => ({
      setMode: s.setMode,
      setLang: s.setLang,
      setRouteFilterMode: s.setRouteFilterMode,
      setAutoRefreshSeconds: s.setAutoRefreshSeconds,
      addFavorite: s.addFavorite,
      addRecent: s.addRecent,
    }))
  )

export default function HomeClient() {
  // Consolidated state subscription (single re-render when any state changes)
  const { mode, lang, routeFilterMode, autoRefreshSeconds } = useAppStoreState()

  // Actions are stable and don't cause re-renders
  const { setMode, setLang, setRouteFilterMode, setAutoRefreshSeconds, addFavorite, addRecent } =
    useAppStoreActions()

  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [savedOpen, setSavedOpen] = React.useState(false)
  const [savedSide, setSavedSide] = React.useState<'right' | 'bottom'>('bottom')

  const { theme, setTheme, resolvedTheme } = useTheme()
  const themeMounted = resolvedTheme !== undefined

  const [kmbStops, setKmbStops] = React.useState<KmbStopSearchItem[]>([])
  const kmbPaneState = usePaneStore((s) => s.kmb)
  const mtrPaneState = usePaneStore((s) => s.mtr)
  const lrtPaneState = usePaneStore((s) => s.lrt)
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

  // Clear parsed stop name cache when language changes
  React.useEffect(() => {
    clearKmbStopNameCache()
  }, [lang])

  // Prefetch ETA database during idle time
  React.useEffect(() => {
    prefetchEtaDb()
  }, [])

  const onSavedOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setSavedSide(isDesktop ? 'right' : 'bottom')
      }
      setSavedOpen(nextOpen)
    },
    [isDesktop]
  )

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
    if (decoded.state.lang) setLang(decoded.state.lang)
    if (decoded.state.routeFilterMode) setRouteFilterMode(decoded.state.routeFilterMode)
    if (decoded.state.autoRefreshSeconds !== undefined) {
      setAutoRefreshSeconds(decoded.state.autoRefreshSeconds)
    }
    didHydrateFromUrlRef.current = true
    lastEncodedRef.current = search
  }, [searchParams, setAutoRefreshSeconds, setLang, setMode, setRouteFilterMode])

  const refreshRef = React.useRef<(() => Promise<void>) | null>(null)
  const inFlightRefreshRef = React.useRef(false)
  const refreshTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const MAX_REFRESH_DURATION_MS = 30_000

  const onRegisterRefresh = React.useCallback((refresh: () => Promise<void>) => {
    refreshRef.current = refresh
  }, [])

  useAutoRefresh(
    autoRefreshSeconds * 1000,
    React.useCallback(() => {
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
    }, [])
  )

  React.useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  const onSelectFromLists = React.useCallback(
    (item: FavoritesItem) => {
      setSelectedItem(item)
      setMode(item.mode)
      setSavedOpen(false)
    },
    [setMode, setSelectedItem, setSavedOpen]
  )

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

  const { t } = useTranslations(lang)

  const heading = mode === 'kmb' ? t('kmb.title') : mode === 'mtr' ? t('mtr.title') : t('lrt.title')

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
  return (
    <div className="from-background via-background to-muted/30 relative min-h-dvh bg-gradient-to-b">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(80%_40%_at_50%_0%,hsl(var(--primary)/0.18),transparent_70%)]" />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-2">
          <div className="ui-animate-in flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">TimoETA</h1>
              <p className="text-muted-foreground mt-1 text-sm">{t('common.desc')}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setSavedOpen(!savedOpen)}
                aria-expanded={savedOpen}
                aria-controls="saved-panel"
              >
                {t('common.saved')}
              </Button>
              <AutoRefreshMenu
                lang={lang}
                valueSeconds={autoRefreshSeconds}
                onChange={setAutoRefreshSeconds}
              />
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                aria-label={t('common.toggleTheme')}
                onClick={() => {
                  const actual = resolvedTheme ?? theme
                  setTheme(actual === 'dark' ? 'light' : 'dark')
                }}
              >
                {themeMounted ? (
                  (resolvedTheme ?? theme) === 'dark' ? (
                    <Sun className="mr-2 h-4 w-4" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4" />
                  )
                ) : (
                  <span className="mr-2 inline-block h-4 w-4" aria-hidden />
                )}
                {t('common.theme')}
              </Button>
            </div>
          </div>

          <Sheet open={savedOpen} onOpenChange={onSavedOpenChange}>
            <SheetContent side={savedSide} id="saved-panel">
              <SheetHeader>
                <SheetTitle>{t('common.saved')}</SheetTitle>
              </SheetHeader>
              <SheetBody className={savedSide === 'bottom' ? 'px-4' : undefined}>
                <FavoritesAndRecents lang={lang} kmbStops={kmbStops} onSelect={onSelectFromLists} />
              </SheetBody>
            </SheetContent>
          </Sheet>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
            <div className="space-y-4">
              <Card className="bg-card/60 rounded-3xl border p-0 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <ModeTabs lang={lang} value={mode} onChange={setMode} />

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{heading}</div>
                      <div className="text-muted-foreground text-xs">{t('common.searchPin')}</div>
                    </div>
                    <LanguageToggle mode={mode} value={lang} onChange={setLang} />
                  </div>

                  <Separator />

                  <div hidden={mode !== 'kmb'}>
                    <ErrorBoundary>
                      <KmbPane
                        lang={lang}
                        routeFilterMode={routeFilterMode}
                        onRouteFilterModeChange={setRouteFilterMode}
                        onAddRecent={addRecent}
                        onAddFavorite={addFavorite}
                        canFavoriteRef={canFavoriteRef}
                        selectedItem={selectedItem}
                        onRegisterRefresh={onRegisterRefresh}
                        onStopsChange={setKmbStops}
                      />
                    </ErrorBoundary>
                  </div>

                  <div hidden={mode !== 'mtr'}>
                    <ErrorBoundary>
                      <MtrPane
                        lang={lang}
                        stations={mtrStations}
                        onAddRecent={addRecent}
                        onAddFavorite={addFavorite}
                        canFavoriteRef={canFavoriteRef}
                        onRegisterRefresh={onRegisterRefresh}
                        selectedItem={selectedItem}
                      />
                    </ErrorBoundary>
                  </div>

                  <div hidden={mode !== 'lrt'}>
                    <ErrorBoundary>
                      <LrtPane
                        lang={lang}
                        stations={lrtStations}
                        onAddRecent={addRecent}
                        onAddFavorite={addFavorite}
                        canFavoriteRef={canFavoriteRef}
                        onRegisterRefresh={onRegisterRefresh}
                        selectedItem={selectedItem}
                      />
                    </ErrorBoundary>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div hidden={mode !== 'kmb'}>
                <KmbResults
                  lang={kmbPaneState?.lang ?? lang}
                  title={kmbPaneState?.title ?? t('kmb.title')}
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
              </div>

              <div hidden={mode !== 'mtr'}>
                <MtrResults
                  title={mtrPaneState?.title ?? t('mtr.title')}
                  lang={mtrPaneState?.lang ?? lang}
                  schedule={mtrPaneState?.schedule ?? null}
                  error={mtrPaneState?.error ?? null}
                  stale={mtrPaneState?.stale ?? false}
                  lastUpdatedAt={mtrPaneState?.lastUpdatedAt ?? null}
                  onRefresh={mtrOnRefresh}
                  loading={mtrPaneState?.loading}
                />
              </div>

              <div hidden={mode !== 'lrt'}>
                <LrtResults
                  title={lrtPaneState?.title ?? t('lrt.title')}
                  lang={lrtPaneState?.lang ?? lang}
                  schedule={lrtPaneState?.schedule ?? null}
                  error={lrtPaneState?.error ?? null}
                  stale={lrtPaneState?.stale ?? false}
                  lastUpdatedAt={lrtPaneState?.lastUpdatedAt ?? null}
                  onRefresh={lrtOnRefresh}
                  loading={lrtPaneState?.loading}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
