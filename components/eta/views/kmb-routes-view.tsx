'use client'

import { AlertCircle, Clock, Heart, Search } from 'lucide-react'
import dynamic from 'next/dynamic'
import * as React from 'react'

import { RouteBadge } from '@/components/eta/route-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  RouteStopRow,
  RouteStopTimeline,
  SoonestEtaPill,
} from '@/components/eta/route-stop-timeline'
import { StaggerContainer, StaggerItem } from '@/components/m3/motion'
import {
  fetchKmbRouteStops,
  fetchKmbRoutes,
  fetchKmbStopEtas,
  fetchKmbStops,
  type KmbEtaEntryWithLeg,
  type KmbRouteInfoLite,
  type KmbRouteStopLite,
} from '@/lib/eta/client'
import { formatRelativeMinutesWithDrift } from '@/lib/eta/format'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { getRouteBadgeStyle } from '@/lib/eta/route-badge'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'
import { useTickingNow } from '@/lib/eta/use-ticking-now'
import { useAppStore, type FavoritesItem } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/eta/i18n'

const TransitMap = dynamic(
  () => import('@/components/eta/transit-map').then((mod) => mod.TransitMap),
  {
    ssr: false,
    loading: () => <div className="bg-surface-container h-56 animate-pulse rounded-2xl" />,
  }
)

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

type RouteSelection = {
  co: string
  route: string
}

function normalizeCo(co: string | undefined): string {
  return String(co ?? 'kmb').toLowerCase()
}

function routeSelectionKey(sel: RouteSelection): string {
  return `${normalizeCo(sel.co)}|${sel.route}`
}

function variantBaseKey(entry: {
  co?: string
  route?: string
  bound?: string
  dir?: string
  serviceType?: string
  service_type?: string | number
}): string {
  return `${normalizeCo(entry.co)}|${String(entry.route ?? '').toUpperCase()}|${entry.bound ?? entry.dir ?? ''}|${String(entry.serviceType ?? entry.service_type ?? '')}`
}

function hasDuplicateRouteNumbers(entries: RouteSelection[]): boolean {
  const routeCounts = new Map<string, number>()
  for (const entry of entries) {
    const route = entry.route.toUpperCase()
    routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1)
  }
  return Array.from(routeCounts.values()).some((count) => count > 1)
}

function hasDuplicateOperators(variants: RouteVariant[]): boolean {
  const cos = new Set(variants.map((v) => normalizeCo(v.co)))
  return cos.size > 1
}

function getStopGroupForClick(
  clickedStopId: string,
  variantStops: KmbRouteStopLite[],
  stopsById: Map<string, KmbStopSearchItem>,
  lang: UiLanguage
): { stopIds: string[]; title: string } | null {
  const clickedStop = stopsById.get(clickedStopId)
  if (!clickedStop) return null

  const clickedName = pickLang(
    { en: clickedStop.nameEn, tc: clickedStop.nameTc, sc: clickedStop.nameSc },
    lang
  )
  const clickedParsed = parseKmbStopNameCached(clickedName)
  const baseName = clickedParsed.name

  const sameBase = variantStops
    .map((rs) => ({ rs, stop: stopsById.get(rs.stopId) }))
    .filter(({ stop }) => {
      if (!stop) return false
      const name = pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
      const parsed = parseKmbStopNameCached(name)
      return parsed.name === baseName
    })
    .map(({ rs }) => rs.stopId)

  if (!sameBase.length) return null
  return { stopIds: sameBase, title: baseName }
}

