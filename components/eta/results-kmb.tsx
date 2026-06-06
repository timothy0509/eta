'use client'

import { Clock, Info, Loader2, RefreshCw } from 'lucide-react'
import * as React from 'react'

import type { EtaGroup, PrecomputedGroups } from '@/lib/eta/kmb-eta-groups'
import { groupEtasByVariant } from '@/lib/eta/kmb-eta-groups'
import { RouteBadge } from '@/components/eta/route-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Marquee } from '@/components/ui/marquee'
import type { KmbEtaEntryWithLeg, KmbRouteInfoLite } from '@/lib/eta/client'
import { formatRelativeMinutesWithDrift, formatUiTime } from '@/lib/eta/format'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { formatRelativeAgeLabel, isStaleByAge } from '@/lib/eta/stale'
import { useTickingNow } from '@/lib/eta/use-ticking-now'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/eta/i18n'

function pickLang(fields: { en: string; tc: string; sc: string }, lang: UiLanguage) {
  if (lang === 'sc') return fields.sc
  if (lang === 'en') return fields.en
  return fields.tc
}

function formatOperatorLabel(co: string | undefined, lang: UiLanguage) {
  const key = String(co ?? 'kmb').toLowerCase()
  const map: Record<string, { en: string; tc: string; sc: string }> = {
    kmb: { en: 'KMB', tc: '九巴', sc: '九巴' },
    ctb: { en: 'CTB', tc: '城巴', sc: '城巴' },
    nwfb: { en: 'NWFB', tc: '新巴', sc: '新巴' },
    nlb: { en: 'NLB', tc: '嶼巴', sc: '屿巴' },
    gmb: { en: 'GMB', tc: '小巴', sc: '小巴' },
    lrtfeeder: { en: 'LRTF', tc: '港鐵巴士', sc: '轻铁接驳' },
    sunferry: { en: 'SF', tc: '新渡輪', sc: '新渡轮' },
    hkkf: { en: 'HKKF', tc: '港九小輪', sc: '港九小轮' },
    fortuneferry: { en: 'FF', tc: '富裕小輪', sc: '富裕小轮' },
  }
  const label = map[key] ?? { en: key.toUpperCase(), tc: key, sc: key }
  return pickLang(label, lang)
}

function formatRouteVariantLabel(
  info: KmbRouteInfoLite | undefined,
  etaFallback: KmbEtaEntryWithLeg | undefined,
  lang: UiLanguage,
  /** For circular routes, use origin instead of destination for the arriving leg */
  isArrivingLeg?: boolean,
  /** Fallback stop name to use for arriving leg when route info is not yet loaded */
  stopNameFallback?: string
) {
  if (info) {
    // For arriving leg, show origin (where the bus came from) instead of destination
    if (isArrivingLeg) {
      const origin = pickLang(info.origin, lang)
      if (origin) return origin
    }
    const destination = pickLang(info.destination, lang)
    if (destination) return destination
  }

  // Fallback when route info not yet loaded
  if (isArrivingLeg && stopNameFallback) {
    // Use stop name as fallback for origin (they should be similar)
    return stopNameFallback
  }

  if (!etaFallback) return ''

  const dest = pickLang(
    {
      en: etaFallback.dest_en ?? '',
      tc: etaFallback.dest_tc ?? '',
      sc: etaFallback.dest_sc ?? '',
    },
    lang
  )
  return dest
}

function formatArrivingText(lang: UiLanguage) {
  if (lang === 'sc') return '即将到达'
  return '即將到達'
}

function formatNoScheduledText(lang: UiLanguage) {
  if (lang === 'sc') return '暂时没有预定班次'
  return '暫時沒有預定班次'
}

function formatEtaLabel(seq: number, lang: UiLanguage) {
  if (lang === 'en') {
    if (seq === 1) return '1st'
    if (seq === 2) return '2nd'
    if (seq === 3) return '3rd'
    return `${seq}th`
  }
  return `第${seq}${lang === 'sc' ? '班' : '班'}`
}

function getGroupRemark(items: KmbEtaEntryWithLeg[], lang: UiLanguage): string | null {
  for (const entry of items) {
    const remark = pickLang(
      {
        en: entry.rmk_en ?? '',
        tc: entry.rmk_tc ?? '',
        sc: entry.rmk_sc ?? '',
      },
      lang
    )
    if (remark?.trim()) return remark.trim()
  }
  return null
}

