'use client'

import { ChevronRight, Crosshair, MapPin, Navigation, RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/eta/empty-state'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { StaggerList, staggerClassForIndex } from '@/components/eta/stagger-list'
import { useGeolocation, type GeolocationErrorCode } from '@/components/eta/use-geolocation'
import { fetchKmbStops } from '@/lib/eta/client'
import { computeNearbyStops, formatDistanceKm, haversineDistanceKm } from '@/lib/eta/geo'
import { usePaneStore } from '@/lib/eta/pane-store'
import { useAppStore } from '@/lib/store'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { pickLang, pickLangZh } from '@/lib/eta/pick-lang'
import { useTranslations } from '@/lib/eta/i18n'
import { LRT_STATIONS, type LrtStation } from '@/lib/data/lrt-stations'
import { MTR_STATIONS, type MtrStation } from '@/lib/data/mtr-stations'
import { getLineColor, getMtrLineName } from '@/lib/eta/line-colors'
import { listLrtRoutes } from '@/lib/eta/direct/eta-db'
import { lrtStopIdToStationId } from '@/lib/eta/lrt-stop-id'
import { isKmbStop } from '@/lib/eta/types'
import type { KmbStopSearchItem, TransportMode, UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'
import type { RouteListEntry } from 'hk-bus-eta'

const TransitMap = dynamic(
  () => import('@/components/eta/transit-map').then((mod) => mod.TransitMap),
  {
    ssr: false,
    loading: () => <div className="bg-surface-container ui-shimmer h-72 rounded-2xl" />,
  }
)

type KmbNearbyStop = KmbStopSearchItem & { distanceKm: number }

const NEARBY_CACHE_MS = 60_000
const NEARBY_HYSTERESIS_KM = 0.05

/** Map zoom that keeps a controlled search radius comfortably on screen. */
function zoomForRadiusKm(radiusKm: number, base: number): number {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return base
  if (radiusKm <= 1) return base
  if (radiusKm <= 2) return base - 1
  return base - 2
}

const NEARBY_SLIDER_MIN_KM = 0.5
const NEARBY_SLIDER_MAX_KM = 5
const NEARBY_SLIDER_STEP_KM = 0.25

/**
 * Radius slider plus the follow toggle, shared by the three mode views.
 * Radius is a pane-store value (transient UI state); the follow toggle is
 * local per visit.
 */
function NearbyMapControls({
  t,
  radiusKm,
  onRadiusChange,
  following,
  onToggleFollow,
  disableFollow,
}: {
  t: (key: string) => string
  radiusKm: number
  onRadiusChange: (km: number) => void
  following: boolean
  onToggleFollow: () => void
  disableFollow?: boolean
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex min-w-48 flex-1 items-center gap-3">
        <label
          className="text-on-surface-variant m3-label-md whitespace-nowrap"
          htmlFor="nearby-radius"
        >
          {t('common.searchRadius')}
        </label>
        <input
          id="nearby-radius"
          type="range"
          min={NEARBY_SLIDER_MIN_KM}
          max={NEARBY_SLIDER_MAX_KM}
          step={NEARBY_SLIDER_STEP_KM}
          value={radiusKm}
          onChange={(event) => onRadiusChange(Number(event.target.value))}
          className="text-primary ui-press w-full min-w-32"
          aria-label={t('common.searchRadius')}
        />
        <span className="text-on-surface-variant m3-label-md w-14 text-right tabular-nums">
          {`${Math.round(radiusKm * 10) / 10} km`}
        </span>
      </div>
      <Button
        type="button"
        variant={following ? 'default' : 'outline'}
        size="sm"
        className="rounded-full shadow-sm"
        onClick={onToggleFollow}
        aria-pressed={following}
        disabled={disableFollow}
      >
        <Crosshair className={cn('mr-1.5 h-4 w-4', following && 'ui-spin')} />
        {following ? t('common.stopFollowing') : t('common.followLocation')}
      </Button>
    </div>
  )
}

function useKmbNearbyStops(userLocation: { lat: number; lng: number } | null, radiusKm: number) {
  // Reuse the stops the KMB pane already loaded so nearby never refetches
  // the full list when the user already visited the stops tab.
  const cachedStops = usePaneStore((s) => s.kmbStops)
  const [result, setResult] = React.useState<{
    key: string
    at: number
    stops: KmbNearbyStop[]
    error: string | null
  } | null>(null)
  const lastLocationRef = React.useRef<{ lat: number; lng: number } | null>(null)
  // Quantize to 4 decimals (~11 m) so GPS jitter does not retrigger the
  // full 6k-stop distance sort on every fix. The radius rides on the key so
  // dragging the slider recomputes without refetching the stop list.
  const key = userLocation
    ? `${userLocation.lat.toFixed(4)},${userLocation.lng.toFixed(4)},${radiusKm}`
    : null

  React.useEffect(() => {
    if (!userLocation || !key) return
    const last = lastLocationRef.current
    const locationMoved = !last || haversineDistanceKm(last, userLocation) >= NEARBY_HYSTERESIS_KM
    const cacheFresh = result?.key === key && Date.now() - result.at < NEARBY_CACHE_MS
    if (!locationMoved && cacheFresh) {
      lastLocationRef.current = userLocation
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const data = cachedStops.length ? cachedStops : await fetchKmbStops()
        if (cancelled) return
        lastLocationRef.current = userLocation
        setResult({
          key,
          at: Date.now(),
          stops: computeNearbyStops(userLocation, data, NEARBY_LIMIT, radiusKm),
          error: null,
        })
      } catch (err) {
        if (!cancelled) {
          setResult({
            key,
            at: Date.now(),
            stops: [],
            error: err instanceof Error ? err.message : 'Failed to load stops',
          })
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [key, radiusKm, result?.key, result?.at, userLocation, cachedStops])

  if (!key) return { stops: [], loading: false, error: null }
  if (!result || result.key !== key)
    return { stops: result?.stops ?? [], loading: true, error: null }
  return { stops: result.stops, loading: false, error: result.error }
}

function useLrtRouteStations() {
  const [routes, setRoutes] = React.useState<RouteListEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [retryKey, setRetryKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    listLrtRoutes()
      .then((data) => {
        if (cancelled) return
        setRoutes(data)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load LRT routes')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [retryKey])

  const retry = React.useCallback(() => {
    setError(null)
    setLoading(true)
    setRetryKey((k) => k + 1)
  }, [])

  return { routes, loading, error, retry }
}

function findLrtStationByStopId(stopId: string): LrtStation | undefined {
  const stationId = lrtStopIdToStationId(stopId)
  if (!stationId) return undefined
  return LRT_STATIONS.find((s) => s.stationId === stationId)
}

function useMtrStationsByLine() {
  return React.useMemo(() => {
    const lines = new Set<string>()
    for (const station of MTR_STATIONS) {
      for (const line of station.lines) lines.add(line)
    }
    return Array.from(lines)
      .sort()
      .map((line) => ({
        line,
        stations: MTR_STATIONS.filter((s) => s.lines.includes(line)).sort((a, b) =>
          a.nameEn.localeCompare(b.nameEn)
        ),
      }))
  }, [])
}

function useLrtStationsByRoute(routes: RouteListEntry[]) {
  return React.useMemo(() => {
    return routes
      .map((route) => {
        const lightRailStops = route.stops.lightRail ?? []
        const stations = lightRailStops
          .map((stopId) => findLrtStationByStopId(stopId))
          .filter(Boolean) as LrtStation[]
        const uniqueStations = Array.from(new Map(stations.map((s) => [s.stationId, s])).values())
        return {
          route: route.route,
          color: getLineColor(route.route),
          stations: uniqueStations,
        }
      })
      .filter((group) => group.stations.length)
      .sort((a, b) => a.route.localeCompare(b.route, undefined, { numeric: true }))
  }, [routes])
}

export type NearbyViewProps = {
  lang: UiLanguage
  mode: TransportMode
  onSelectStopGroup?: (selection: { stopIds: string[]; title: string; route: string }) => void
  onSelectMtrStation?: (sta: string, line: string, name: string) => void
  onSelectLrtStation?: (stationId: string, name: string) => void
}

export function NearbyView({
  lang,
  mode,
  onSelectStopGroup,
  onSelectMtrStation,
  onSelectLrtStation,
}: NearbyViewProps) {
  const { t } = useTranslations(lang)

  if (mode === 'kmb') {
    return <KmbNearbyWithLocation lang={lang} onSelectStopGroup={onSelectStopGroup} t={t} />
  }

  if (mode === 'mtr') {
    return <MtrNearbyWithLocation lang={lang} onSelectMtrStation={onSelectMtrStation} t={t} />
  }

  return <LrtNearbyWithLocation lang={lang} onSelectLrtStation={onSelectLrtStation} t={t} />
}

const NEARBY_LIMIT = 15

function KmbNearbyWithLocation({
  lang,
  onSelectStopGroup,
  t,
}: {
  lang: NearbyViewProps['lang']
  onSelectStopGroup?: NearbyViewProps['onSelectStopGroup']
  t: (key: string) => string
}) {
  const [following, setFollowing] = React.useState(false)
  const {
    location,
    loading: locating,
    error: locationError,
    refresh,
  } = useGeolocation({
    watch: following,
  })
  return (
    <KmbNearbyView
      lang={lang}
      location={location}
      locating={locating}
      locationError={locationError}
      onRefresh={refresh}
      onFocusToggle={() => setFollowing((prev) => !prev)}
      following={following}
      onSelectStopGroup={onSelectStopGroup}
      t={t}
    />
  )
}

function MtrNearbyWithLocation({
  lang,
  onSelectMtrStation,
  t,
}: {
  lang: NearbyViewProps['lang']
  onSelectMtrStation?: NearbyViewProps['onSelectMtrStation']
  t: (key: string) => string
}) {
  const [following, setFollowing] = React.useState(false)
  const {
    location,
    loading: locating,
    error: locationError,
    refresh,
  } = useGeolocation({
    watch: following,
  })
  return (
    <MtrNearbyView
      lang={lang}
      location={location}
      locating={locating}
      locationError={locationError}
      onRefresh={refresh}
      onFocusToggle={() => setFollowing((prev) => !prev)}
      following={following}
      onSelectMtrStation={onSelectMtrStation}
      t={t}
    />
  )
}

function LrtNearbyWithLocation({
  lang,
  onSelectLrtStation,
  t,
}: {
  lang: NearbyViewProps['lang']
  onSelectLrtStation?: NearbyViewProps['onSelectLrtStation']
  t: (key: string) => string
}) {
  const [following, setFollowing] = React.useState(false)
  const {
    location,
    loading: locating,
    error: locationError,
    refresh,
  } = useGeolocation({
    watch: following,
  })
  return (
    <LrtNearbyView
      lang={lang}
      location={location}
      locating={locating}
      locationError={locationError}
      onRefresh={refresh}
      onFocusToggle={() => setFollowing((prev) => !prev)}
      following={following}
      onSelectLrtStation={onSelectLrtStation}
      t={t}
    />
  )
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

type SharedViewProps = {
  lang: UiLanguage
  location: { lat: number; lng: number; accuracyM?: number } | null
  locating: boolean
  locationError: GeolocationErrorCode | null
  onRefresh: () => void
  onFocusToggle: () => void
  following: boolean
  onSelectStopGroup?: (selection: { stopIds: string[]; title: string; route: string }) => void
  onSelectMtrStation?: (sta: string, line: string, name: string) => void
  onSelectLrtStation?: (stationId: string, name: string) => void
  t: (key: string) => string
}

function KmbNearbyView({
  lang,
  location,
  locating,
  locationError,
  onRefresh,
  onFocusToggle,
  following,
  onSelectStopGroup,
  t,
}: SharedViewProps) {
  const radiusKm = useAppStore((s) => s.nearbyRadiusKm)
  const setRadiusKm = useAppStore((s) => s.setNearbyRadiusKm)
  const { stops, loading, error } = useKmbNearbyStops(location, radiusKm)

  const mapCenter = React.useMemo(() => {
    if (location) return { lat: location.lat, lng: location.lng }
    if (stops[0]) return { lat: stops[0].lat, lng: stops[0].lng }
    return { lat: 22.3193, lng: 114.1694 }
  }, [location, stops])

  const mapMarkers = React.useMemo(
    () =>
      stops.map((stop) => ({
        id: stop.stopId,
        lat: stop.lat,
        lng: stop.lng,
        title: pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang),
      })),
    [stops, lang]
  )

  return (
    <div className="space-y-4">
      <div className="card-m3 p-5">
        <div className="m3-title-md mb-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            {t('common.nearby')}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full shadow-sm"
            onClick={onRefresh}
            disabled={locating}
          >
            <RefreshCw className={cn('mr-1.5 h-4 w-4', locating && 'ui-spin')} />
            {t('common.refreshLocation')}
          </Button>
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
            <Button className="rounded-full shadow-sm" onClick={onRefresh}>
              <MapPin className="mr-1.5 h-4 w-4" />
              {t('common.enableLocation')}
            </Button>
          </div>
        )}

        <NearbyMapControls
          t={t}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          following={following}
          onToggleFollow={onFocusToggle}
        />

        {(loading || stops.length > 0) && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-[var(--outline-variant)]/15">
            <TransitMap
              lang={lang}
              center={mapCenter}
              markers={mapMarkers}
              userLocation={location}
              zoom={location ? zoomForRadiusKm(radiusKm, 15) : 14}
              onMarkerClick={(stopId) => {
                const stop = stops.find((candidate) => candidate.stopId === stopId)
                if (!stop) return
                const fullName = pickLang(
                  { en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc },
                  lang
                )
                const parsed = parseKmbStopNameCached(fullName, {
                  isKmb: isKmbStop(stop),
                  lang,
                })
                onSelectStopGroup?.({ stopIds: [stop.stopId], title: parsed.name, route: '' })
              }}
              ariaLabel={t('common.mapInteractive')}
              className="h-72 lg:h-80"
            />
          </div>
        )}

        {error && (
          <EmptyState
            title={t('errors.updateFailedGeneric')}
            hint={error}
            action={
              <button
                type="button"
                onClick={onRefresh}
                className="bg-primary text-on-primary m3-label-lg ui-press mt-2 inline-flex min-h-[44px] items-center rounded-full px-5 py-2 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
              >
                {t('common.tryAgain')}
              </button>
            }
          />
        )}

        {loading && !stops.length ? (
          <ResultsSkeleton />
        ) : stops.length === 0 && !locating && location ? (
          <EmptyState title={t('common.noStopsNearby')} />
        ) : stops.length === 0 && !locating ? null : (
          <>
            <div className="m3-title-md mb-2">{t('common.nearbyStops')}</div>
            <StaggerList>
              {stops.map((stop, idx) => {
                const fullName = pickLang(
                  { en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc },
                  lang
                )
                const parsed = parseKmbStopNameCached(fullName, {
                  isKmb: isKmbStop(stop),
                  lang,
                })
                return (
                  <button
                    key={stop.stopId}
                    type="button"
                    onClick={() =>
                      onSelectStopGroup?.({
                        stopIds: [stop.stopId],
                        title: parsed.name,
                        route: '',
                      })
                    }
                    className={cn(
                      'bg-surface-container hover:bg-surface-container-high ui-press ui-cv-row w-full rounded-2xl p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      staggerClassForIndex(idx)
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="m3-body-md truncate font-medium">{parsed.name}</div>
                        <div className="text-on-surface-variant m3-label-md">
                          {parsed.stopCode ?? stop.stopId} · {t('common.viewEtas')}
                        </div>
                      </div>
                      <div className="bg-primary-container text-on-primary-container m3-label-lg shrink-0 rounded-full px-2.5 py-1">
                        {formatDistanceKm(stop.distanceKm, lang)}
                      </div>
                      <ChevronRight className="text-on-surface-variant h-4 w-4 shrink-0" />
                    </div>
                  </button>
                )
              })}
            </StaggerList>
          </>
        )}
      </div>
    </div>
  )
}

function MtrNearbyView({
  lang,
  location,
  locating,
  locationError,
  onRefresh,
  onFocusToggle,
  following,
  onSelectMtrStation,
  t,
}: Pick<
  SharedViewProps,
  | 'lang'
  | 'location'
  | 'locating'
  | 'locationError'
  | 'onRefresh'
  | 'onFocusToggle'
  | 'following'
  | 'onSelectMtrStation'
  | 't'
>) {
  const radiusKm = useAppStore((s) => s.nearbyRadiusKm)
  const setRadiusKm = useAppStore((s) => s.setNearbyRadiusKm)
  const lines = useMtrStationsByLine()
  const nearby = React.useMemo(
    () => (location ? computeNearbyStops(location, MTR_STATIONS, NEARBY_LIMIT, radiusKm) : []),
    [location, radiusKm]
  )

  const mapCenter = React.useMemo(() => {
    if (location) return { lat: location.lat, lng: location.lng }
    if (nearby[0]) return { lat: nearby[0].lat, lng: nearby[0].lng }
    return { lat: 22.3193, lng: 114.1694 }
  }, [location, nearby])

  const mapMarkers = React.useMemo(
    () =>
      nearby.map((station) => ({
        id: station.sta,
        lat: station.lat,
        lng: station.lng,
        title: pickLangZh({ en: station.nameEn, zh: station.nameTc }, lang),
      })),
    [nearby, lang]
  )

  const stationName = React.useCallback(
    (station: MtrStation) => pickLangZh({ en: station.nameEn, zh: station.nameTc }, lang),
    [lang]
  )
  const stationLines = React.useCallback(
    (station: MtrStation) => station.lines.map((line) => getMtrLineName(line, lang)).join(' · '),
    [lang]
  )

  return (
    <div className="space-y-4">
      <div className="card-m3 p-5">
        <div className="m3-title-md mb-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            {t('common.nearby')}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full shadow-sm"
            onClick={onRefresh}
            disabled={locating}
          >
            <RefreshCw className={cn('mr-1.5 h-4 w-4', locating && 'ui-spin')} />
            {t('common.refreshLocation')}
          </Button>
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
            <Button className="rounded-full shadow-sm" onClick={onRefresh}>
              <MapPin className="mr-1.5 h-4 w-4" />
              {t('common.enableLocation')}
            </Button>
          </div>
        )}

        <NearbyMapControls
          t={t}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          following={following}
          onToggleFollow={onFocusToggle}
        />

        {nearby.length > 0 && (
          <>
            <div className="mb-4 overflow-hidden rounded-2xl border border-[var(--outline-variant)]/15">
              <TransitMap
                lang={lang}
                center={mapCenter}
                markers={mapMarkers}
                userLocation={location}
                zoom={location ? zoomForRadiusKm(radiusKm, 14) : 13}
                onMarkerClick={(sta) => {
                  const station = nearby.find((candidate) => candidate.sta === sta)
                  if (!station) return
                  onSelectMtrStation?.(
                    station.sta,
                    station.lines[0] ?? '',
                    pickLangZh({ en: station.nameEn, zh: station.nameTc }, lang)
                  )
                }}
                ariaLabel={t('common.mapInteractive')}
                className="h-72 lg:h-80"
              />
            </div>
            <div className="m3-title-md mb-2">{t('common.nearbyStops')}</div>
            <StaggerList>
              {nearby.map((station, idx) => (
                <button
                  key={station.sta}
                  type="button"
                  onClick={() =>
                    onSelectMtrStation?.(station.sta, station.lines[0] ?? '', stationName(station))
                  }
                  className={cn(
                    'bg-surface-container hover:bg-surface-container-high ui-press ui-cv-row w-full rounded-2xl p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                    staggerClassForIndex(idx)
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="m3-body-md truncate font-medium">{stationName(station)}</div>
                      <div className="text-on-surface-variant m3-label-md truncate">
                        {stationLines(station)}
                      </div>
                    </div>
                    <div className="bg-primary-container text-on-primary-container m3-label-lg shrink-0 rounded-full px-2.5 py-1">
                      {formatDistanceKm(station.distanceKm, lang)}
                    </div>
                    <ChevronRight className="text-on-surface-variant h-4 w-4 shrink-0" />
                  </div>
                </button>
              ))}
            </StaggerList>
          </>
        )}

        <div className={cn('m3-title-md mb-3', nearby.length > 0 && 'mt-6')}>
          {t('common.allMtrLines')}
        </div>
        <StaggerList className="space-y-3">
          {lines.map(({ line, stations }, idx) => (
            <div
              key={line}
              className={cn(
                'bg-surface-container ui-cv-auto rounded-2xl p-3',
                staggerClassForIndex(idx)
              )}
            >
              <div className="m3-label-lg mb-2 flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: getLineColor(line) }}
                />
                {getMtrLineName(line, lang)}
              </div>
              <div className="flex flex-wrap gap-2">
                {stations.map((station) => (
                  <button
                    key={station.sta}
                    type="button"
                    onClick={() => onSelectMtrStation?.(station.sta, line, stationName(station))}
                    className="bg-surface-container-high text-on-surface-variant hover:bg-surface-container-high/70 hover:text-on-surface focus-visible:ring-primary/30 m3-label-md inline-flex min-h-[44px] items-center rounded-full px-2.5 py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {stationName(station)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </StaggerList>
      </div>
    </div>
  )
}

function LrtNearbyView({
  lang,
  location,
  locating,
  locationError,
  onRefresh,
  onFocusToggle,
  following,
  onSelectLrtStation,
  t,
}: Pick<
  SharedViewProps,
  | 'lang'
  | 'location'
  | 'locating'
  | 'locationError'
  | 'onRefresh'
  | 'onFocusToggle'
  | 'following'
  | 'onSelectLrtStation'
  | 't'
>) {
  const radiusKm = useAppStore((s) => s.nearbyRadiusKm)
  const setRadiusKm = useAppStore((s) => s.setNearbyRadiusKm)
  const { routes, loading, error, retry } = useLrtRouteStations()
  const routeGroups = useLrtStationsByRoute(routes)

  const nearby = React.useMemo(
    () => (location ? computeNearbyStops(location, LRT_STATIONS, NEARBY_LIMIT, radiusKm) : []),
    [location, radiusKm]
  )

  // stationId -> route numbers, for the row subtitle.
  const routesByStation = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const group of routeGroups) {
      for (const station of group.stations) {
        const list = map.get(station.stationId) ?? []
        list.push(group.route)
        map.set(station.stationId, list)
      }
    }
    return map
  }, [routeGroups])

  const mapCenter = React.useMemo(() => {
    if (location) return { lat: location.lat, lng: location.lng }
    if (nearby[0]) return { lat: nearby[0].lat, lng: nearby[0].lng }
    return { lat: 22.4187, lng: 113.985 }
  }, [location, nearby])

  const mapMarkers = React.useMemo(
    () =>
      nearby.map((station) => ({
        id: station.stationId,
        lat: station.lat,
        lng: station.lng,
        title: pickLangZh({ en: station.nameEn, zh: station.nameZh }, lang),
      })),
    [nearby, lang]
  )

  const stationName = React.useCallback(
    (station: LrtStation) => pickLangZh({ en: station.nameEn, zh: station.nameZh }, lang),
    [lang]
  )

  const handleRetry = React.useCallback(() => {
    retry()
  }, [retry])

  return (
    <div className="space-y-4">
      <div className="card-m3 p-5">
        <div className="m3-title-md mb-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            {t('common.nearby')}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full shadow-sm"
            onClick={onRefresh}
            disabled={locating}
          >
            <RefreshCw className={cn('mr-1.5 h-4 w-4', locating && 'ui-spin')} />
            {t('common.refreshLocation')}
          </Button>
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
            <Button className="rounded-full shadow-sm" onClick={onRefresh}>
              <MapPin className="mr-1.5 h-4 w-4" />
              {t('common.enableLocation')}
            </Button>
          </div>
        )}

        <NearbyMapControls
          t={t}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          following={following}
          onToggleFollow={onFocusToggle}
        />

        {nearby.length > 0 && (
          <>
            <div className="mb-4 overflow-hidden rounded-2xl border border-[var(--outline-variant)]/15">
              <TransitMap
                lang={lang}
                center={mapCenter}
                markers={mapMarkers}
                userLocation={location}
                zoom={location ? zoomForRadiusKm(radiusKm, 14) : 13}
                onMarkerClick={(stationId) => {
                  const station = nearby.find((candidate) => candidate.stationId === stationId)
                  if (!station) return
                  onSelectLrtStation?.(
                    station.stationId,
                    pickLangZh({ en: station.nameEn, zh: station.nameZh }, lang)
                  )
                }}
                ariaLabel={t('common.mapInteractive')}
                className="h-72 lg:h-80"
              />
            </div>
            <div className="m3-title-md mb-2">{t('common.nearbyStops')}</div>
            <StaggerList>
              {nearby.map((station, idx) => (
                <button
                  key={station.stationId}
                  type="button"
                  onClick={() => onSelectLrtStation?.(station.stationId, stationName(station))}
                  className={cn(
                    'bg-surface-container hover:bg-surface-container-high ui-press ui-cv-row w-full rounded-2xl p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                    staggerClassForIndex(idx)
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="m3-body-md truncate font-medium">{stationName(station)}</div>
                      <div className="text-on-surface-variant m3-label-md truncate">
                        {(routesByStation.get(station.stationId) ?? []).join(' · ')}
                      </div>
                    </div>
                    <div className="bg-primary-container text-on-primary-container m3-label-lg shrink-0 rounded-full px-2.5 py-1">
                      {formatDistanceKm(station.distanceKm, lang)}
                    </div>
                    <ChevronRight className="text-on-surface-variant h-4 w-4 shrink-0" />
                  </div>
                </button>
              ))}
            </StaggerList>
          </>
        )}

        {loading && !location && <ResultsSkeleton />}
        {error && (
          <EmptyState
            title={t('errors.updateFailedGeneric')}
            hint={error}
            action={
              <button
                type="button"
                onClick={handleRetry}
                className="bg-primary text-on-primary m3-label-lg ui-press mt-2 inline-flex min-h-[44px] items-center rounded-full px-5 py-2 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
              >
                {t('common.tryAgain')}
              </button>
            }
          />
        )}

        {!loading && routeGroups.length > 0 && (
          <>
            <div className="m3-title-md mb-2">{t('common.allLrtRoutes')}</div>
            <StaggerList className="space-y-3">
              {routeGroups.map((group, idx) => (
                <div
                  key={group.route}
                  className={cn(
                    'bg-surface-container ui-cv-auto rounded-2xl p-3',
                    staggerClassForIndex(idx)
                  )}
                >
                  <div className="m3-label-lg mb-2 flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    {group.route}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.stations.map((station) => (
                      <button
                        key={station.stationId}
                        type="button"
                        onClick={() =>
                          onSelectLrtStation?.(station.stationId, stationName(station))
                        }
                        className="bg-surface-container-high text-on-surface-variant hover:bg-surface-container-high/70 hover:text-on-surface focus-visible:ring-primary/30 m3-label-md inline-flex min-h-[44px] items-center rounded-full px-2.5 py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {stationName(station)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </StaggerList>
          </>
        )}
      </div>
    </div>
  )
}
