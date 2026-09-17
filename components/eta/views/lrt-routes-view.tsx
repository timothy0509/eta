'use client'

import { MapPin, TramFront } from 'lucide-react'
import * as React from 'react'

import { RouteStopRow, RouteStopTimeline } from '@/components/eta/route-stop-timeline'
import { TickingSoonestPill } from '@/components/eta/ticking-eta'
import { RouteDrilldown } from '@/components/eta/views/route-drilldown'
import { EmptyState } from '@/components/eta/empty-state'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { StaggerList, staggerClassForIndex } from '@/components/eta/stagger-list'
import { LRT_STATIONS } from '@/lib/data/lrt-stations'
import { fetchLrtEtasForStop } from '@/lib/eta/client'
import { listLrtRoutes } from '@/lib/eta/direct/eta-db'
import { LINE_COLOR_FALLBACK, getLineColor } from '@/lib/eta/line-colors'
import { useTranslations } from '@/lib/eta/i18n'
import { pickLangZh } from '@/lib/eta/pick-lang'
import { lrtStopIdToStationId } from '@/lib/eta/lrt-stop-id'
import { promisePool } from '@/lib/eta/promise-pool'
import type { UiLanguage } from '@/lib/eta/types'
import { getReadableForeground } from '@/lib/ui/color'
import { cn } from '@/lib/utils'
import type { Eta, RouteListEntry } from 'hk-bus-eta'

function getLrtStationName(stationId: string, lang: UiLanguage): string {
  const station = LRT_STATIONS.find((s) => s.stationId === stationId)
  if (!station) return stationId
  return pickLangZh({ en: station.nameEn, zh: station.nameZh }, lang)
}

function getRouteDestination(dest: { en: string; zh: string }, lang: UiLanguage): string {
  return pickLangZh(dest, lang)
}

function sortRoutes(a: RouteListEntry, b: RouteListEntry): number {
  return (
    a.route.localeCompare(b.route, undefined, { numeric: true }) ||
    a.serviceType.localeCompare(b.serviceType)
  )
}

function mapEtaForPick(eta: Eta): { eta?: string; data_timestamp?: string } {
  return {
    eta: eta.eta,
    data_timestamp: (eta as { data_timestamp?: string }).data_timestamp,
  }
}