function pickStopName(
  stop: { nameEn: string; nameTc: string; nameSc: string } | undefined,
  lang: UiLanguage
): string {
  if (!stop) return ''
  if (lang === 'sc') return stop.nameSc
  if (lang === 'en') return stop.nameEn
  return stop.nameTc
}

type StopChips = {
  stopId: string | null
  fullName: string | null
  name: string | null
  platform: string | null
  stopCode: string | null
}

function getStopChips(
  items: KmbEtaEntryWithLeg[],
  stopLookup: Map<string, StopInfo>,
  stopChipsById: Map<string, StopChips>,
  lang: UiLanguage
): StopChips {
  const stopId = items[0]?.stop ? String(items[0].stop).trim() : null

  if (stopId) {
    const cached = stopChipsById.get(stopId)
    if (cached) return cached
  }

  // Primary: lookup by ETA entry stopId
  const stopFromEta = stopId ? stopLookup.get(stopId) : undefined

  // Fallback: if stop-eta endpoint omitted stop field, use the stop ID baked into this stop's request
  const stopFromBuiltInId = !stopFromEta && stopId ? stopLookup.get(stopId) : undefined

  const stop = stopFromEta ?? stopFromBuiltInId
  const fullName = stop ? pickStopName(stop, lang) : null
  const parsed = fullName ? parseKmbStopNameCached(fullName) : null

  const result = {
    stopId,
    fullName,
    name: parsed?.name ?? fullName ?? null,
    platform: parsed?.platform ?? null,
    stopCode: parsed?.stopCode ?? null,
  }

  return result
}

type StopInfo = {
  stopId: string
  nameEn: string
  nameTc: string
  nameSc: string
}

type Props = {
  lang: UiLanguage
  title?: string
  stopCode?: string | null
  routesFilter?: string
  eta: KmbEtaEntryWithLeg[]
  routeInfos: Record<string, KmbRouteInfoLite>
  faresByVariantKey?: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
  hasQuery: boolean
  lastUpdatedAt?: number
  stale?: boolean
  staleByStopId?: Record<string, { stale: boolean; ageMs: number | null }>
  error?: string | null
  onRefresh: () => void
  loading?: boolean
  /** For showing stop codes next to routes when multiple stops are selected */
  stops?: StopInfo[]
  /** Whether multiple stops are selected (grouped stops mode) */
  multipleStops?: boolean
  /** Whether this is a keyphrase search (contains mode) - renders stop sections */
  isKeyphraseMode?: boolean
  /** ETAs grouped by stop ID for sectioned rendering */
  etaByStopId?: Record<string, KmbEtaEntryWithLeg[]>
  /** Ordered list of stop IDs that have been loaded */
  loadedStopIds?: string[]
  /** Sentinel ref for infinite scroll */
  sentinelRef?: React.RefObject<HTMLDivElement | null>
  /** Whether there are more stops to load */
  hasMoreStops?: boolean
  /** Precomputed render groups from pane (avoids recomputation during render) */
  precomputedGroups?: PrecomputedGroups
  /** Register ref for stop sections (visible tracking) */
  registerStopRef?: (stopId: string) => (el: HTMLElement | null) => void
  /** Currently visible stop IDs for virtualization */
  visibleStopIds?: Set<string>
}

