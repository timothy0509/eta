'use client'

import { ExternalLink, Search, X } from 'lucide-react'
import * as React from 'react'

import { EmptyState } from '@/components/eta/empty-state'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { RouteBadge } from '@/components/eta/route-badge'
import { staggerClassForIndex } from '@/components/eta/stagger-list'
import { Input } from '@/components/ui/input'
import { fetchGmbRoutes } from '@/lib/eta/direct/gmb'
import {
  GMB_DISTRICTS,
  filterGmbRoutes,
  gmbDetailUrl,
  type GmbDistrict,
  type GmbRouteEntry,
} from '@/lib/eta/gmb'
import { formatFareHkd } from '@/lib/eta/format'
import { useTranslations } from '@/lib/eta/i18n'
import { pickLang } from '@/lib/eta/pick-lang'
import type { UiLanguage } from '@/lib/eta/types'
import { useInfiniteScroll } from '@/lib/eta/use-infinite-scroll'
import { cn } from '@/lib/utils'

const SERVICE_MODE_KEYS: Record<string, string> = {
  A: 'gmb.serviceA',
  R: 'gmb.serviceR',
  T: 'gmb.serviceT',
  N: 'gmb.serviceN',
  NT: 'gmb.serviceNT',
}

function servicePattern(route: GmbRouteEntry, t: (key: string) => string): string {
  const modeKey = SERVICE_MODE_KEYS[route.serviceMode]
  const parts = [modeKey ? t(modeKey) : route.serviceMode]
  if (route.specialType >= 1 && route.specialType <= 3) {
    parts.push(t(`gmb.special${route.specialType}`))
  }
  return parts.join(' · ')
}

function GmbRouteCard({
  route,
  lang,
  index,
}: {
  route: GmbRouteEntry
  lang: UiLanguage
  index: number
}) {
  const { t, tWithParams } = useTranslations(lang)
  const name = pickLang(route.name, lang)
  const origin = pickLang(route.origin, lang)
  const destination = pickLang(route.destination, lang)
  const fare = formatFareHkd(route.fullFare)
  return (
    <article
      className={cn(
        'bg-surface-container-low ui-cv-row rounded-2xl border border-[var(--outline-variant)]/15 p-4',
        staggerClassForIndex(index)
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <RouteBadge route={name} company="gmb" size="md" />
        <span className="text-on-surface m3-title-md min-w-0 flex-1 truncate">
          {origin} → {destination}
        </span>
      </div>
      <div className="text-on-surface-variant m3-body-md mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{t(`gmb.district${route.district}`)}</span>
        <span aria-hidden>·</span>
        <span>{servicePattern(route, t)}</span>
        <span aria-hidden>·</span>
        <span>{tWithParams('gmb.journeyTime', { count: route.journeyTime })}</span>
        <span aria-hidden>·</span>
        <span className="font-tabular">{fare ?? '—'}</span>
      </div>
      <div className="mt-3">
        <a
          href={gmbDetailUrl(route.routeId, lang)}
          target="_blank"
          rel="noreferrer"
          className="text-primary m3-label-lg ui-press inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          {t('gmb.officialDetails')}
        </a>
      </div>
    </article>
  )
}

export function GmbRoutesView({ lang }: { lang: UiLanguage }) {
  const { t, tWithParams } = useTranslations(lang)
  const [routes, setRoutes] = React.useState<GmbRouteEntry[]>([])
  const [cutoffDate, setCutoffDate] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [retryKey, setRetryKey] = React.useState(0)
  const [query, setQuery] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  const [district, setDistrict] = React.useState<GmbDistrict | 'all'>('all')

  React.useEffect(() => {
    let cancelled = false
    fetchGmbRoutes()
      .then((file) => {
        if (cancelled) return
        setRoutes(file.routes)
        setCutoffDate(file.meta.cutoffDate)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('common.wentWrong'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [retryKey, t])

  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 150)
    return () => window.clearTimeout(id)
  }, [query])

  const districtCounts = React.useMemo(() => {
    const counts = new Map<GmbDistrict, number>()
    for (const route of routes) counts.set(route.district, (counts.get(route.district) ?? 0) + 1)
    return counts
  }, [routes])

  const hits = React.useMemo(
    () => filterGmbRoutes(routes, { query: debouncedQuery, district }),
    [routes, debouncedQuery, district]
  )

  const { visibleCount, hasMore, sentinelRef, loadMore } = useInfiniteScroll({
    totalItems: hits.length,
    initialPageSize: 40,
    pageSize: 30,
  })
  const visibleHits = hits.slice(0, visibleCount)

  const handleRetry = React.useCallback(() => {
    setError(null)
    setLoading(true)
    setRetryKey((k) => k + 1)
  }, [])

  const handleClearFilters = React.useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
    setDistrict('all')
  }, [])

  const districtOptions: Array<{ id: GmbDistrict | 'all'; label: string; count: number }> =
    React.useMemo(
      () => [
        { id: 'all', label: t('common.operatorAll'), count: routes.length },
        ...GMB_DISTRICTS.map((id) => ({
          id: id as GmbDistrict | 'all',
          label: t(`gmb.district${id}`),
          count: districtCounts.get(id) ?? 0,
        })),
      ],
      [districtCounts, routes.length, t]
    )

  return (
    <div className="card-m3 space-y-4 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="m3-title-md">{t('gmb.title')}</div>
        {cutoffDate ? (
          <div className="text-on-surface-variant m3-label-md">
            {tWithParams('gmb.dataRevised', { date: cutoffDate })}
          </div>
        ) : null}
      </div>

      <div className="relative">
        <Search className="text-on-surface-variant absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('gmb.searchPlaceholder')}
          aria-label={t('gmb.searchRoutes')}
          className="bg-surface-container h-12 rounded-full pr-10 pl-10"
        />
        {query.trim() !== '' && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setDebouncedQuery('')
            }}
            aria-label={t('kmb.clearSearch')}
            className="text-on-surface-variant hover:text-on-surface ui-press absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('gmb.district')}>
        {districtOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={district === option.id}
            onClick={() => setDistrict(option.id)}
            className={cn(
              'ui-press inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
              district === option.id
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            )}
          >
            {option.label}
            <span className="font-tabular opacity-80">{option.count}</span>
          </button>
        ))}
      </div>

      {loading && <ResultsSkeleton />}
      {error && !loading && (
        <EmptyState
          title={t('common.wentWrong')}
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

      {!loading && !error && hits.length === 0 && (
        <EmptyState
          title={t('common.noResults')}
          hint={
            debouncedQuery.trim() !== ''
              ? tWithParams('gmb.noRoutesMatch', { query: debouncedQuery.trim() })
              : undefined
          }
          action={
            debouncedQuery.trim() !== '' || district !== 'all' ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="bg-primary text-on-primary m3-label-lg ui-press mt-2 inline-flex min-h-[44px] items-center rounded-full px-5 py-2 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
              >
                {t('gmb.clearFilters')}
              </button>
            ) : undefined
          }
        />
      )}

      {!loading && !error && hits.length > 0 && (
        <div className="space-y-3">
          <div className="text-on-surface-variant m3-label-md" role="status">
            {tWithParams('gmb.routesFound', { count: hits.length })}
          </div>
          <div className="space-y-3">
            {visibleHits.map((route, idx) => (
              <GmbRouteCard key={route.routeId} route={route} lang={lang} index={idx} />
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
      )}
    </div>
  )
}
