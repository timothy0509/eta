'use client'

import { Crosshair, Map as MapIcon, MapPin, RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/eta/empty-state'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { useGeolocation, type GeolocationErrorCode } from '@/components/eta/use-geolocation'
import { fetchKmbStops } from '@/lib/eta/client'
import { LRT_STATIONS, type LrtStation } from '@/lib/data/lrt-stations'
import { MTR_STATIONS, type MtrStation } from '@/lib/data/mtr-stations'
import { usePaneStore } from '@/lib/eta/pane-store'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { pickLang, pickLangZh } from '@/lib/eta/pick-lang'
import { useTranslations } from '@/lib/eta/i18n'
import { isKmbStop } from '@/lib/eta/types'
import type { MapMarker } from '@/components/eta/transit-map'
import type { KmbStopSearchItem, TransportMode, UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

const TransitMap = dynamic(
  () => import('@/components/eta/transit-map').then((mod) => mod.TransitMap),
  {
    ssr: false,
    loading: () => <div className="bg-surface-container ui-shimmer h-[60dvh] rounded-2xl" />,
  }
)

export type MapViewProps = {
  lang: UiLanguage
  mode: TransportMode
  onSelectStopGroup?: (selection: { stopIds: string[]; title: string; route: string }) => void
  onSelectMtrStation?: (sta: string, line: string, name: string) => void
  onSelectLrtStation?: (stationId: string, name: string) => void
}

function useAllKmbStops(enabled: boolean) {
  // Reuse the stops the KMB pane already loaded so the map never refetches
  // the full list when the user already visited the stops tab.
  const cachedStops = usePaneStore((s) => s.kmbStops)
  const [fetched, setFetched] = React.useState<KmbStopSearchItem[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [retryKey, setRetryKey] = React.useState(0)

  React.useEffect(() => {
    if (!enabled || cachedStops.length > 0) return
    let cancelled = false
    fetchKmbStops()
      .then((stops) => {
        if (!cancelled) setFetched(stops)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load stops')
      })
    return () => {
      cancelled = true
    }
  }, [enabled, cachedStops.length, retryKey])

  const retry = React.useCallback(() => {
    setFetched(null)
    setError(null)
    setRetryKey((key) => key + 1)
  }, [])

  if (!enabled) return { stops: [], loading: false, error: null, retry }
  if (cachedStops.length > 0) return { stops: cachedStops, loading: false, error: null, retry }
  if (error) return { stops: [], loading: false, error, retry }
  return { stops: fetched ?? [], loading: fetched === null, error: null, retry }
}

function locationErrorMessage(code: GeolocationErrorCode, t: (key: string) => string): string {
  switch (code) {
    case 'denied':
      return t('common.locationDenied')
    case 'timeout':
      return t('common.locationTimeout')
    case 'unsupported':
      return t('common.locationUnsupported')
    default:
      return t('common.locationUnavailable')
  }
}

function stationNameFor(station: MtrStation | LrtStation, lang: UiLanguage): string {
  return 'stationId' in station
    ? pickLangZh({ en: station.nameEn, zh: station.nameZh }, lang)
    : pickLangZh({ en: station.nameEn, zh: station.nameTc }, lang)
}

export function MapView({
  lang,
  mode,
  onSelectStopGroup,
  onSelectMtrStation,
  onSelectLrtStation,
}: MapViewProps) {
  const { t } = useTranslations(lang)
  const [following, setFollowing] = React.useState(false)
  const {
    location,
    loading: locating,
    error: locationError,
    refresh,
  } = useGeolocation({ watch: following })

  const {
    stops: kmbStops,
    loading: kmbLoading,
    error: kmbError,
    retry: kmbRetry,
  } = useAllKmbStops(mode === 'kmb')

  const markers: MapMarker[] = React.useMemo(() => {
    if (mode === 'kmb') {
      return kmbStops.map((stop) => ({
        id: stop.stopId,
        lat: stop.lat,
        lng: stop.lng,
        title: pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang),
      }))
    }
    if (mode === 'mtr') {
      return MTR_STATIONS.map((station) => ({
        id: station.sta,
        lat: station.lat,
        lng: station.lng,
        title: stationNameFor(station, lang),
      }))
    }
    return LRT_STATIONS.map((station) => ({
      id: station.stationId,
      lat: station.lat,
      lng: station.lng,
      title: stationNameFor(station, lang),
    }))
  }, [mode, kmbStops, lang])

  const handleMarkerClick = React.useCallback(
    (id: string) => {
      if (mode === 'kmb') {
        const stop = kmbStops.find((candidate) => candidate.stopId === id)
        if (!stop) return
        const fullName = pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
        const parsed = parseKmbStopNameCached(fullName, {
          isKmb: isKmbStop(stop),
          lang,
        })
        onSelectStopGroup?.({ stopIds: [stop.stopId], title: parsed.name, route: '' })
        return
      }
      if (mode === 'mtr') {
        const station = MTR_STATIONS.find((candidate) => candidate.sta === id)
        if (!station) return
        onSelectMtrStation?.(station.sta, station.lines[0] ?? '', stationNameFor(station, lang))
        return
      }
      const station = LRT_STATIONS.find((candidate) => candidate.stationId === id)
      if (!station) return
      onSelectLrtStation?.(station.stationId, stationNameFor(station, lang))
    },
    [mode, kmbStops, lang, onSelectStopGroup, onSelectMtrStation, onSelectLrtStation]
  )

  const loading = mode === 'kmb' && kmbLoading
  const error = mode === 'kmb' ? kmbError : null

  return (
    <div className="space-y-4">
      <div className="card-m3 p-5">
        <div className="m3-title-md mb-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <MapIcon className="h-5 w-5" />
            {t('common.map')}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={following ? 'default' : 'outline'}
              size="sm"
              className="rounded-full shadow-sm"
              onClick={() => setFollowing((prev) => !prev)}
              aria-pressed={following}
              disabled={!location && !locating}
            >
              <Crosshair className={cn('mr-1.5 h-4 w-4', following && 'ui-spin')} />
              {following ? t('common.stopFollowing') : t('common.followLocation')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full shadow-sm"
              onClick={refresh}
              disabled={locating}
            >
              <RefreshCw className={cn('mr-1.5 h-4 w-4', locating && 'ui-spin')} />
              {t('common.refreshLocation')}
            </Button>
          </div>
        </div>

        {locating && (
          <div className="text-on-surface-variant m3-body-md py-2">{t('common.locating')}</div>
        )}
        {locationError && (
          <div className="text-error m3-body-md flex items-center gap-2 py-2">
            <MapPin className="h-4 w-4" />
            {locationErrorMessage(locationError, t)}
          </div>
        )}
        {!location && !locating && (
          <div className="py-2">
            <Button className="rounded-full shadow-sm" onClick={refresh}>
              <MapPin className="mr-1.5 h-4 w-4" />
              {t('common.enableLocation')}
            </Button>
          </div>
        )}

        {error && (
          <EmptyState
            title={t('errors.updateFailedGeneric')}
            hint={error}
            action={
              <button
                type="button"
                onClick={kmbRetry}
                className="bg-primary text-on-primary m3-label-lg ui-press mt-2 inline-flex min-h-[44px] items-center rounded-full px-5 py-2 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
              >
                {t('common.tryAgain')}
              </button>
            }
          />
        )}

        {loading ? (
          <ResultsSkeleton />
        ) : (
          !error && (
            <div className="overflow-hidden rounded-2xl border border-[var(--outline-variant)]/15">
              <TransitMap
                lang={lang}
                markers={markers}
                userLocation={location}
                zoom={11}
                fitKey={`map:${mode}:${markers.length}`}
                focusPoint={following && location ? { lat: location.lat, lng: location.lng } : null}
                onMarkerClick={handleMarkerClick}
                ariaLabel={t('common.map')}
                className="h-[60dvh] lg:h-[65dvh]"
              />
            </div>
          )
        )}
      </div>
    </div>
  )
}