/** Render a single route variant card */
const RouteVariantCard = React.memo(function RouteVariantCard({
  variantKey,
  baseKey,
  items,
  hasEta,
  hasFare,
  isArrivingLeg,
  routeInfos,
  faresByVariantKey,
  lang,
  now,
  staggerClass,
  stopChips,
}: {
  variantKey: string
  /** Base variant key without leg suffix (co|route|dir|service_type) for route info & fare lookup */
  baseKey: string
  items: KmbEtaEntryWithLeg[]
  hasEta: boolean
  /** Whether to show fare (false for arriving leg) */
  hasFare: boolean
  /** Whether this is the arriving/returning leg (leg B) */
  isArrivingLeg: boolean
  routeInfos: Record<string, KmbRouteInfoLite>
  faresByVariantKey?: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
  lang: UiLanguage
  now: number
  staggerClass?: string
  stopChips: StopChips
}) {
  const [co = 'kmb', route = ''] = variantKey.split('|')
  const first = items[0]
  // Use baseKey for route info lookup (full key may have leg suffix)
  const routeInfo = routeInfos[baseKey]
  const label = formatRouteVariantLabel(
    routeInfo,
    first,
    lang,
    isArrivingLeg,
    stopChips.name ?? undefined
  )
  // Fare is only shown if hasFare is true (suppressed for arriving leg)
  const fare = hasFare && faresByVariantKey ? faresByVariantKey[baseKey] : undefined

  const origin = routeInfo?.origin ? pickLang(routeInfo.origin, lang) : null
  const destination = routeInfo?.destination ? pickLang(routeInfo.destination, lang) : null

  const stopChipBadge = (label: string) => (
    <Badge variant="outline" className="shrink-0 rounded-lg font-mono text-xs">
      {label}
    </Badge>
  )

  const operatorBadge = (
    <Badge variant="secondary" className="shrink-0 rounded-lg text-xs">
      {formatOperatorLabel(first?.co ?? co, lang)}
    </Badge>
  )

  const { t } = useTranslations(lang)

  const InfoButton = (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'ui-lift bg-background/30 text-muted-foreground inline-flex h-8 w-8 items-center justify-center rounded-lg border',
            'hover:bg-background/40 hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
          )}
          aria-label={t('common.routeDetails')}
        >
          <Info className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {route} {destination ? `→ ${destination}` : label ? `→ ${label}` : ''}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('common.routeAndStopDetails')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">{t('common.stop')}</div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 truncate text-sm font-medium">
                {stopChips.name ?? t('common.unknown')}
              </div>
              {stopChips.platform ? (
                <Badge variant="secondary" className="shrink-0 rounded-lg font-mono text-xs">
                  {stopChips.platform}
                </Badge>
              ) : null}
              {stopChips.stopCode ? (
                <Badge variant="secondary" className="shrink-0 rounded-lg font-mono text-xs">
                  {stopChips.stopCode}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">{t('common.operator')}</div>
            <div className="text-sm">{formatOperatorLabel(first?.co ?? co, lang)}</div>
          </div>

          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">{t('common.route')}</div>
            <div className="text-sm">
              {origin && destination
                ? `${origin} → ${destination}`
                : label || destination || t('common.unknown')}
            </div>
          </div>

          {fare ? (
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">{t('common.fare')}</div>
              <div className="text-sm font-medium">HK$ {fare.hkd.toFixed(1)}</div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )

  // Routes without valid ETAs get a simplified display
  if (!hasEta) {
    const remark = getGroupRemark(items, lang)
    return (
      <div
        className={cn(
          'ui-animate-in ui-lift bg-background/40 rounded-2xl border p-4 opacity-70',
          staggerClass
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <RouteBadge route={route} company={co} size="lg" />
            {operatorBadge}
            <span className="shrink-0 text-sm font-medium">→ </span>
            <Marquee className="min-w-0 flex-1 text-sm font-medium">{label || 'Route'}</Marquee>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              {stopChips.platform ? stopChipBadge(stopChips.platform) : null}
              {fare ? (
                <Badge variant="secondary" className="shrink-0 rounded-lg font-mono text-xs">
                  HK$ {fare.hkd.toFixed(1)}
                </Badge>
              ) : null}
              {stopChips.stopCode ? stopChipBadge(stopChips.stopCode) : null}
            </div>
            {InfoButton}
          </div>
        </div>
        <div className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
          <Info className="h-4 w-4 shrink-0" />
          {remark || formatNoScheduledText(lang)}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('ui-animate-in ui-lift bg-background/40 rounded-2xl border p-4', staggerClass)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <RouteBadge route={route} company={co} size="lg" />
          {operatorBadge}
          <span className="shrink-0 text-sm font-medium">→ </span>
          <Marquee className="min-w-0 flex-1 text-sm font-medium">{label || 'Route'}</Marquee>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            {stopChips.platform ? stopChipBadge(stopChips.platform) : null}
            {fare ? (
              <Badge variant="secondary" className="shrink-0 rounded-lg font-mono text-xs">
                HK$ {fare.hkd.toFixed(1)}
              </Badge>
            ) : null}
            {stopChips.stopCode ? stopChipBadge(stopChips.stopCode) : null}
          </div>
          {InfoButton}
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
        {items.slice(0, 3).map((entry, entryIdx) => {
          const minutes = entry.eta
            ? formatRelativeMinutesWithDrift(entry.eta, entry.data_timestamp, now)
            : null
          const remark = pickLang(
            {
              en: entry.rmk_en ?? '',
              tc: entry.rmk_tc ?? '',
              sc: entry.rmk_sc ?? '',
            },
            lang
          )
          return (
            <div
              key={`${variantKey}:${entry.eta_seq}:${entry.eta ?? ''}:${entry.data_timestamp ?? ''}:${entryIdx}`}
              className={cn(
                'ui-lift bg-card/40 min-w-[150px] shrink-0 rounded-2xl border p-3 sm:min-w-0',
                entry.eta_seq === 1 && 'bg-card/60'
              )}
            >
              <div className="text-muted-foreground text-xs">
                {formatEtaLabel(entry.eta_seq, lang)}
              </div>
              <div className="font-tabular mt-1 text-2xl font-semibold tracking-tight">
                {minutes === null || Number.isNaN(minutes)
                  ? '—'
                  : minutes <= 0
                    ? formatArrivingText(lang)
                    : lang === 'en'
                      ? `${minutes} min`
                      : `${minutes} 分`}
              </div>

              {remark ? (
                <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">{remark}</div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
})

/** Render a stop section with its routes */
const StopSection = React.memo(function StopSection({
  stopId,
  stopInfo,
  groups,
  routeInfos,
  faresByVariantKey,
  lang,
  now,
  isFirst,
  stopLookup,
  registerStopRef,
  stopChipsById,
}: {
  stopId: string
  stopInfo?: StopInfo
  groups: EtaGroup[]
  routeInfos: Record<string, KmbRouteInfoLite>
  faresByVariantKey?: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
  lang: UiLanguage
  now: number
  isFirst?: boolean
  stopLookup: Map<string, StopInfo>
  registerStopRef?: (stopId: string) => (el: HTMLElement | null) => void
  stopChipsById: Map<string, StopChips>
}) {
  const stopName = stopInfo ? pickStopName(stopInfo, lang) : `Stop ${stopId}`
  const parsed = parseKmbStopNameCached(stopName)
  const stopCodeBadge = parsed.platform ?? parsed.stopCode ?? null
  const stopRef = registerStopRef ? registerStopRef(stopId) : undefined

  return (
    <div ref={stopRef} className={cn('space-y-3', !isFirst && 'mt-6 border-t pt-6')}>
      {/* Stop header (sticky within results card) */}
      <div
        className={cn(
          'bg-card/70 supports-[backdrop-filter]:bg-card/50 sticky top-0 z-10 -mx-6 -mt-5 border-b px-6 py-2.5 backdrop-blur',
          !isFirst && 'pt-4'
        )}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-foreground min-w-0 truncate text-sm font-semibold">{parsed.name}</h3>
          {stopCodeBadge ? (
            <Badge variant="secondary" className="shrink-0 rounded-lg font-mono text-xs">
              {stopCodeBadge}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Route cards for this stop */}
      {groups.length === 0 ? (
        <div className="bg-background/40 text-muted-foreground flex items-center gap-2 rounded-2xl border p-4 text-sm">
          <Info className="h-4 w-4" />
          {formatNoScheduledText(lang)}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g, idx) => (
            <RouteVariantCard
              key={g.key}
              variantKey={g.key}
              baseKey={g.baseKey}
              items={g.items}
              hasEta={g.hasEta}
              hasFare={g.hasFare}
              isArrivingLeg={g.isArrivingLeg}
              routeInfos={routeInfos}
              faresByVariantKey={faresByVariantKey}
              lang={lang}
              now={now}
              stopChips={
                stopChipsById.get(stopId) ?? getStopChips(g.items, stopLookup, stopChipsById, lang)
              }
              staggerClass={
                isFirst
                  ? idx === 0
                    ? 'ui-stagger-1'
                    : idx === 1
                      ? 'ui-stagger-2'
                      : idx === 2
                        ? 'ui-stagger-3'
                        : ''
                  : ''
              }
            />
          ))}
        </div>
      )}
    </div>
  )
})

export const KmbResults = React.memo(function KmbResults({
  lang,
  title,
  stopCode,
  routesFilter,
  eta,
  routeInfos,
  faresByVariantKey,
  hasQuery,
  lastUpdatedAt,
  stale,
  staleByStopId,
  error,
  onRefresh,
  loading,
  stops,
  multipleStops,
  isKeyphraseMode,
  etaByStopId,
  loadedStopIds,
  sentinelRef,
  hasMoreStops,
  precomputedGroups,
  registerStopRef,
  visibleStopIds,
}: Props) {
  const { t, tWithParams } = useTranslations(lang)
  const now = useTickingNow(15_000)
  const updatedAt = lastUpdatedAt ? new Date(lastUpdatedAt) : null
  const relativeAgeLabel = formatRelativeAgeLabel({ lastUpdatedAt, lang, now })
  const isAgeStale = isStaleByAge({ lastUpdatedAt, mode: 'kmb', now })
  const hasStaleStops = Boolean(
    staleByStopId && Object.values(staleByStopId).some((entry) => entry.stale)
  )
  const showStale = Boolean(stale || isAgeStale || hasStaleStops)

  // Create a lookup map for stops by ID
  const stopLookup = React.useMemo(() => {
    if (!stops) return new Map<string, StopInfo>()
    return new Map(stops.map((s) => [s.stopId, s]))
  }, [stops])

  const stopChipsById = React.useMemo(() => {
    if (!stops) return new Map<string, StopChips>()
    const next = new Map<string, StopChips>()
    for (const stop of stops) {
      const fullName = pickStopName(stop, lang)
      const parsed = parseKmbStopNameCached(fullName)
      next.set(stop.stopId, {
        stopId: stop.stopId,
        fullName,
        name: parsed.name ?? fullName,
        platform: parsed.platform ?? null,
        stopCode: parsed.stopCode ?? null,
      })
    }
    return next
  }, [stops, lang])

  // For keyphrase mode, use sectioned rendering
  const useStopSections =
    isKeyphraseMode && etaByStopId && loadedStopIds && loadedStopIds.length > 0

  // For flat mode, use precomputed groups directly (computed once in pane)
  const precomputedFlat = precomputedGroups?.flat

  const visibleSortedStopIds = React.useMemo(() => {
    if (!loadedStopIds) return []
    const allIds = loadedStopIds
    const visibleIndices = new Set<number>()

    if (visibleStopIds && visibleStopIds.size > 0) {
      for (let i = 0; i < allIds.length; i++) {
        if (visibleStopIds.has(allIds[i]!)) {
          for (let j = Math.max(0, i - 3); j <= Math.min(allIds.length - 1, i + 3); j++) {
            visibleIndices.add(j)
          }
        }
      }
    }

    if (visibleIndices.size === 0) {
      for (let i = 0; i < Math.min(allIds.length, 10); i++) {
        visibleIndices.add(i)
      }
    }

    return Array.from(visibleIndices)
      .sort((a, b) => a - b)
      .map((idx) => allIds[idx]!)
  }, [loadedStopIds, visibleStopIds])

  // Fallback grouped computation for multipleStops mode only
  const grouped = React.useMemo(() => {
    if (useStopSections) return []
    if (precomputedFlat && !multipleStops) return []

    const buildKeyWithStop = (entry: KmbEtaEntryWithLeg) => {
      const co = String(entry.co ?? 'kmb')
      const route = (entry.route ?? '').toUpperCase()
      const dir = String(entry.dir ?? '')
      const serviceType = String(entry.service_type ?? '')
      const legSuffix = entry.leg ?? '_'
      const stop = entry.stop ?? ''
      return `${co}|${route}|${dir}|${serviceType}|${legSuffix}|${stop}`
    }

    return groupEtasByVariant(eta, faresByVariantKey ?? {}, buildKeyWithStop)
  }, [eta, multipleStops, useStopSections, precomputedFlat, faresByVariantKey])

  return (
    <Card className="bg-card/60 rounded-3xl border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="truncate text-base">{title || t('kmb.title')}</CardTitle>
            {stopCode ? (
              <Badge variant="outline" className="shrink-0 rounded-lg font-mono text-xs">
                {stopCode}
              </Badge>
            ) : null}
          </div>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
            <Clock className="h-3.5 w-3.5" />
            {routesFilter?.trim()
              ? `${t('kmb.filtered')} ${routesFilter}`
              : isKeyphraseMode
                ? `${loadedStopIds?.length ?? 0} ${t('kmb.stopsLoaded')}`
                : t('kmb.allRoutesAtStop')}

            {updatedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>{tWithParams('kmb.updated', { time: formatUiTime(updatedAt, lang) })}</span>
                {relativeAgeLabel ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{relativeAgeLabel}</span>
                  </>
                ) : null}
              </>
            ) : null}

            {showStale ? (
              <Badge variant="destructive" className="rounded-lg">
                {t('common.stale')}
              </Badge>
            ) : null}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 rounded-xl"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'ui-spin')} />
          {t('common.refresh')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <div className="ui-animate-fade bg-destructive/10 text-destructive rounded-2xl border p-4 text-sm">
            {tWithParams('kmb.updateFailed', { error })}
          </div>
        ) : null}
        {!hasQuery ? (
          <div className="ui-animate-fade bg-background/40 text-muted-foreground flex items-center gap-2 rounded-2xl border p-4 text-sm">
            <Info className="h-4 w-4" />
            {t('common.selectStop')}
          </div>
        ) : useStopSections ? (
          // Keyphrase mode: sectioned by stop with virtualization
          <>
            {visibleSortedStopIds.map((stopId, idx) => (
              <StopSection
                key={stopId}
                stopId={stopId}
                stopInfo={stopLookup.get(stopId)}
                groups={precomputedGroups?.byStopId[stopId] ?? []}
                routeInfos={routeInfos}
                faresByVariantKey={faresByVariantKey}
                lang={lang}
                now={now}
                isFirst={idx === 0}
                stopLookup={stopLookup}
                registerStopRef={registerStopRef}
                stopChipsById={stopChipsById}
              />
            ))}

            {/* Infinite scroll sentinel */}
            {hasMoreStops ? (
              <div ref={sentinelRef} className="flex items-center justify-center py-4">
                {loading ? (
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {lang === 'en'
                      ? 'Loading more stops...'
                      : lang === 'sc'
                        ? '正在载入更多车站...'
                        : '正在载入更多车站...'}
                  </div>
                ) : (
                  <div className="h-1" /> // Invisible sentinel
                )}
              </div>
            ) : loadedStopIds!.length > 0 ? (
              <div className="text-muted-foreground py-2 text-center text-xs">
                {lang === 'en'
                  ? `All ${loadedStopIds!.length} stops loaded`
                  : lang === 'sc'
                    ? `已载入全部 ${loadedStopIds!.length} 个车站`
                    : `已载入全部 ${loadedStopIds!.length} 個车站`}
              </div>
            ) : null}
          </>
        ) : precomputedFlat && !multipleStops ? (
          // Flat mode: use precomputed groups directly (no recomputation)
          precomputedFlat.map((g, idx) => {
            const staggerClass =
              idx === 0
                ? 'ui-stagger-1'
                : idx === 1
                  ? 'ui-stagger-2'
                  : idx === 2
                    ? 'ui-stagger-3'
                    : ''

            const stopId = g.items[0]?.stop ? String(g.items[0].stop).trim() : null
            const stopChips = stopId
              ? (stopChipsById.get(stopId) ??
                getStopChips(g.items, stopLookup, stopChipsById, lang))
              : getStopChips(g.items, stopLookup, stopChipsById, lang)

            return (
              <RouteVariantCard
                key={g.key}
                variantKey={g.key}
                baseKey={g.baseKey}
                items={g.items}
                hasEta={g.hasEta}
                hasFare={g.hasFare}
                isArrivingLeg={g.isArrivingLeg}
                routeInfos={routeInfos}
                faresByVariantKey={faresByVariantKey}
                lang={lang}
                now={now}
                staggerClass={staggerClass}
                stopChips={stopChips}
              />
            )
          })
        ) : grouped.length === 0 ? (
          <div className="ui-animate-fade bg-background/40 text-muted-foreground flex items-center gap-2 rounded-2xl border p-4 text-sm">
            <Info className="h-4 w-4" />
            {formatNoScheduledText(lang)}
          </div>
        ) : (
          // Fallback flat list mode (multipleStops)
          grouped.map((g, idx) => {
            const staggerClass =
              idx === 0
                ? 'ui-stagger-1'
                : idx === 1
                  ? 'ui-stagger-2'
                  : idx === 2
                    ? 'ui-stagger-3'
                    : ''

            const stopId = g.items[0]?.stop ? String(g.items[0].stop).trim() : null
            const stopChips = stopId
              ? (stopChipsById.get(stopId) ??
                getStopChips(g.items, stopLookup, stopChipsById, lang))
              : getStopChips(g.items, stopLookup, stopChipsById, lang)

            return (
              <RouteVariantCard
                key={g.key}
                variantKey={g.key}
                baseKey={g.baseKey}
                items={g.items}
                hasEta={g.hasEta}
                hasFare={g.hasFare}
                isArrivingLeg={g.isArrivingLeg}
                routeInfos={routeInfos}
                faresByVariantKey={faresByVariantKey}
                lang={lang}
                now={now}
                staggerClass={staggerClass}
                stopChips={stopChips}
              />
            )
          })
        )}
      </CardContent>
    </Card>
  )
})
