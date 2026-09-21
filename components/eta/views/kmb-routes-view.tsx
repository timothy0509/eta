'use client'

import { Clock, Search, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import * as React from 'react'

import { RouteBadge } from '@/components/eta/route-badge'
import { EmptyState } from '@/components/eta/empty-state'
import { FavoriteSaveButton } from '@/components/eta/favorite-save-button'
import { OperatorFilter } from '@/components/eta/operator-filter'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { RouteResultCard } from '@/components/eta/route-result-card'
import { Input } from '@/components/ui/input'
import { RouteStopRow, RouteStopTimeline } from '@/components/eta/route-stop-timeline'
import { TickingSoonestPill } from '@/components/eta/ticking-eta'
import { RouteDrilldown } from '@/components/eta/views/route-drilldown'
import {
  fetchKmbRouteStops,
  fetchKmbRoutes,
  fetchKmbStopEtas,
  fetchKmbStops,
  type KmbEtaEntryWithLeg,
  type KmbRouteInfoLite,
  type KmbRouteStopLite,
} from '@/lib/eta/client'
import type { GeoPoint } from '@/lib/eta/geo'
import { formatKmbRouteEndpointName, parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { LINE_COLOR_FALLBACK } from '@/lib/eta/line-colors'
import { normalizeOperator } from '@/lib/eta/operator-colors'
import { pickLang } from '@/lib/eta/pick-lang'
import { getRouteBadgeStyle } from '@/lib/eta/route-badge'
import {
  buildRouteSearchIndex,
  loadRouteFuseIndex,
  operatorCounts,
  searchRouteIndex,
  type RouteFuseInstance,
} from '@/lib/eta/route-search'
import { getRoutedGeometry } from '@/lib/eta/routing'
import { useInfiniteScroll } from '@/lib/eta/use-infinite-scroll'
import { isKmbStop } from '@/lib/eta/types'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'
import { useAppStore, type FavoritesItem } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/eta/i18n'

const TransitMap = dynamic(
  () => import('@/components/eta/transit-map').then((mod) => mod.TransitMap),
  {
    ssr: false,
    loading: () => <div className="bg-surface-container ui-shimmer h-56 rounded-2xl" />,
  }
)

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

function variantBaseKey(entry: {
  co?: string
  route?: string
  bound?: string
  dir?: string
  serviceType?: string
  service_type?: string | number
}): string {
  return `${normalizeOperator(entry.co)}|${String(entry.route ?? '').toUpperCase()}|${entry.bound ?? entry.dir ?? ''}|${String(entry.serviceType ?? entry.service_type ?? '')}`
}

function hasDuplicateOperators(variants: RouteVariant[]): boolean {
  const cos = new Set(variants.map((v) => normalizeOperator(v.co)))
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
  const clickedParsed = parseKmbStopNameCached(clickedName, {
    isKmb: isKmbStop(clickedStop),
    lang,
  })
  const baseName = clickedParsed.name

  const sameBase = variantStops
    .map((rs) => ({ rs, stop: stopsById.get(rs.stopId) }))
    .filter(({ stop }) => {
      if (!stop) return false
      const name = pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
      const parsed = parseKmbStopNameCached(name, { isKmb: isKmbStop(stop), lang })
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
  const [retryKey, setRetryKey] = React.useState(0)

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
  }, [retryKey])

  const retry = React.useCallback(() => {
    setError(null)
    setLoading(true)
    setRetryKey((k) => k + 1)
  }, [])

  return { routes, loading, error, retry }
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

function useKmbRouteGeometry(variantKey: string | null, points: GeoPoint[]): GeoPoint[] | null {
  const [result, setResult] = React.useState<{
    variantKey: string
    geometry: GeoPoint[]
  } | null>(null)

  React.useEffect(() => {
    if (!variantKey || points.length < 2) return
    let cancelled = false
    getRoutedGeometry(variantKey, points)
      .then((geometry) => {
        if (!cancelled && geometry) setResult({ variantKey, geometry })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [variantKey, points])

  return result && result.variantKey === variantKey ? result.geometry : null
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
  const { t, tWithParams } = useTranslations(lang)
  const { routes, loading, error, retry } = useKmbRouteList()
  const handleRetryRoutes = React.useCallback(() => {
    retry()
  }, [retry])
  const allStops = useKmbStops()
  const stopsById = React.useMemo(() => new Map(allStops.map((s) => [s.stopId, s])), [allStops])

  const [query, setQuery] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  const [operator, setOperator] = React.useState<string | null>(null)
  const [routeStopsAll, setRouteStopsAll] = React.useState<KmbRouteStopLite[]>([])
  const [fuse, setFuse] = React.useState<RouteFuseInstance | null>(null)
  const [manualSelection, setManualSelection] = React.useState<{
    sourceKey: string
    routeKey: RouteSelection | null
    variant: RouteVariant | null
  }>({ sourceKey: '', routeKey: null, variant: null })
  const [variantStops, setVariantStops] = React.useState<KmbRouteStopLite[]>([])
  const [stopsVariantKey, setStopsVariantKey] = React.useState<string | null>(null)
  const [etas, setEtas] = React.useState<Record<string, KmbEtaEntryWithLeg[]>>({})

  const addFavorite = useAppStore((s) => s.addFavorite)

  const routeEntries = React.useMemo(() => {
    const map = new Map<string, RouteSelection>()
    for (const r of routes) {
      const co = normalizeOperator(String(r.co ?? 'kmb'))
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
        ? `${normalizeOperator(initialSelection.co)}|${initialSelection.route}|${initialSelection.bound ?? ''}|${initialSelection.serviceType ?? ''}`
        : '',
    [initialSelection]
  )

  const autoRouteKey = React.useMemo(() => {
    if (!initialSelection || routes.length === 0) return null
    const co = normalizeOperator(initialSelection.co)
    const route = initialSelection.route
    return routeEntries.find((e) => normalizeOperator(e.co) === co && e.route === route) ?? null
  }, [initialSelection, routes, routeEntries])

  const autoVariant = React.useMemo(() => {
    if (!initialSelection || !autoRouteKey || routes.length === 0) return null
    const co = normalizeOperator(initialSelection.co)
    const route = initialSelection.route
    const matchingVariants = routes.filter(
      (r) => r.route === route && normalizeOperator(String(r.co ?? 'kmb')) === co
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

  // Debounce the query so the ranker and Fuse run less often while typing.
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 150)
    return () => window.clearTimeout(id)
  }, [query])

  // Load the full route-stop table once for stop-name matching and via lines.
  React.useEffect(() => {
    let cancelled = false
    fetchKmbRouteStops()
      .then((data) => {
        if (!cancelled) setRouteStopsAll(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const searchIndex = React.useMemo(
    () => buildRouteSearchIndex(routes, routeStopsAll, stopsById),
    [routes, routeStopsAll, stopsById]
  )

  // Fuse loads lazily so the fuzzy index stays out of the first paint. The build
  // follows searchIndex so stop names join the fuzzy fallback once the
  // route-stop table arrives.
  const fuseBuildRef = React.useRef(0)
  React.useEffect(() => {
    if (searchIndex.length === 0) return
    fuseBuildRef.current += 1
    const build = fuseBuildRef.current
    let cancelled = false
    void loadRouteFuseIndex(searchIndex).then((instance) => {
      if (!cancelled && instance && fuseBuildRef.current === build) setFuse(instance)
    })
    return () => {
      cancelled = true
    }
  }, [searchIndex])

  const operatorOptions = React.useMemo(() => operatorCounts(searchIndex), [searchIndex])

  const searchHits = React.useMemo(
    () =>
      searchRouteIndex(searchIndex, debouncedQuery, {
        operator,
        lang,
        fuse,
        stopsById,
      }),
    [searchIndex, debouncedQuery, operator, lang, fuse, stopsById]
  )

  const { visibleCount, hasMore, sentinelRef, loadMore } = useInfiniteScroll({
    totalItems: searchHits.length,
    initialPageSize: 40,
    pageSize: 30,
  })
  const visibleHits = searchHits.slice(0, visibleCount)

  const handleOperatorChange = React.useCallback((code: string | null) => {
    setOperator(code)
  }, [])

  const handleClearSearch = React.useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
  }, [])

  const handleClearFilters = React.useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
    setOperator(null)
  }, [])

  const variantsForRoute = React.useMemo(() => {
    if (!selectedRouteKey) return []
    const map = new Map<string, RouteVariant>()
    for (const r of routes) {
      if (
        r.route !== selectedRouteKey.route ||
        normalizeOperator(String(r.co ?? 'kmb')) !== selectedRouteKey.co
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
      const co = normalizeOperator(currentVariant.co)
      const variantKey = variantBaseKey(currentVariant)
      const allRouteStops = routeStopsAll.length > 0 ? routeStopsAll : await fetchKmbRouteStops()
      if (cancelled) return
      const filtered = allRouteStops
        .filter(
          (rs) =>
            rs.route === currentVariant.route &&
            normalizeOperator(rs.co) === co &&
            rs.bound === currentVariant.bound &&
            rs.serviceType === currentVariant.serviceType
        )
        .sort((a, b) => a.seq - b.seq)
      setVariantStops(filtered)
      setStopsVariantKey(currentVariant.key)

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
  }, [currentVariant, routeStopsAll])

  const routePath = React.useMemo(() => {
    return variantStops
      .map((rs) => {
        const stop = stopsById.get(rs.stopId)
        return stop ? { lat: stop.lat, lng: stop.lng } : null
      })
      .filter(Boolean) as Array<{ lat: number; lng: number }>
  }, [variantStops, stopsById])

  const geometryPoints = React.useMemo(
    () => (stopsVariantKey === currentVariant?.key ? routePath : []),
    [stopsVariantKey, currentVariant, routePath]
  )
  const routedGeometry = useKmbRouteGeometry(currentVariant?.key ?? null, geometryPoints)
  const displayPath = routedGeometry ?? routePath

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

  const mapPolylines = React.useMemo(() => {
    if (!currentVariant) return []
    return [{ id: currentVariant.key, path: displayPath, color: '#00478d' }]
  }, [currentVariant, displayPath])

  const onSaveRoute = () => {
    if (!currentVariant) return
    const item: FavoritesItem = {
      id: `kmb:route:${currentVariant.co}:${currentVariant.route}:${currentVariant.bound}:${currentVariant.serviceType}`,
      mode: 'kmb',
      type: 'route',
      title: `${currentVariant.route} ${formatKmbRouteEndpointName(
        pickLang(currentVariant.destination, lang),
        { co: currentVariant.co, lang }
      )}`,
      route: currentVariant.route,
      co: currentVariant.co,
      bound: currentVariant.bound,
      serviceType: currentVariant.serviceType,
      origin: currentVariant.origin,
      destination: currentVariant.destination,
    }
    addFavorite(item)
  }

  return (
    <div className="space-y-4">
      <div className="card-m3 p-4">
        <div className="m3-title-md mb-3">{t('kmb.routes')}</div>
        <div className="relative">
          <Search className="text-on-surface-variant absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('kmb.searchRouteNumberAndPlace')}
            aria-label={t('kmb.searchBusRoutes')}
            className="bg-surface-container h-12 rounded-full pr-10 pl-10"
          />
          {query.trim() !== '' && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label={t('kmb.clearSearch')}
              className="text-on-surface-variant hover:text-on-surface ui-press absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
        <div className="mt-3">
          <OperatorFilter
            operators={operatorOptions}
            total={searchIndex.length}
            value={operator}
            onChange={handleOperatorChange}
            lang={lang}
          />
        </div>

        {loading && <ResultsSkeleton />}
        {error && (
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

        {!selectedRouteKey ? (
          !loading && !error && searchHits.length === 0 ? (
            <EmptyState
              title={t('common.noResults')}
              hint={
                debouncedQuery.trim() !== ''
                  ? tWithParams('kmb.noRoutesMatch', { query: debouncedQuery.trim() })
                  : undefined
              }
              action={
                debouncedQuery.trim() !== '' || operator !== null ? (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="bg-primary text-on-primary m3-label-lg ui-press mt-2 inline-flex min-h-[44px] items-center rounded-full px-5 py-2 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {t('kmb.clearFilters')}
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="mt-3 space-y-3">
              {!loading && !error && (
                <div className="text-on-surface-variant m3-label-md" role="status">
                  {tWithParams('kmb.routesFound', { count: searchHits.length })}
                </div>
              )}
              <div className="space-y-3">
                {visibleHits.map((hit, idx) => (
                  <RouteResultCard
                    key={hit.entry.key}
                    entry={hit.entry}
                    stopsById={stopsById}
                    lang={lang}
                    index={idx}
                    matchReason={hit.matchReason}
                    onSelect={() =>
                      setSelectedRouteKey({
                        co: hit.entry.co,
                        route: hit.entry.route,
                      })
                    }
                  />
                ))}
              </div>
              {hasMore && (
                <div ref={sentinelRef}>
                  <button
                    type="button"
                    onClick={loadMore}
                    className="bg-surface-container-high text-on-surface-variant hover:text-on-surface m3-label-lg ui-press inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-5 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {t('kmb.loadMore')}
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          <RouteDrilldown
            lang={lang}
            onBack={() => {
              setSelectedRouteKey(null)
              setSelectedVariant(null)
            }}
            title={
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <RouteBadge
                    route={selectedRouteKey.route}
                    company={selectedRouteKey.co}
                    size="lg"
                  />
                  <span className="text-on-surface-variant m3-label-md uppercase">
                    {selectedRouteKey.co}
                  </span>
                </span>
                {currentVariant && (
                  <span className="text-on-surface m3-title-md truncate">
                    {formatKmbRouteEndpointName(pickLang(currentVariant.origin, lang), {
                      co: currentVariant.co,
                      lang,
                    })}{' '}
                    →{' '}
                    {formatKmbRouteEndpointName(pickLang(currentVariant.destination, lang), {
                      co: currentVariant.co,
                      lang,
                    })}
                  </span>
                )}
              </span>
            }
          >
            {variantsForRoute.length > 1 && (
              <div
                className="flex gap-2 overflow-x-auto pb-1"
                role="group"
                aria-label={t('common.route')}
              >
                {variantsForRoute.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    aria-pressed={currentVariant?.key === v.key}
                    onClick={() => setSelectedVariant(v)}
                    className={cn(
                      'ui-press inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      currentVariant?.key === v.key
                        ? 'bg-primary-container text-on-primary-container'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                    )}
                  >
                    <span>{v.bound === 'I' ? t('common.inbound') : t('common.outbound')}</span>
                    <span>
                      {formatKmbRouteEndpointName(pickLang(v.destination, lang), {
                        co: v.co,
                        lang,
                      })}
                    </span>
                    {showOperatorInVariants && (
                      <span className="m3-label-sm uppercase opacity-80">
                        {normalizeOperator(v.co)}
                      </span>
                    )}
                    {v.serviceType !== '1' ? (
                      <span className="m3-label-sm opacity-80">· {v.serviceType}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}

            {currentVariant && (
              <div className="flex items-center justify-between gap-3">
                <div className="text-on-surface-variant m3-body-md">
                  {formatKmbRouteEndpointName(pickLang(currentVariant.origin, lang), {
                    co: currentVariant.co,
                    lang,
                  })}{' '}
                  →{' '}
                  {formatKmbRouteEndpointName(pickLang(currentVariant.destination, lang), {
                    co: currentVariant.co,
                    lang,
                  })}
                </div>
                <FavoriteSaveButton onSave={onSaveRoute} label={t('common.save')} />
              </div>
            )}
          </RouteDrilldown>
        )}
      </div>

      {currentVariant && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card-m3 p-4">
            <div className="m3-title-md mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('kmb.routeStops')}
            </div>
            {variantStops.length === 0 ? (
              <ResultsSkeleton />
            ) : (
              <RouteStopTimeline
                lineColor={
                  currentVariant
                    ? getRouteBadgeStyle(currentVariant.route, currentVariant.co).bgColor
                    : LINE_COLOR_FALLBACK
                }
              >
                {variantStops.map((rs) => {
                  const stop = stopsById.get(rs.stopId)
                  const stopEtas = etas[rs.stopId] ?? []
                  const fullName = stop
                    ? pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
                    : rs.stopId
                  const parsed = parseKmbStopNameCached(fullName, {
                    isKmb: isKmbStop(stop),
                    lang,
                  })
                  const group = getStopGroupForClick(rs.stopId, variantStops, stopsById, lang)
                  return (
                    <RouteStopRow
                      key={rs.stopId}
                      name={<span className="font-medium">{parsed.name}</span>}
                      subtitle={parsed.stopCode}
                      ariaLabel={parsed.name}
                      eta={<TickingSoonestPill etas={stopEtas} lang={lang} />}
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

          <div className="card-m3 p-4">
            <div className="m3-title-md mb-3">{t('common.map')}</div>
            <TransitMap
              center={mapCenter}
              markers={mapMarkers}
              polylines={mapPolylines}
              zoom={13}
              className="h-96"
            />
          </div>
        </div>
      )}
    </div>
  )
}
