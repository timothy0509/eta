'use client'

import { MapPin, Navigation, RefreshCw } from 'lucide-react'
import * as React from 'react'

import { TransitMap } from '@/components/eta/transit-map'
import { Button } from '@/components/ui/button'
import { StaggerContainer, StaggerItem } from '@/components/m3/motion'
import { useGeolocation } from '@/components/eta/use-geolocation'
import { fetchKmbStops } from '@/lib/eta/client'
import { computeNearbyStops, formatDistanceKm } from '@/lib/eta/geo'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { useTranslations } from '@/lib/eta/i18n'
import { LRT_STATIONS, type LrtStation } from '@/lib/data/lrt-stations'
import { MTR_STATIONS, type MtrStation } from '@/lib/data/mtr-stations'
import { getLineColor, getMtrLineName } from '@/lib/eta/line-colors'
import { listLrtRoutes } from '@/lib/eta/direct/eta-db'
import { lrtStopIdToStationId } from '@/lib/eta/lrt-stop-id'
import type { TransportMode, UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'
import type { RouteListEntry } from 'hk-bus-eta'

function pickLang<T>(record: { en: T; tc: T; sc: T }, lang: UiLanguage): T {
  if (lang === 'sc') return record.sc
  if (lang === 'en') return record.en
  return record.tc
}

type KmbNearbyStop = {
  stopId: string
  nameEn: string
  nameTc: string
  nameSc: string
  lat: number
  lng: number
  distanceKm: number
}

function useKmbNearbyStops(userLocation: { lat: number; lng: number } | null) {
  const [stops, setStops] = React.useState<KmbNearbyStop[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetchKmbStops()
      .then((data) => {
        if (cancelled) return
        if (!userLocation) {
          setStops([])
          return
        }
        const nearby = computeNearbyStops(userLocation, data, 15)
        setStops(nearby)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load stops')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userLocation])

  return { stops, loading, error }
}

function useLrtRouteStations() {
  const [routes, setRoutes] = React.useState<RouteListEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    listLrtRoutes()
      .then((data) => {
        if (!cancelled) setRoutes(data)
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
  }, [])

  return { routes, loading, error }
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

export function NearbyView({ lang, mode }: { lang: UiLanguage; mode: TransportMode }) {
  const { t } = useTranslations(lang)
  const { location, loading: locating, error: locationError, refresh } = useGeolocation()

  if (mode === 'kmb') {
    return (
      <KmbNearbyView
        lang={lang}
        location={location}
        locating={locating}
        locationError={locationError}
        onRefresh={refresh}
        t={t}
      />
    )
  }

  if (mode === 'mtr') {
    return (
      <MtrNearbyView
        lang={lang}
        location={null}
        locating={false}
        locationError={null}
        onRefresh={refresh}
        t={t}
      />
    )
  }

  return (
    <LrtNearbyView
      lang={lang}
      location={null}
      locating={false}
      locationError={null}
      onRefresh={refresh}
      t={t}
    />
  )
}

type SharedViewProps = {
  lang: UiLanguage
  location: { lat: number; lng: number } | null
  locating: boolean
  locationError: string | null
  onRefresh: () => void
  t: (key: string) => string
}

function KmbNearbyView({ lang, location, locating, locationError, onRefresh, t }: SharedViewProps) {
  const { stops, loading, error } = useKmbNearbyStops(location)

  const mapCenter = React.useMemo(() => {
    if (location) return { lat: location.lat, lng: location.lng }
    if (stops[0]) return { lat: stops[0].lat, lng: stops[0].lng }
    return { lat: 22.3193, lng: 114.1694 }
  }, [location, stops])

  const mapMarkers = React.useMemo(
    () =>
      stops.slice(0, 15).map((stop) => ({
        id: stop.stopId,
        lat: stop.lat,
        lng: stop.lng,
        title: pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang),
      })),
    [stops, lang]
  )

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-low rounded-3xl p-4 shadow-sm">
        <div className="m3-title-md mb-3 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            {t('common.nearby')}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={onRefresh}
            disabled={locating}
          >
            <RefreshCw className={cn('mr-1.5 h-4 w-4', locating && 'animate-spin')} />
            {t('common.refreshLocation')}
          </Button>
        </div>

        {locating && (
          <div className="text-on-surface-variant m3-body-md py-2">{t('common.locating')}</div>
        )}
        {locationError && !location && (
          <div className="text-error m3-body-md flex items-center gap-2 py-2">
            <MapPin className="h-4 w-4" />
            {t('common.locationError')}: {locationError}
          </div>
        )}
        {location && (
          <div className="text-on-surface-variant m3-body-md mb-3">
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </div>
        )}

        {(loading || stops.length > 0) && (
          <div className="mb-4">
            <TransitMap
              center={mapCenter}
              markers={mapMarkers}
              userLocation={location}
              zoom={15}
              className="h-72"
            />
          </div>
        )}

        {error && (
          <div className="text-error m3-body-md flex items-center gap-2 py-2">
            <MapPin className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading && !stops.length ? (
          <div className="text-on-surface-variant m3-body-md py-4 text-center">
            {t('common.loading')}
          </div>
        ) : stops.length === 0 && !locating ? (
          <div className="text-on-surface-variant m3-body-md py-4 text-center">
            {t('common.noStopsNearby')}
          </div>
        ) : (
          <>
            <div className="m3-title-md mb-2">{t('common.nearbyStops')}</div>
            <StaggerContainer className="space-y-2" stagger={0.03}>
              {stops.map((stop) => {
                const fullName = pickLang(
                  { en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc },
                  lang
                )
                const parsed = parseKmbStopNameCached(fullName)
                return (
                  <StaggerItem key={stop.stopId}>
                    <div className="bg-surface-container hover:bg-surface-container-high rounded-2xl p-3 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="m3-body-md truncate font-medium">{parsed.name}</div>
                          <div className="text-on-surface-variant m3-label-md">
                            {parsed.stopCode ?? stop.stopId}
                          </div>
                        </div>
                        <div className="bg-primary-container text-on-primary-container m3-label-lg shrink-0 rounded-full px-2.5 py-1">
                          {formatDistanceKm(stop.distanceKm, lang)}
                        </div>
                      </div>
                    </div>
                  </StaggerItem>
                )
              })}
            </StaggerContainer>
          </>
        )}
      </div>
    </div>
  )
}

function MtrNearbyView({ lang, t }: SharedViewProps) {
  const lines = useMtrStationsByLine()

  const stationName = React.useCallback(
    (station: MtrStation) => (lang === 'en' ? station.nameEn : station.nameTc),
    [lang]
  )

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-low rounded-3xl p-4 shadow-sm">
        <div className="m3-title-md mb-3 flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          {t('common.nearby')}
        </div>

        <div className="bg-surface-container text-on-surface-variant m3-body-md mb-4 rounded-2xl p-3">
          {t('common.mtrNoCoords')}
        </div>

        <div className="m3-title-md mb-2">{t('common.allMtrLines')}</div>
        <StaggerContainer className="space-y-3" stagger={0.04}>
          {lines.map(({ line, stations }) => (
            <StaggerItem key={line}>
              <div className="bg-surface-container rounded-2xl p-3">
                <div className="m3-label-lg mb-2 flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: getLineColor(line) }}
                  />
                  {getMtrLineName(line, lang)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {stations.map((station) => (
                    <span
                      key={station.sta}
                      className="bg-surface-container-high text-on-surface-variant m3-label-md rounded-full px-2.5 py-1"
                    >
                      {stationName(station)}
                    </span>
                  ))}
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </div>
  )
}

function LrtNearbyView({ lang, t }: SharedViewProps) {
  const { routes, loading, error } = useLrtRouteStations()
  const routeGroups = useLrtStationsByRoute(routes)

  const stationName = React.useCallback(
    (station: LrtStation) => (lang === 'en' ? station.nameEn : station.nameZh),
    [lang]
  )

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-low rounded-3xl p-4 shadow-sm">
        <div className="m3-title-md mb-3 flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          {t('common.nearby')}
        </div>

        <div className="bg-surface-container text-on-surface-variant m3-body-md mb-4 rounded-2xl p-3">
          {t('common.lrtNoCoords')}
        </div>

        {loading && (
          <div className="text-on-surface-variant m3-body-md py-4 text-center">
            {t('common.loading')}
          </div>
        )}
        {error && (
          <div className="text-error m3-body-md flex items-center gap-2 py-2">
            <MapPin className="h-4 w-4" />
            {error}
          </div>
        )}

        {!loading && routeGroups.length > 0 && (
          <>
            <div className="m3-title-md mb-2">{t('common.allLrtRoutes')}</div>
            <StaggerContainer className="space-y-3" stagger={0.04}>
              {routeGroups.map((group) => (
                <StaggerItem key={group.route}>
                  <div className="bg-surface-container rounded-2xl p-3">
                    <div className="m3-label-lg mb-2 flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      {group.route}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.stations.map((station) => (
                        <span
                          key={station.stationId}
                          className="bg-surface-container-high text-on-surface-variant m3-label-md rounded-full px-2.5 py-1"
                        >
                          {stationName(station)}
                        </span>
                      ))}
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </>
        )}
      </div>
    </div>
  )
}
