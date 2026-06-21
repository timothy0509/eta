'use client'

import { AlertCircle, Clock, Heart, MapPin, Search } from 'lucide-react'
import * as React from 'react'

import { TransitMap } from '@/components/eta/transit-map'
import { RouteBadge } from '@/components/eta/route-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LivePulse, StaggerContainer, StaggerItem } from '@/components/m3/motion'
import {
  fetchKmbRouteInfo,
  fetchKmbRouteStops,
  fetchKmbStopEtas,
  fetchKmbStops,
  type KmbEtaEntryWithLeg,
  type KmbRouteInfoLite,
  type KmbRouteStopLite,
} from '@/lib/eta/client'
import { formatRelativeMinutesWithDrift } from '@/lib/eta/format'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'
import { useTickingNow } from '@/lib/eta/use-ticking-now'
import { useAppStore, type FavoritesItem } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/eta/i18n'
import type { Company } from 'hk-bus-eta'

function pickLang<T>(record: { en: T; tc: T; sc: T }, lang: UiLanguage): T {
  if (lang === 'sc') return record.sc
  if (lang === 'en') return record.en
  return record.tc
}

type RouteVariant = {
  key: string
  co: string
  route: string
  bound: string
  serviceType: string
  origin: { en: string; tc: string; sc: string }
  destination: { en: string; tc: string; sc: string }
}

