'use client'

import { ChevronLeft, CircleAlert, Clock } from 'lucide-react'
import dynamic from 'next/dynamic'
import * as React from 'react'

import { EmptyState } from '@/components/eta/empty-state'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { RouteBadge } from '@/components/eta/route-badge'
import { RouteStopCard, RouteStopTimeline } from '@/components/eta/route-stop-timeline'
import { TickingKmbMinutes, TickingSoonestPill } from '@/components/eta/ticking-eta'
import {
  getGmbTdRouteGroup,
  gmbPickDropKey,
  type GmbTdRouteGroup,
  type GmbTdRouteSeq,
  type GmbTdRouteVariant,
} from '@/lib/eta/direct/gmb-td'
import { getEtaDbIndexes } from '@/lib/eta/direct/eta-db'
import { fetchKmbStopEtas, type KmbEtaEntryWithLeg } from '@/lib/eta/client'
import { formatFareHkd, getUiLocale } from '@/lib/eta/format'
import {
  gmbVariantBaseKey,
  resolveGmbEtaVariant,
  resolveGmbStopQueries,
  type GmbEtaResolution,
  type GmbStopQuery,
} from '@/lib/eta/gmb-resolve'
import { useTranslations } from '@/lib/eta/i18n'
import { getOperatorColor, normalizeOperator } from '@/lib/eta/operator-colors'
import { pickLang } from '@/lib/eta/pick-lang'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

const TransitMap = dynamic(
  () => import('@/components/eta/transit-map').then((mod) => mod.TransitMap),
  {
    ssr: false,
    loading: () => <div className="bg-surface-container ui-shimmer h-56 rounded-2xl" />,
  }
)

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

