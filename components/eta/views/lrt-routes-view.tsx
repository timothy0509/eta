'use client'

import { ChevronLeft, ChevronRight, MapPin, TramFront } from 'lucide-react'
import * as React from 'react'

import {
  RouteStopRow,
  RouteStopTimeline,
  SoonestEtaPill,
} from '@/components/eta/route-stop-timeline'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/m3/motion'
import { LRT_STATIONS } from '@/lib/data/lrt-stations'
import { fetchLrtEtasForStop } from '@/lib/eta/client'
import { listLrtRoutes } from '@/lib/eta/direct/eta-db'
import { getLineColor } from '@/lib/eta/line-colors'
import { useTranslations } from '@/lib/eta/i18n'
import { lrtStopIdToStationId } from '@/lib/eta/lrt-stop-id'
import { pickSoonestIsoEta } from '@/lib/eta/pick-soonest-eta'
import { promisePool } from '@/lib/eta/promise-pool'
import type { UiLanguage } from '@/lib/eta/types'
import { useTickingNow } from '@/lib/eta/use-ticking-now'
import { getReadableForeground } from '@/lib/ui/color'
import { cn } from '@/lib/utils'
import type { Eta, RouteListEntry } from 'hk-bus-eta'

function getLrtStationName(stationId: string, lang: UiLanguage): string {
  const station = LRT_STATIONS.find((s) => s.stationId === stationId)
  if (!station) return stationId
  return lang === 'en' ? station.nameEn : station.nameZh
}

function getRouteDestination(dest: { en: string; zh: string }, lang: UiLanguage): string {
  return lang === 'en' ? dest.en : dest.zh
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
  const now = useTickingNow(15_000)
  const [routes, setRoutes] = React.useState<RouteListEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
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
  }, [t])

  const stationIds = React.useMemo(() => {
    if (!selectedRoute) return []
    return (selectedRoute.stops.lightRail ?? [])
      .map((stopId) => lrtStopIdToStationId(stopId))
      .filter((id): id is string => id !== null)
  }, [selectedRoute])

  React.useEffect(() => {
    if (!selectedRoute || stationIds.length === 0) return

    let cancelled = false
    const bound = selectedRoute.bound.lightRail ?? ''
    const route = selectedRoute.route
    const serviceType = selectedRoute.serviceType

    const load = async () => {
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
    }

    void load()

    const interval = window.setInterval(() => {
      void load()
    }, 30_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [selectedRoute, stationIds, lang])

  const lineColor = selectedRoute ? getLineColor(selectedRoute.route) : '#64748b'

  return (
    <div className="bg-surface-container-low rounded-3xl p-4 shadow-sm">
      <div className="m3-title-md text-on-surface mb-3 flex items-center gap-2">
        <TramFront className="h-5 w-5" />
        {t('lrt.title')} · {t('common.routes')}
      </div>

      {!selectedRoute ? (
        <>
          {loading && (
            <div className="text-on-surface-variant m3-body-md py-8 text-center">
              {t('common.refresh')}…
            </div>
          )}
          {error && (
            <div className="text-error m3-body-md bg-error-container rounded-2xl p-4 text-center">
              {error}
            </div>
          )}
          {!loading && !error && (
            <StaggerContainer className="space-y-1" stagger={0.02}>
              {routes.map((route) => {
                const color = getLineColor(route.route)
                const fg = getReadableForeground(color)
                const stationCount = (route.stops.lightRail ?? []).length
                return (
                  <StaggerItem key={`${route.route}|${route.serviceType}|${route.bound.lightRail}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setStopEtas({})
                        setSelectedRoute(route)
                      }}
                      className="hover:bg-surface-container-high group flex w-full items-stretch gap-0 overflow-hidden rounded-2xl transition-colors"
                    >
                      <div
                        className="w-1.5 shrink-0 rounded-l-2xl"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
                        <span
                          className={cn('m3-title-md shrink-0 rounded-lg px-2.5 py-1', fg)}
                          style={{ backgroundColor: color }}
                        >
                          {route.route}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-on-surface m3-body-md truncate font-medium">
                            {getRouteDestination(route.dest, lang)}
                          </div>
                          <div className="text-on-surface-variant m3-label-md">
                            {route.serviceType !== '1'
                              ? `${stationCount} ${lang === 'en' ? 'stops' : '個站'} · ${route.serviceType}`
                              : `${stationCount} ${lang === 'en' ? 'stops' : '個站'}`}
                          </div>
                        </div>
                        <ChevronRight className="text-on-surface-variant h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </button>
                  </StaggerItem>
                )
              })}
            </StaggerContainer>
          )}
        </>
      ) : (
        <FadeIn className="space-y-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => {
                setStopEtas({})
                setSelectedRoute(null)
              }}
              className="bg-secondary-container text-on-secondary-container m3-label-lg mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 transition-colors hover:opacity-90"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('common.back')}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="m3-title-md shrink-0 rounded-lg px-2.5 py-1"
                  style={{
                    backgroundColor: lineColor,
                    color: getReadableForeground(lineColor) === 'text-white' ? '#fff' : '#000',
                  }}
                >
                  {selectedRoute.route}
                </span>
                <span className="text-on-surface m3-title-md truncate">
                  {getRouteDestination(selectedRoute.dest, lang)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="bg-surface-container rounded-2xl p-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
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
                  const soonest = pickSoonestIsoEta(etas.map(mapEtaForPick), now)
                  const name = getLrtStationName(stationId, lang)
                  return (
                    <RouteStopRow
                      key={`${stationId}-${idx}`}
                      name={name}
                      subtitle={<span className="hidden sm:inline">{stationId}</span>}
                      eta={
                        <SoonestEtaPill
                          minutes={soonest.minutes}
                          arriving={soonest.arriving}
                          lang={lang}
                        />
                      }
                      onClick={() => onSelectStation?.(stationId, name)}
                    />
                  )
                })}
              </RouteStopTimeline>
            </div>

            <div className="bg-surface-container rounded-2xl p-4">
              <div className="m3-title-md text-on-surface mb-2">{t('common.map')}</div>
              <div className="text-on-surface-variant m3-body-md bg-surface-container-high flex h-32 items-center justify-center rounded-2xl">
                {t('common.mapUnavailable')}
              </div>
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  )
}
