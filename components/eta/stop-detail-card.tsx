'use client'

import { ChevronDown, MapPin } from 'lucide-react'
import dynamic from 'next/dynamic'
import * as React from 'react'

import { RouteBadge } from '@/components/eta/route-badge'
import { formatDistanceKm } from '@/lib/eta/geo'
import { useTranslations } from '@/lib/eta/i18n'
import type { UiLanguage } from '@/lib/eta/types'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const StopMiniMap = dynamic(
  () => import('@/components/eta/transit-map').then((mod) => ({ default: mod.TransitMap })),
  {
    ssr: false,
    loading: () => <div className="bg-surface-container h-48 animate-pulse rounded-2xl" />,
  }
)

export type StopCardRoute = {
  key: string
  route: string
  co: string
  label: string
}

export type StopCardNearby = {
  stopId: string
  title: string
  distanceKm: number
}

type Props = {
  lang: UiLanguage
  title: string
  stopCode: string | null
  exitInfo?: string | null
  coords: { lat: number; lng: number } | null
  routes: StopCardRoute[]
  totalRouteCount: number
  nearby: StopCardNearby[]
  quickHopStopId: string | null
  onSelectNearby: (stopId: string) => void
}

const MAX_ROUTE_BADGES = 8

export function StopDetailCard({
  lang,
  title,
  stopCode,
  exitInfo,
  coords,
  routes,
  totalRouteCount,
  nearby,
  quickHopStopId,
  onSelectNearby,
}: Props) {
  const { t, tWithParams } = useTranslations(lang)
  const savedCount = useAppStore((s) => s.favorites.length)
  const [mapExpanded, setMapExpanded] = React.useState(false)

  const visibleRoutes = routes.slice(0, MAX_ROUTE_BADGES)
  const coordsText =
    coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
      ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
      : null

  return (
    <section
      aria-label={title}
      className="bg-surface-container-high rounded-3xl border border-[var(--outline-variant)]/15 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m3-title-md text-on-surface truncate">{title}</h2>
          <div className="text-on-surface-variant m3-label-md mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {stopCode ? (
              <span>
                {t('common.stopCode')}: {stopCode}
              </span>
            ) : null}
            {exitInfo ? (
              <span>
                {t('common.exit')}: {exitInfo}
              </span>
            ) : null}
            <span>
              {t('common.saved')}: {savedCount}
            </span>
          </div>
        </div>
      </div>

      {coordsText ? (
        <div className="text-on-surface-variant m3-label-md mt-2 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {t('common.coordinates')}: {coordsText}
          </span>
        </div>
      ) : null}

      {coords && coordsText ? (
        <div className="mt-3">
          <div className="bg-surface-container flex items-center justify-between gap-2 rounded-2xl px-3 py-2">
            <span className="text-on-surface-variant m3-label-md truncate">
              {t('common.mapPlaceholder')}
            </span>
            <button
              type="button"
              aria-expanded={mapExpanded}
              onClick={() => setMapExpanded((prev) => !prev)}
              className="text-primary m3-label-lg inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1"
            >
              {mapExpanded ? t('common.hideMap') : t('common.showMap')}
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', mapExpanded && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
          </div>
          {mapExpanded ? (
            <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--outline-variant)]/15">
              <StopMiniMap
                center={coords}
                markers={[{ id: 'stop', lat: coords.lat, lng: coords.lng, title }]}
                zoom={16}
                className="h-48"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3">
        <div className="m3-label-lg text-on-surface mb-2">
          {tWithParams('kmb.showingRoutes', {
            shown: String(visibleRoutes.length),
            total: String(totalRouteCount),
          })}
        </div>
        {visibleRoutes.length ? (
          <div className="grid grid-cols-4 gap-2">
            {visibleRoutes.map((item) => (
              <div
                key={item.key}
                title={item.label || item.route}
                className="bg-surface-container flex min-w-0 items-center justify-center rounded-xl px-1 py-1.5"
              >
                <RouteBadge route={item.route} company={item.co} size="sm" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-on-surface-variant m3-body-md">{t('errors.noResults')}</p>
        )}
      </div>

      <div className="mt-3">
        <div className="m3-label-lg text-on-surface mb-1.5 flex items-center gap-2">
          {t('common.crowdLevel')}
          <span className="text-on-surface-variant m3-label-sm font-normal">
            {t('common.crowdStaticNote')}
          </span>
        </div>
        <div className="bg-surface-container flex items-center gap-2 rounded-2xl px-3 py-2">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {['quiet', 'typical', 'busy'].map((level) => (
              <span
                key={level}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  level === 'typical' ? 'bg-primary' : 'bg-outline-variant/30'
                )}
              />
            ))}
          </div>
          <span className="m3-label-md text-on-surface-variant shrink-0">
            {t('common.crowdLevel')}: {t('common.crowdTypical')}
          </span>
        </div>
      </div>

      {nearby.length ? (
        <div className="mt-3">
          <div className="m3-label-lg text-on-surface mb-1.5">
            {t('common.quickHop')} · {t('common.nearbyStops')}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {nearby.map((stop) => {
              const active = stop.stopId === quickHopStopId
              return (
                <button
                  key={stop.stopId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectNearby(stop.stopId)}
                  className={cn(
                    'flex max-w-[10rem] min-w-[10rem] flex-col rounded-2xl px-3 py-2 text-left transition-colors',
                    active
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  )}
                >
                  <span className="m3-body-md truncate font-medium">{stop.title}</span>
                  <span
                    className={cn(
                      'm3-label-md',
                      active ? 'text-on-primary-container/80' : 'text-on-surface-variant'
                    )}
                  >
                    {formatDistanceKm(stop.distanceKm, lang)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}