function useKmbRouteList() {
  const [routes, setRoutes] = React.useState<KmbRouteInfoLite[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetchKmbRouteStops()
      .then(async (routeStops) => {
        const uniqueKeys = new Set<string>()
        const variants: Array<{ co: Company; route: string; bound: string; serviceType: string }> =
          []
        for (const rs of routeStops) {
          const key = `${rs.co}|${rs.route}|${rs.bound}|${rs.serviceType}`
          if (uniqueKeys.has(key)) continue
          uniqueKeys.add(key)
          variants.push({
            co: rs.co,
            route: rs.route,
            bound: rs.bound,
            serviceType: rs.serviceType,
          })
        }
        const infos = await Promise.allSettled(
          variants.map((v) =>
            fetchKmbRouteInfo({
              co: v.co,
              route: v.route,
              direction: v.bound,
              serviceType: v.serviceType,
            })
          )
        )
        const result: KmbRouteInfoLite[] = []
        for (const item of infos) {
          if (item.status === 'fulfilled') result.push(item.value)
        }
        if (!cancelled) setRoutes(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load routes')
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

function useKmbStops() {
  const [stops, setStops] = React.useState<KmbStopSearchItem[]>([])
  React.useEffect(() => {
    let cancelled = false
    fetchKmbStops()
      .then((data) => {
        if (!cancelled) setStops(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return stops
}

export function KmbRoutesView({ lang }: { lang: UiLanguage }) {
  const { t } = useTranslations(lang)
  const { routes, loading, error } = useKmbRouteList()
  const allStops = useKmbStops()
  const stopsById = React.useMemo(() => new Map(allStops.map((s) => [s.stopId, s])), [allStops])

  const [query, setQuery] = React.useState('')
  const [selectedRoute, setSelectedRoute] = React.useState<string | null>(null)
  const [selectedVariant, setSelectedVariant] = React.useState<RouteVariant | null>(null)
  const [variantStops, setVariantStops] = React.useState<KmbRouteStopLite[]>([])
  const [etas, setEtas] = React.useState<Record<string, KmbEtaEntryWithLeg[]>>({})

  const addFavorite = useAppStore((s) => s.addFavorite)

  const routeNumbers = React.useMemo(() => {
    const set = new Set<string>()
    for (const r of routes) set.add(r.route)
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [routes])

  const filteredRoutes = React.useMemo(() => {
    const needle = query.trim().toUpperCase()
    if (!needle) return routeNumbers.slice(0, 30)
    return routeNumbers.filter((r) => r.toUpperCase().includes(needle)).slice(0, 30)
  }, [query, routeNumbers])

  const variantsForRoute = React.useMemo(() => {
    if (!selectedRoute) return []
    const map = new Map<string, RouteVariant>()
    for (const r of routes) {
      if (r.route !== selectedRoute) continue
      const key = `${r.co}|${r.route}|${r.bound}|${r.serviceType}`
      if (map.has(key)) continue
      map.set(key, {
        key,
        co: String(r.co ?? 'kmb'),
        route: r.route,
        bound: r.bound,
        serviceType: r.serviceType,
        origin: r.origin,
        destination: r.destination,
      })
    }
    return Array.from(map.values()).sort(
      (a, b) => a.bound.localeCompare(b.bound) || a.serviceType.localeCompare(b.serviceType)
    )
  }, [routes, selectedRoute])

  const currentVariant = React.useMemo(() => {
    if (!selectedRoute) return null
    if (selectedVariant && variantsForRoute.some((v) => v.key === selectedVariant.key)) {
      return selectedVariant
    }
    return variantsForRoute[0] ?? null
  }, [selectedRoute, selectedVariant, variantsForRoute])

  React.useEffect(() => {
    if (!currentVariant) return
    let cancelled = false
    const load = async () => {
      const allRouteStops = await fetchKmbRouteStops()
      if (cancelled) return
      const filtered = allRouteStops
        .filter(
          (rs) =>
            rs.route === currentVariant.route &&
            rs.bound === currentVariant.bound &&
            rs.serviceType === currentVariant.serviceType
        )
        .sort((a, b) => a.seq - b.seq)
      setVariantStops(filtered)

      const stopIds = filtered.map((rs) => rs.stopId)
      if (!stopIds.length) return
      const res = await fetchKmbStopEtas(stopIds, {
        routeFilter: currentVariant.route,
        includeFares: false,
      })
      if (!cancelled) setEtas(res.byStopId)
    }
    void load().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [currentVariant])

  const routePath = React.useMemo(() => {
    return variantStops
      .map((rs) => {
        const stop = stopsById.get(rs.stopId)
        return stop ? { lat: stop.lat, lng: stop.lng } : null
      })
      .filter(Boolean) as Array<{ lat: number; lng: number }>
  }, [variantStops, stopsById])

  const mapCenter = React.useMemo(() => {
    if (routePath.length) return routePath[Math.floor(routePath.length / 2)]
    return { lat: 22.3193, lng: 114.1694 }
  }, [routePath])

  const mapMarkers = React.useMemo(() => {
    return variantStops
      .map((rs) => {
        const stop = stopsById.get(rs.stopId)
        if (!stop) return null
        return { id: rs.stopId, lat: stop.lat, lng: stop.lng, title: stop.nameEn }
      })
      .filter(Boolean) as Array<{ id: string; lat: number; lng: number; title?: string }>
  }, [variantStops, stopsById])

  const onSaveRoute = () => {
    if (!currentVariant) return
    const item: FavoritesItem = {
      id: `kmb:route:${currentVariant.co}:${currentVariant.route}:${currentVariant.bound}:${currentVariant.serviceType}`,
      mode: 'kmb',
      type: 'route',
      title: `${currentVariant.route} ${pickLang(currentVariant.destination, lang)}`,
      route: currentVariant.route,
      co: currentVariant.co,
      bound: currentVariant.bound,
      serviceType: currentVariant.serviceType,
      origin: currentVariant.origin,
      destination: currentVariant.destination,
    }
    addFavorite(item)
  }

  const now = useTickingNow(15_000)

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-low rounded-3xl p-4 shadow-sm">
        <div className="m3-title-md mb-3">{t('kmb.routes')}</div>
        <div className="relative">
          <Search className="text-on-surface-variant absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === 'en' ? 'Search route number…' : '搜尋路線編號…'}
            className="bg-surface-container h-12 rounded-full pl-10"
          />
        </div>

        {loading && (
          <div className="text-on-surface-variant m3-body-md py-4 text-center">Loading…</div>
        )}
        {error && (
          <div className="text-error mt-3 flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {!selectedRoute ? (
          <StaggerContainer className="mt-3 flex flex-wrap gap-2" stagger={0.02}>
            {filteredRoutes.map((route) => (
              <StaggerItem key={route}>
                <button
                  type="button"
                  onClick={() => setSelectedRoute(route)}
                  className="bg-surface-container-high hover:bg-surface-container hover:elevation-1 m3-label-lg rounded-full px-4 py-2 transition-colors"
                >
                  {route}
                </button>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRoute(null)
                  setSelectedVariant(null)
                }}
                className="text-primary m3-label-lg"
              >
                ← {t('common.back') ?? 'Back'}
              </button>
              <RouteBadge route={selectedRoute} size="lg" />
            </div>

            {variantsForRoute.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {variantsForRoute.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setSelectedVariant(v)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                      currentVariant?.key === v.key
                        ? 'bg-primary-container text-on-primary-container'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                    )}
                  >
                    {v.bound === 'I'
                      ? lang === 'en'
                        ? 'Inbound'
                        : '往'
                      : lang === 'en'
                        ? 'Outbound'
                        : '往'}{' '}
                    {pickLang(v.destination, lang)}
                    {v.serviceType !== '1' ? ` · ${v.serviceType}` : ''}
                  </button>
                ))}
              </div>
            )}

            {currentVariant && (
              <div className="flex items-center justify-between gap-3">
                <div className="text-on-surface-variant m3-body-md">
                  {pickLang(currentVariant.origin, lang)} →{' '}
                  {pickLang(currentVariant.destination, lang)}
                </div>
                <Button size="sm" className="rounded-full" onClick={onSaveRoute}>
                  <Heart className="mr-1.5 h-4 w-4" />
                  {t('common.save')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {currentVariant && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="bg-surface-container-low rounded-3xl p-4 shadow-sm">
            <div className="m3-title-md mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('kmb.routeStops')}
            </div>
            {variantStops.length === 0 ? (
              <div className="text-on-surface-variant py-8 text-center">{t('common.loading')}</div>
            ) : (
              <StaggerContainer className="relative space-y-0 pl-2" stagger={0.02}>
                <div className="bg-outline-variant absolute top-2 bottom-2 left-[19px] w-px" />
                {variantStops.map((rs, _idx) => {
                  const stop = stopsById.get(rs.stopId)
                  const stopEtas = etas[rs.stopId] ?? []
                  const firstEta = stopEtas[0]
                  const minutes = firstEta?.eta
                    ? formatRelativeMinutesWithDrift(firstEta.eta, firstEta.data_timestamp, now)
                    : null
                  const fullName = stop
                    ? pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
                    : rs.stopId
                  const parsed = parseKmbStopNameCached(fullName)
                  return (
                    <StaggerItem key={rs.stopId}>
                      <div className="relative flex items-center gap-4 py-2">
                        <div className="bg-surface border-outline z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border">
                          <MapPin className="text-on-surface-variant h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="m3-body-md truncate font-medium">{parsed.name}</div>
                          <div className="text-on-surface-variant m3-label-md">
                            {parsed.stopCode}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {firstEta ? (
                            <div className="bg-primary-container text-on-primary-container flex items-center gap-1.5 rounded-full px-3 py-1">
                              <LivePulse />
                              <span className="m3-title-md">
                                {minutes !== null && minutes <= 0
                                  ? t('common.now')
                                  : `${minutes} ${lang === 'en' ? 'min' : '分'}`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-on-surface-variant m3-label-md">—</span>
                          )}
                        </div>
                      </div>
                    </StaggerItem>
                  )
                })}
              </StaggerContainer>
            )}
          </div>

          <div className="bg-surface-container-low rounded-3xl p-4 shadow-sm">
            <div className="m3-title-md mb-3">{t('common.map') ?? 'Map'}</div>
            <TransitMap
              center={mapCenter}
              markers={mapMarkers}
              polylines={[{ id: currentVariant.key, path: routePath, color: '#00478d' }]}
              zoom={13}
              className="h-96"
            />
          </div>
        </div>
      )}
    </div>
  )
}