function useKmbRouteList() {
  const [routes, setRoutes] = React.useState<KmbRouteInfoLite[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetchKmbRoutes()
      .then((data) => {
        if (cancelled) return
        setRoutes(
          data.map((entry) => ({
            co: entry.co ?? 'kmb',
            route: entry.route,
            bound: entry.bound,
            serviceType: String(entry.service_type),
            origin: {
              en: (entry.orig_en ?? '').trim(),
              tc: (entry.orig_tc ?? '').trim(),
              sc: (entry.orig_sc ?? '').trim(),
            },
            destination: {
              en: (entry.dest_en ?? '').trim(),
              tc: (entry.dest_tc ?? '').trim(),
              sc: (entry.dest_sc ?? '').trim(),
            },
          }))
        )
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

export function KmbRoutesView({
  lang,
  initialSelection,
  onSelectStopGroup,
}: {
  lang: UiLanguage
  initialSelection?: { co: string; route: string; bound?: string; serviceType?: string }
  onSelectStopGroup?: (payload: { stopIds: string[]; title: string; route: string }) => void
}) {
  const { t } = useTranslations(lang)
  const { routes, loading, error } = useKmbRouteList()
  const allStops = useKmbStops()
  const stopsById = React.useMemo(() => new Map(allStops.map((s) => [s.stopId, s])), [allStops])

  const [query, setQuery] = React.useState('')
  const [manualSelection, setManualSelection] = React.useState<{
    sourceKey: string
    routeKey: RouteSelection | null
    variant: RouteVariant | null
  }>({ sourceKey: '', routeKey: null, variant: null })
  const [variantStops, setVariantStops] = React.useState<KmbRouteStopLite[]>([])
  const [etas, setEtas] = React.useState<Record<string, KmbEtaEntryWithLeg[]>>({})

  const addFavorite = useAppStore((s) => s.addFavorite)

  const routeEntries = React.useMemo(() => {
    const map = new Map<string, RouteSelection>()
    for (const r of routes) {
      const co = normalizeCo(String(r.co ?? 'kmb'))
      const key = `${co}|${r.route}`
      if (!map.has(key)) map.set(key, { co, route: r.route })
    }
    return Array.from(map.values()).sort((a, b) =>
      a.route.localeCompare(b.route, undefined, { numeric: true })
    )
  }, [routes])

  const initialKey = React.useMemo(
    () =>
      initialSelection
        ? `${normalizeCo(initialSelection.co)}|${initialSelection.route}|${initialSelection.bound ?? ''}|${initialSelection.serviceType ?? ''}`
        : '',
    [initialSelection]
  )

  const autoRouteKey = React.useMemo(() => {
    if (!initialSelection || routes.length === 0) return null
    const co = normalizeCo(initialSelection.co)
    const route = initialSelection.route
    return routeEntries.find((e) => normalizeCo(e.co) === co && e.route === route) ?? null
  }, [initialSelection, routes, routeEntries])

  const autoVariant = React.useMemo(() => {
    if (!initialSelection || !autoRouteKey || routes.length === 0) return null
    const co = normalizeCo(initialSelection.co)
    const route = initialSelection.route
    const matchingVariants = routes.filter(
      (r) => r.route === route && normalizeCo(String(r.co ?? 'kmb')) === co
    )
    if (!matchingVariants.length) return null
    const matchedVariant =
      initialSelection.bound !== undefined
        ? matchingVariants.find(
            (v) =>
              v.bound === initialSelection.bound &&
              (initialSelection.serviceType ? v.serviceType === initialSelection.serviceType : true)
          )
        : undefined
    const target = matchedVariant ?? matchingVariants[0]
    if (!target) return null
    return {
      key: `${target.co}|${target.route}|${target.bound}|${target.serviceType}`,
      co: String(target.co ?? 'kmb'),
      route: target.route,
      bound: target.bound,
      serviceType: target.serviceType,
      origin: target.origin,
      destination: target.destination,
    }
  }, [autoRouteKey, initialSelection, routes])

  const selectedRouteKey =
    manualSelection.sourceKey === initialKey ? manualSelection.routeKey : autoRouteKey
  const selectedVariant =
    manualSelection.sourceKey === initialKey ? manualSelection.variant : autoVariant

  const setSelectedRouteKey = React.useCallback(
    (routeKey: RouteSelection | null) => {
      setManualSelection((prev) => ({ ...prev, sourceKey: initialKey, routeKey, variant: null }))
    },
    [initialKey]
  )

  const setSelectedVariant = React.useCallback(
    (variant: RouteVariant | null) => {
      setManualSelection((prev) => ({ ...prev, sourceKey: initialKey, variant }))
    },
    [initialKey]
  )

  const showOperatorInSearch = React.useMemo(
    () => hasDuplicateRouteNumbers(routeEntries),
    [routeEntries]
  )

  const filteredRoutes = React.useMemo(() => {
    const needle = query.trim().toUpperCase()
    const matches = needle
      ? routeEntries.filter((e) => e.route.toUpperCase().includes(needle))
      : routeEntries
    return matches.slice(0, 30)
  }, [query, routeEntries])

  const variantsForRoute = React.useMemo(() => {
    if (!selectedRouteKey) return []
    const map = new Map<string, RouteVariant>()
    for (const r of routes) {
      if (
        r.route !== selectedRouteKey.route ||
        normalizeCo(String(r.co ?? 'kmb')) !== selectedRouteKey.co
      ) {
        continue
      }
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
  }, [routes, selectedRouteKey])

  const showOperatorInVariants = React.useMemo(
    () => hasDuplicateOperators(variantsForRoute),
    [variantsForRoute]
  )

  const currentVariant = React.useMemo(() => {
    if (!selectedRouteKey) return null
    if (selectedVariant && variantsForRoute.some((v) => v.key === selectedVariant.key)) {
      return selectedVariant
    }
    return variantsForRoute[0] ?? null
  }, [selectedRouteKey, selectedVariant, variantsForRoute])

  React.useEffect(() => {
    if (!currentVariant) return
    let cancelled = false
    const load = async () => {
      const co = normalizeCo(currentVariant.co)
      const variantKey = variantBaseKey(currentVariant)
      const allRouteStops = await fetchKmbRouteStops()
      if (cancelled) return
      const filtered = allRouteStops
        .filter(
          (rs) =>
            rs.route === currentVariant.route &&
            normalizeCo(rs.co) === co &&
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
      if (cancelled) return
      const filteredEtas: Record<string, KmbEtaEntryWithLeg[]> = {}
      for (const [stopId, entries] of Object.entries(res.byStopId)) {
        filteredEtas[stopId] = (entries ?? []).filter((eta) => variantBaseKey(eta) === variantKey)
      }
      setEtas(filteredEtas)
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

        {!selectedRouteKey ? (
          <StaggerContainer className="mt-3 flex flex-wrap gap-2" stagger={0.02}>
            {filteredRoutes.map((entry) => (
              <StaggerItem key={routeSelectionKey(entry)}>
                <button
                  type="button"
                  onClick={() => setSelectedRouteKey(entry)}
                  className="bg-surface-container-high hover:bg-surface-container hover:elevation-1 m3-label-lg flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors"
                >
                  <RouteBadge route={entry.route} company={entry.co} size="sm" />
                  {showOperatorInSearch && (
                    <span className="text-on-surface-variant m3-label-sm uppercase">
                      {entry.co}
                    </span>
                  )}
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
                  setSelectedRouteKey(null)
                  setSelectedVariant(null)
                }}
                className="text-primary m3-label-lg"
              >
                ← {t('common.back') ?? 'Back'}
              </button>
              <RouteBadge route={selectedRouteKey.route} company={selectedRouteKey.co} size="lg" />
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
                    {showOperatorInVariants && (
                      <span className="mr-1 uppercase">{normalizeCo(v.co)}</span>
                    )}
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
              <RouteStopTimeline
                lineColor={
                  currentVariant
                    ? getRouteBadgeStyle(currentVariant.route, currentVariant.co).bgColor
                    : '#64748b'
                }
              >
                {variantStops.map((rs) => {
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
                  const group = getStopGroupForClick(rs.stopId, variantStops, stopsById, lang)
                  return (
                    <RouteStopRow
                      key={rs.stopId}
                      name={<span className="font-medium">{parsed.name}</span>}
                      subtitle={parsed.stopCode}
                      eta={
                        firstEta ? (
                          <SoonestEtaPill
                            minutes={minutes}
                            arriving={minutes !== null && minutes <= 0}
                            lang={lang}
                          />
                        ) : (
                          <SoonestEtaPill minutes={null} lang={lang} />
                        )
                      }
                      onClick={
                        onSelectStopGroup && group
                          ? () =>
                              onSelectStopGroup({
                                stopIds: group.stopIds,
                                title: group.title,
                                route: currentVariant.route,
                              })
                          : undefined
                      }
                    />
                  )
                })}
              </RouteStopTimeline>
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