function GmbStopCard({
  query,
  stopEtas,
  lang,
  expanded,
  onToggle,
}: {
  query: GmbStopQuery
  stopEtas: KmbEtaEntryWithLeg[]
  lang: UiLanguage
  expanded: boolean
  onToggle: () => void
}) {
  const { t } = useTranslations(lang)
  const name = pickLang(query.tdStop.stopName, lang) || pickLang(query.tdStop.stopName, 'tc')
  const roleLabel = t(gmbPickDropKey(query.tdStop.stopPickDrop))
  const sorted = React.useMemo(
    () =>
      [...stopEtas]
        .filter((entry) => Boolean(entry.eta))
        .sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime()),
    [stopEtas]
  )
  const visible = sorted.slice(0, 3)

  const panel =
    visible.length === 0 ? (
      <div className="text-on-surface-variant m3-body-md flex items-center gap-2">
        {query.unresolved ? t('gmb.unresolvedStop') : t('common.noScheduledBuses')}
      </div>
    ) : (
      <div className="space-y-2">
        <div className="flex justify-center gap-1.5 pb-0.5 sm:gap-2">
          {visible.map((entry, entryIdx) => {
            const remark =
              pickLang(
                { en: entry.rmk_en ?? '', tc: entry.rmk_tc ?? '', sc: entry.rmk_sc ?? '' },
                lang
              ).trim() || null
            const isFirst = entryIdx === 0
            if (isFirst) {
              return (
                <div
                  key={`${entry.eta_seq}:${entryIdx}`}
                  className="bg-primary-container text-on-primary-container w-1/3 min-w-0 rounded-xl px-2 py-1.5 text-center sm:px-3 sm:py-2"
                >
                  <div className="mt-0.5">
                    <TickingKmbMinutes
                      eta={entry.eta}
                      dataTimestamp={entry.data_timestamp}
                      lang={lang}
                      variant="panel"
                    />
                  </div>
                  {remark ? (
                    <div className="m3-label-md mt-1 truncate opacity-80" title={remark}>
                      {remark}
                    </div>
                  ) : null}
                </div>
              )
            }
            return (
              <div
                key={`${entry.eta_seq}:${entryIdx}`}
                className="bg-surface-container-high w-1/3 min-w-0 rounded-lg px-2 py-1.5 text-center sm:px-2.5"
              >
                <div className="mt-0.5">
                  <TickingKmbMinutes
                    eta={entry.eta}
                    dataTimestamp={entry.data_timestamp}
                    lang={lang}
                    variant="plain"
                    className="text-on-surface font-tabular text-base font-semibold tracking-tight sm:text-lg"
                  />
                </div>
                {remark ? (
                  <div
                    className="text-on-surface-variant m3-label-md mt-0.5 truncate"
                    title={remark}
                  >
                    {remark}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="text-on-surface-variant m3-label-sm flex min-w-0 items-center gap-1.5 overflow-hidden">
          <span className="min-w-0 flex-1 truncate font-mono">TD {query.tdStop.stopId}</span>
        </div>
      </div>
    )

  return (
    <RouteStopCard
      expanded={expanded}
      onToggle={onToggle}
      color={getOperatorColor('gmb')}
      seq={query.tdStop.stopSeq}
      name={name}
      subtitle={`${roleLabel} · TD ${query.tdStop.stopId}`}
      eta={
        query.unresolved ? (
          <span className="text-on-surface-variant m3-label-md inline-flex items-center gap-1">
            <CircleAlert className="h-4 w-4" aria-hidden />
          </span>
        ) : (
          <TickingSoonestPill etas={stopEtas} lang={lang} />
        )
      }
      panel={panel}
      toggleLabel={name}
    />
  )
}

function formatUpdateDate(iso: string | null, lang: UiLanguage): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  try {
    return new Intl.DateTimeFormat(getUiLocale(lang), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)
  } catch {
    return iso.slice(0, 10)
  }
}

type GroupLoad =
  | { status: 'loading' }
  | { status: 'ready'; group: GmbTdRouteGroup | null }
  | { status: 'error'; message: string }

function useGmbTdGroup(routeId: number) {
  const [load, setLoad] = React.useState<GroupLoad>({ status: 'loading' })
  const [retryKey, setRetryKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    getGmbTdRouteGroup(routeId)
      .then((group) => {
        if (!cancelled) setLoad({ status: 'ready', group })
      })
      .catch((err) => {
        if (!cancelled) {
          setLoad({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load GMB dataset',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [routeId, retryKey])

  const retry = React.useCallback(() => {
    setLoad({ status: 'loading' })
    setRetryKey((k) => k + 1)
  }, [])

  return { load, retry }
}

export function GmbRouteDetail({
  routeId,
  initialRouteSeq = 1,
  lang,
  onBack,
}: {
  routeId: number
  initialRouteSeq?: GmbTdRouteSeq
  lang: UiLanguage
  onBack?: () => void
}) {
  const { t, tWithParams } = useTranslations(lang)
  const { load, retry } = useGmbTdGroup(routeId)
  const [activeSeq, setActiveSeq] = React.useState<GmbTdRouteSeq>(initialRouteSeq)
  const [resolutionState, setResolutionState] = React.useState<{
    key: string
    resolution: GmbEtaResolution | null
  } | null>(null)
  const [etasState, setEtasState] = React.useState<{
    key: string
    bySeq: Record<number, KmbEtaEntryWithLeg[]>
  } | null>(null)
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null)

  const group = load.status === 'ready' ? load.group : null
  const variants = group?.variants ?? []
  // The requested leg may not exist on this route (e.g. circular routes only
  // have routeSeq 1), so fall back to the first available leg by derivation
  // instead of syncing state inside an effect.
  const effectiveSeq: GmbTdRouteSeq = variants.some((v) => v.routeSeq === activeSeq)
    ? activeSeq
    : (variants[0]?.routeSeq ?? activeSeq)
  const activeVariant: GmbTdRouteVariant | null =
    variants.find((v) => v.routeSeq === effectiveSeq) ?? null
  const routeName =
    group !== null
      ? pickLang(group.routeName, lang) || group.routeName.en || group.routeName.tc
      : null

  const resolutionKey =
    activeVariant && routeName
      ? `${routeId}|${routeName}|${activeVariant.routeSeq}|${activeVariant.stops.length}`
      : null
  const resolution = resolutionState?.key === resolutionKey ? resolutionState.resolution : null
  const resolutionAttempted = resolutionState?.key === resolutionKey

  const queries = React.useMemo<GmbStopQuery[]>(() => {
    if (!activeVariant) return []
    return resolveGmbStopQueries(activeVariant.stops, resolution)
  }, [activeVariant, resolution])

  // Resolve the TD variant to a hk-bus-eta realtime variant by route variant
  // (co, route, bound, serviceType, seq). TD stopIds are never used here.
  React.useEffect(() => {
    if (!activeVariant || !routeName || !resolutionKey) return
    if (resolutionState?.key === resolutionKey) return
    let cancelled = false
    getEtaDbIndexes()
      .then((indexes) => {
        if (cancelled) return
        setResolutionState({
          key: resolutionKey,
          resolution: resolveGmbEtaVariant({
            routeName,
            routeSeq: activeVariant.routeSeq,
            tdStopCount: activeVariant.stops.length,
            indexes,
          }),
        })
      })
      .catch(() => {
        if (!cancelled) setResolutionState({ key: resolutionKey, resolution: null })
      })
    return () => {
      cancelled = true
    }
  }, [activeVariant, routeName, resolutionKey, resolutionState])

  // One cached batch for the resolved realtime stop ids, then keep only rows
  // for this variant. Unresolved stops stay out of the request and render
  // flagged in the timeline.
  const etaRequest = React.useMemo(() => {
    if (!activeVariant || !routeName || !resolution || !resolutionKey) return null
    const resolvable = queries.filter((q) => !q.unresolved && q.etaStopId !== null)
    if (resolvable.length === 0) return null
    const wantedKey = gmbVariantBaseKey(resolution, routeName)
    const stopIds = resolvable.map((q) => q.etaStopId as string)
    return {
      key: `${resolutionKey}|${wantedKey}|${stopIds.length}`,
      routeName,
      wantedKey,
      stopIds,
      seqs: resolvable.map((q) => q.seq),
    }
  }, [activeVariant, routeName, resolution, resolutionKey, queries])

  React.useEffect(() => {
    if (!etaRequest) return
    if (etasState?.key === etaRequest.key) return
    const key = etaRequest.key
    let cancelled = false
    fetchKmbStopEtas(etaRequest.stopIds, { routeFilter: etaRequest.routeName, includeFares: false })
      .then((res) => {
        if (cancelled) return
        const next: Record<number, KmbEtaEntryWithLeg[]> = {}
        for (let i = 0; i < etaRequest.stopIds.length; i += 1) {
          const stopId = etaRequest.stopIds[i]
          const seq = etaRequest.seqs[i]
          if (stopId === undefined || seq === undefined) continue
          next[seq] = (res.byStopId[stopId] ?? []).filter(
            (eta) => variantBaseKey(eta) === etaRequest.wantedKey
          )
        }
        setEtasState({ key, bySeq: next })
      })
      .catch(() => {
        if (!cancelled) setEtasState({ key, bySeq: {} })
      })
    return () => {
      cancelled = true
    }
  }, [etaRequest, etasState])

  const etasBySeq =
    etasState !== null && etaRequest !== null && etasState.key === etaRequest.key
      ? etasState.bySeq
      : {}

  const mapCenter = React.useMemo(() => {
    const stops = activeVariant?.stops ?? []
    if (stops.length === 0) return { lat: 22.3193, lng: 114.1694 }
    const middle = stops[Math.floor(stops.length / 2)]
    return middle ? { lat: middle.lat, lng: middle.lng } : { lat: 22.3193, lng: 114.1694 }
  }, [activeVariant])

  const mapMarkers = React.useMemo(() => {
    return (activeVariant?.stops ?? []).map((stop) => ({
      id: `${stop.routeSeq}:${stop.stopSeq}`,
      lat: stop.lat,
      lng: stop.lng,
      title: pickLang(stop.stopName, lang) || stop.stopName.tc,
    }))
  }, [activeVariant, lang])

  const mapPolylines = React.useMemo(() => {
    if (!activeVariant) return []
    return [
      {
        id: `${routeId}:${activeVariant.routeSeq}`,
        path: activeVariant.stops.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
        color: '#00478d',
      },
    ]
  }, [activeVariant, routeId])

  if (load.status === 'loading') {
    return (
      <div className="space-y-4">
        <ResultsSkeleton />
      </div>
    )
  }

  if (load.status === 'error' || !activeVariant || !routeName) {
    return (
      <EmptyState
        title={t('common.wentWrong')}
        hint={load.status === 'error' ? load.message : t('gmb.loadFailed')}
        action={
          <button
            type="button"
            onClick={retry}
            className="bg-primary text-on-primary m3-label-lg ui-press mt-2 inline-flex min-h-[44px] items-center rounded-full px-5 py-2 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
          >
            {t('common.tryAgain')}
          </button>
        }
      />
    )
  }

  // A lone routeSeq 1 leg is a circular route; with both legs present the
  // legs read as outbound plus inbound.
  const soloCircular = variants.length === 1 && activeVariant.routeSeq === 1
  const legLabel = soloCircular
    ? t('gmb.circular')
    : activeVariant.routeSeq === 2
      ? t('gmb.inbound')
      : t('gmb.outbound')
  const fareLabel = formatFareHkd(activeVariant.fullFare)
  const updatedLabel = formatUpdateDate(activeVariant.lastUpdateDate, lang)

  return (
    <div className="space-y-4">
      <div className="card-m3 p-4">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="bg-secondary-container text-on-secondary-container m3-label-lg ui-press inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-full px-4 py-2 transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              {t('common.back')}
            </button>
          ) : null}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <RouteBadge route={routeName} company="gmb" size="lg" />
              <span className="text-on-surface-variant m3-label-md uppercase">GMB</span>
              <span className="text-on-surface-variant m3-label-md">{legLabel}</span>
            </span>
            <span className="text-on-surface m3-title-md truncate">
              {pickLang(activeVariant.origin, lang)} → {pickLang(activeVariant.destination, lang)}
            </span>
          </span>
        </div>

        {variants.length > 1 ? (
          <div
            className="mt-3 flex gap-2 overflow-x-auto pb-1"
            role="group"
            aria-label={t('common.route')}
          >
            {variants.map((v) => (
              <button
                key={v.routeSeq}
                type="button"
                aria-pressed={effectiveSeq === v.routeSeq}
                onClick={() => {
                  setActiveSeq(v.routeSeq)
                  setExpandedKey(null)
                }}
                className={cn(
                  'ui-press inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  effectiveSeq === v.routeSeq
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                )}
              >
                <span>{v.routeSeq === 2 ? t('gmb.inbound') : t('gmb.outbound')}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="text-on-surface-variant m3-body-md mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" aria-hidden />
            {activeVariant.journeyTime !== null
              ? tWithParams('gmb.journeyTime', { count: activeVariant.journeyTime })
              : t('common.unknown')}
          </span>
          <span>
            {t('gmb.fullFare')}: {fareLabel ?? t('common.unknown')}
          </span>
          <span>{tWithParams('gmb.stopsCount', { count: activeVariant.stops.length })}</span>
          {updatedLabel ? <span>{updatedLabel}</span> : null}
        </div>
        <div className="text-on-surface-variant m3-label-md mt-1">{t('gmb.sourceNote')}</div>

        {resolutionAttempted && !resolution ? (
          <div className="text-on-surface-variant m3-body-md bg-surface-container-high mt-3 flex items-start gap-2 rounded-xl px-3 py-2">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{t('gmb.noRealtimeVariant')}</span>
          </div>
        ) : null}
        {resolution?.ambiguous ? (
          <div className="text-on-surface-variant m3-body-md bg-surface-container-high mt-3 flex items-start gap-2 rounded-xl px-3 py-2">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{t('gmb.ambiguousMatch')}</span>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-m3 p-4">
          <div className="m3-title-md mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('common.routeDetails')}
          </div>
          <RouteStopTimeline key={`${routeId}:${activeVariant.routeSeq}`}>
            {queries.map((query) => {
              const cardKey = `${query.tdStop.routeSeq}:${query.tdStop.stopSeq}`
              return (
                <GmbStopCard
                  key={cardKey}
                  query={query}
                  stopEtas={etasBySeq[query.seq] ?? []}
                  lang={lang}
                  expanded={expandedKey === cardKey}
                  onToggle={() => setExpandedKey((prev) => (prev === cardKey ? null : cardKey))}
                />
              )
            })}
          </RouteStopTimeline>
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
    </div>
  )
}