export function LrtRoutesView({
  lang,
  onSelectStation,
}: {
  lang: UiLanguage
  onSelectStation?: (stationId: string, name: string) => void
}) {
  const { t } = useTranslations(lang)
  const [routes, setRoutes] = React.useState<RouteListEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [retryKey, setRetryKey] = React.useState(0)
  const [selectedRoute, setSelectedRoute] = React.useState<RouteListEntry | null>(null)
  const [stopEtas, setStopEtas] = React.useState<Record<string, Eta[]>>({})

  React.useEffect(() => {
    let cancelled = false
    listLrtRoutes()
      .then((data) => {
        if (!cancelled) {
          setRoutes(data.sort(sortRoutes))
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('errors.updateFailedGeneric'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t, retryKey])

  const handleRetryRoutes = React.useCallback(() => {
    setError(null)
    setLoading(true)
    setRetryKey((k) => k + 1)
  }, [])

  const stationIds = React.useMemo(() => {
    if (!selectedRoute) return []
    return (selectedRoute.stops.lightRail ?? [])
      .map((stopId) => lrtStopIdToStationId(stopId))
      .filter((id): id is string => id !== null)
  }, [selectedRoute])

  React.useEffect(() => {
    if (!selectedRoute || stationIds.length === 0) return

    let cancelled = false
    let inFlight = false
    const bound = selectedRoute.bound.lightRail ?? ''
    const route = selectedRoute.route
    const serviceType = selectedRoute.serviceType

    const load = async () => {
      if (cancelled || inFlight) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      inFlight = true
      try {
        const results = await promisePool(stationIds, 4, async (stationId) => {
          const etas = await fetchLrtEtasForStop({
            route,
            bound,
            serviceType,
            stationId,
            language: lang,
          })
          return { stationId, etas }
        })

        if (cancelled) return

        const next: Record<string, Eta[]> = {}
        for (const result of results) {
          if (result.status === 'fulfilled') {
            next[result.value.stationId] = result.value.etas
          }
        }
        setStopEtas(next)
      } finally {
        inFlight = false
      }
    }

    void load()

    const interval = window.setInterval(() => {
      void load()
    }, 30_000)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [selectedRoute, stationIds, lang])

  const lineColor = selectedRoute ? getLineColor(selectedRoute.route) : LINE_COLOR_FALLBACK

  return (
    <div className="card-m3 p-4">
      <div className="m3-title-md text-on-surface mb-3 flex items-center gap-2">
        <TramFront className="h-5 w-5" />
        {t('lrt.title')} · {t('common.routes')}
      </div>

      {!selectedRoute ? (
        <>
          {loading && <ResultsSkeleton />}
          {!loading && error && routes.length === 0 && (
            <EmptyState
              title={t('common.wentWrong')}
              hint={error}
              action={
                <button
                  type="button"
                  onClick={handleRetryRoutes}
                  className="bg-primary text-on-primary m3-label-lg ui-press mt-2 inline-flex min-h-[44px] items-center rounded-full px-5 py-2 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {t('common.tryAgain')}
                </button>
              }
            />
          )}
          {!loading && (!error || routes.length > 0) && routes.length > 0 && (
            <StaggerList className="space-y-3">
              {routes.map((route, idx) => {
                const color = getLineColor(route.route)
                const fg = getReadableForeground(color)
                return (
                  <button
                    key={`${route.route}|${route.serviceType}|${route.bound.lightRail}`}
                    type="button"
                    onClick={() => {
                      setStopEtas({})
                      setSelectedRoute(route)
                    }}
                    className={cn(
                      'bg-surface-container hover:bg-surface-container-high ui-press w-full rounded-2xl text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      staggerClassForIndex(idx)
                    )}
                  >
                    <div className="flex items-center gap-4 p-4">
                      <span
                        className={cn('m3-title-md rounded-xl px-3 py-1.5 shadow-sm', fg)}
                        style={{ backgroundColor: color }}
                      >
                        {route.route}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="m3-body-md text-on-surface truncate">
                          {getRouteDestination(route.dest, lang)}
                        </div>
                        <div className="text-on-surface-variant m3-label-md">
                          {route.serviceType !== '1'
                            ? `${t('common.route')} · ${route.serviceType}`
                            : t('common.route')}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </StaggerList>
          )}
        </>
      ) : (
        <RouteDrilldown
          lang={lang}
          onBack={() => {
            setStopEtas({})
            setSelectedRoute(null)
          }}
          title={
            <>
              <span
                className="m3-title-md rounded-full px-4 py-2"
                style={{
                  backgroundColor: lineColor,
                  color: getReadableForeground(lineColor) === 'text-white' ? '#fff' : '#000',
                }}
              >
                {selectedRoute.route}
              </span>
              <span className="text-on-surface-variant m3-body-md truncate">
                {getRouteDestination(selectedRoute.dest, lang)}
              </span>
            </>
          }
        >
          <div className="bg-surface-container rounded-2xl p-4">
            <div className="m3-title-md text-on-surface mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t('lrt.stations')}
              <span className="text-on-surface-variant m3-body-md ml-auto">
                {stationIds.length}
              </span>
            </div>

            <RouteStopTimeline lineColor={lineColor}>
              {stationIds.map((stationId, idx) => {
                const etas = stopEtas[stationId] ?? []
                const name = getLrtStationName(stationId, lang)
                return (
                  <RouteStopRow
                    key={`${stationId}-${idx}`}
                    name={name}
                    subtitle={<span className="hidden sm:inline">{stationId}</span>}
                    ariaLabel={name}
                    eta={<TickingSoonestPill etas={etas.map(mapEtaForPick)} lang={lang} />}
                    onClick={() => onSelectStation?.(stationId, name)}
                  />
                )
              })}
            </RouteStopTimeline>
          </div>
        </RouteDrilldown>
      )}
    </div>
  )
}
