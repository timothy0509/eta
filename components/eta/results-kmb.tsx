'use client'

import { ChevronDown, Clock, Info, Loader2 } from 'lucide-react'
import * as React from 'react'

import type { EtaGroup, PrecomputedGroups } from '@/lib/eta/kmb-eta-groups'
import { groupEtasByVariant } from '@/lib/eta/kmb-eta-groups'
import { RouteBadge } from '@/components/eta/route-badge'
import { EmptyState } from '@/components/eta/empty-state'
import { StaggerList, staggerClassForIndex } from '@/components/eta/stagger-list'
import { TickingKmbMinutes } from '@/components/eta/ticking-eta'
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
import { formatFareHkd } from '@/lib/eta/format'
import { formatKmbRouteEndpointName, parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { pickLang } from '@/lib/eta/pick-lang'
import { getOperatorColor, normalizeOperator } from '@/lib/eta/operator-colors'
import { ResultsHeader } from '@/components/eta/results-header'
import { isKmbStop } from '@/lib/eta/types'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/eta/i18n'
import { ExpandableEtaRow } from '@/components/eta/expandable-eta-row'
import { useVisibleItems } from '@/lib/eta/use-infinite-scroll'

function formatOperatorLabel(co: string | undefined, lang: UiLanguage) {
  const key = normalizeOperator(co)
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
      if (origin) return formatKmbRouteEndpointName(origin, { co: info.co, lang })
    }
    const destination = pickLang(info.destination, lang)
    if (destination) return formatKmbRouteEndpointName(destination, { co: info.co, lang })
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
  return formatKmbRouteEndpointName(dest, { co: etaFallback.co, lang })
}

function formatNoScheduledText(t: (key: string) => string) {
  return t('common.noScheduledBuses')
}

function formatEtaLabel(seq: number, lang: UiLanguage) {
  if (lang === 'en') {
    if (seq === 1) return '1st'
    if (seq === 2) return '2nd'
    if (seq === 3) return '3rd'
    return `${seq}th`
  }
  return `第${seq}班`
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
  return pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
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
  const parsed = fullName
    ? parseKmbStopNameCached(fullName, { isKmb: isKmbStop(stop), lang })
    : null

  const result = {
    stopId,
    fullName,
    name: parsed?.name ?? fullName ?? null,
    platform: parsed?.platform ?? null,
    stopCode: parsed?.stopCode ?? null,
  }

  return result
}

type StopInfo = KmbStopSearchItem

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
  /** Whether there are more stops to load */
  hasMoreStops?: boolean
  /** Stable callback to load the next page of stops */
  onLoadMore?: () => void
  /** Precomputed render groups from pane (avoids recomputation during render) */
  precomputedGroups?: PrecomputedGroups
}

/** Shared details dialog shell: each call site passes its own trigger, content stays identical */
function RouteDetailsDialog({
  trigger,
  children,
}: {
  trigger: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-surface-container-low rounded-3xl border-0">
        {children}
      </DialogContent>
    </Dialog>
  )
}

/** Render a single route departure row */
const RouteDepartureRow = React.memo(function RouteDepartureRow({
  variantKey,
  baseKey,
  items,
  hasEta,
  hasFare,
  isArrivingLeg,
  routeInfos,
  faresByVariantKey,
  lang,
  staggerClass,
  stopChips,
  expanded,
  onToggleExpand,
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
  staggerClass?: string
  stopChips: StopChips
  expanded?: boolean
  onToggleExpand?: () => void
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

  const origin = routeInfo?.origin
    ? formatKmbRouteEndpointName(pickLang(routeInfo.origin, lang), {
        co: routeInfo.co,
        lang,
      })
    : null
  const destination = routeInfo?.destination
    ? formatKmbRouteEndpointName(pickLang(routeInfo.destination, lang), {
        co: routeInfo.co,
        lang,
      })
    : null
  const operatorColor = getOperatorColor(first?.co ?? co)
  const operatorName = formatOperatorLabel(first?.co ?? co, lang)

  const { t } = useTranslations(lang)

  const expandable = Boolean(onToggleExpand) && hasEta && items.length >= 1
  const isExpanded = expandable && Boolean(expanded)

  const fareLabel = fare ? formatFareHkd(fare.hkd) : null
  const codeLabel = [stopChips.platform, stopChips.stopCode].filter(Boolean).join(' · ') || null

  const detailsContent = (
    <>
      <DialogHeader>
        <DialogTitle className="m3-title-md text-on-surface">
          {route} {destination ? `→ ${destination}` : label ? `→ ${label}` : ''}
        </DialogTitle>
        <DialogDescription className="sr-only">{t('common.routeAndStopDetails')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1">
          <div className="text-on-surface-variant m3-label-md">{t('common.stop')}</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-on-surface m3-body-md min-w-0 flex-1 truncate font-medium">
              {stopChips.name ?? t('common.unknown')}
            </div>
            {stopChips.platform ? (
              <span className="text-on-surface-variant m3-label-md font-mono">
                {stopChips.platform}
              </span>
            ) : null}
            {stopChips.stopCode ? (
              <span className="text-on-surface-variant m3-label-md font-mono">
                {stopChips.stopCode}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-on-surface-variant m3-label-md">{t('common.operator')}</div>
          <div className="text-on-surface m3-body-md">
            {formatOperatorLabel(first?.co ?? co, lang)}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-on-surface-variant m3-label-md">{t('common.route')}</div>
          <div className="text-on-surface m3-body-md">
            {origin && destination
              ? `${origin} → ${destination}`
              : label || destination || t('common.unknown')}
          </div>
        </div>

        {fareLabel ? (
          <div className="space-y-1">
            <div className="text-on-surface-variant m3-label-md">{t('common.fare')}</div>
            <div className="text-on-surface m3-body-md font-medium">{fareLabel}</div>
          </div>
        ) : null}
      </div>
    </>
  )

  const DetailsTextButton = (
    <RouteDetailsDialog
      trigger={
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-primary/30 pointer-events-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Info className="h-3.5 w-3.5" />
          <span className="m3-label-md">{t('common.details')}</span>
        </button>
      }
    >
      {detailsContent}
    </RouteDetailsDialog>
  )

  const firstEtaNode = first?.eta ? (
    <TickingKmbMinutes
      eta={first.eta}
      dataTimestamp={first.data_timestamp}
      lang={lang}
      variant="header"
    />
  ) : (
    <span className="text-on-surface font-tabular shrink-0 text-base font-semibold tracking-tight sm:text-xl">
      —
    </span>
  )

  const fareCodeNode =
    fareLabel || codeLabel ? (
      <div className="text-on-surface-variant m3-label-sm flex min-w-0 items-center gap-1.5 overflow-hidden">
        {fareLabel ? <span className="font-tabular shrink-0">{fareLabel}</span> : null}
        {fareLabel && codeLabel ? (
          <span aria-hidden="true" className="shrink-0 opacity-60">
            ·
          </span>
        ) : null}
        {codeLabel ? <span className="min-w-0 flex-1 truncate font-mono">{codeLabel}</span> : null}
      </div>
    ) : null

  const routeHeader = ({ showEta, showSubtitle }: { showEta: boolean; showSubtitle: boolean }) => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <RouteBadge route={route} company={co} size="lg" />
        <div className="min-w-0 flex-1 overflow-hidden">
          <span className="sr-only">{operatorName}</span>
          <Marquee
            title={typeof label === 'string' ? label : undefined}
            className="text-on-surface m3-body-md min-w-0 flex-1 font-medium"
          >
            {label || t('common.route')}
          </Marquee>
          {fareCodeNode ? (
            <div
              className={cn(
                'ui-expand-panel grid motion-reduce:transition-none',
                showSubtitle ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              )}
              aria-hidden={!showSubtitle}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  className={cn(
                    'ui-expand-inner pt-0.5',
                    showSubtitle ? 'translate-y-0' : '-translate-y-0.5'
                  )}
                >
                  {fareCodeNode}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {showEta && hasEta ? firstEtaNode : null}
        {expandable ? (
          <ChevronDown
            className={cn('text-on-surface-variant ui-chevron h-4 w-4', isExpanded && 'rotate-180')}
          />
        ) : null}
      </div>
    </div>
  )

  const etaPanel = (
    <div className="space-y-2">
      <div className="flex justify-center gap-1.5 pb-0.5 sm:gap-2">
        {items.map((entry, entryIdx) => {
          const remark = pickLang(
            {
              en: entry.rmk_en ?? '',
              tc: entry.rmk_tc ?? '',
              sc: entry.rmk_sc ?? '',
            },
            lang
          )
          const isFirst = entry.eta_seq === 1

          if (isFirst) {
            return (
              <div
                key={`${variantKey}:${entry.eta_seq}:${entryIdx}`}
                className="bg-primary-container text-on-primary-container w-1/3 min-w-0 rounded-xl px-2 py-1.5 text-center sm:px-3 sm:py-2"
              >
                <div className="m3-label-md opacity-80">{formatEtaLabel(entry.eta_seq, lang)}</div>
                <div className="mt-0.5">
                  <TickingKmbMinutes
                    eta={entry.eta}
                    dataTimestamp={entry.data_timestamp}
                    lang={lang}
                    variant="panel"
                  />
                </div>
                {remark ? (
                  <Marquee title={remark} className="m3-label-md mt-1 opacity-80">
                    {remark}
                  </Marquee>
                ) : null}
              </div>
            )
          }

          return (
            <div
              key={`${variantKey}:${entry.eta_seq}:${entryIdx}`}
              className="bg-surface-container-high w-1/3 min-w-0 rounded-lg px-2 py-1.5 text-center sm:px-2.5"
            >
              <div className="text-on-surface-variant m3-label-md">
                {formatEtaLabel(entry.eta_seq, lang)}
              </div>
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
                <Marquee title={remark} className="text-on-surface-variant m3-label-md mt-0.5">
                  {remark}
                </Marquee>
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="flex items-end justify-between gap-2 pt-1">
        <div className="min-w-0 flex-1">{fareCodeNode}</div>
        <div className="pointer-events-auto shrink-0">{DetailsTextButton}</div>
      </div>
    </div>
  )

  const staticFooter = <div className="flex items-center justify-end">{DetailsTextButton}</div>

  // Routes without valid ETAs get a simplified display
  if (!hasEta) {
    const remark = getGroupRemark(items, lang)
    return (
      <div
        className={cn(
          'bg-surface-container relative overflow-hidden rounded-2xl border border-transparent py-3.5 pr-3 pl-0 opacity-70',
          staggerClass
        )}
      >
        <span
          className="absolute inset-y-2.5 left-0 w-1 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
          style={{ backgroundColor: operatorColor }}
          aria-hidden
        />
        <div className="space-y-2.5 pl-4">
          {routeHeader({ showEta: false, showSubtitle: true })}
          <div className="text-on-surface-variant m3-body-md flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            {remark || formatNoScheduledText(t)}
          </div>
          {staticFooter}
        </div>
      </div>
    )
  }

  if (!expandable) {
    return (
      <div
        className={cn(
          'bg-surface-container relative overflow-hidden rounded-2xl border border-[var(--outline-variant)]/10 py-3.5 pr-3 pl-0 shadow-sm',
          staggerClass
        )}
      >
        <span
          className="absolute inset-y-2.5 left-0 w-1 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
          style={{ backgroundColor: operatorColor }}
          aria-hidden
        />
        <div className="space-y-2.5 pl-4">
          {routeHeader({ showEta: true, showSubtitle: true })}
          {staticFooter}
        </div>
      </div>
    )
  }

  return (
    <ExpandableEtaRow
      expanded={isExpanded}
      onToggle={onToggleExpand!}
      color={operatorColor}
      className={staggerClass}
      panel={etaPanel}
      toggleLabel={`${route} ${label ?? ''} ${operatorName}`.trim()}
    >
      {routeHeader({ showEta: !isExpanded, showSubtitle: !isExpanded })}
    </ExpandableEtaRow>
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
  isFirst,
  stopLookup,
  registerStopRef,
  stopChipsById,
  expandedKey,
  onToggleExpand,
}: {
  stopId: string
  stopInfo?: StopInfo
  groups: EtaGroup[]
  routeInfos: Record<string, KmbRouteInfoLite>
  faresByVariantKey?: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
  lang: UiLanguage
  isFirst?: boolean
  stopLookup: Map<string, StopInfo>
  registerStopRef?: (stopId: string) => (el: HTMLElement | null) => void
  stopChipsById: Map<string, StopChips>
  expandedKey?: string | null
  onToggleExpand?: (key: string) => void
}) {
  const { t } = useTranslations(lang)
  const stopName = stopInfo ? pickStopName(stopInfo, lang) : `Stop ${stopId}`
  const parsed = parseKmbStopNameCached(stopName, { isKmb: isKmbStop(stopInfo), lang })
  const stopCodeBadge = parsed.platform ?? parsed.stopCode ?? null
  const stopRef = registerStopRef ? registerStopRef(stopId) : undefined

  return (
    <div
      ref={stopRef}
      className={cn('ui-cv-auto', !isFirst && 'border-outline-variant mt-5 border-t pt-5')}
    >
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-on-surface m3-title-md min-w-0 truncate">{parsed.name}</h3>
        {stopCodeBadge ? (
          <span className="text-on-surface-variant m3-label-md shrink-0 font-mono">
            {stopCodeBadge}
          </span>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <EmptyState title={formatNoScheduledText(t)} className="py-2" />
      ) : (
        <div className="space-y-2">
          {groups.map((g, idx) => (
            <RouteDepartureRow
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
              stopChips={
                stopChipsById.get(stopId) ?? getStopChips(g.items, stopLookup, stopChipsById, lang)
              }
              staggerClass={isFirst ? staggerClassForIndex(idx) : ''}
              expanded={expandedKey === g.key}
              onToggleExpand={() => onToggleExpand?.(g.key)}
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
  hasMoreStops,
  onLoadMore,
  precomputedGroups,
}: Props) {
  // Scroll and visibility state stays local so intersections never hit the store.
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)
  const loadedForVisible = React.useMemo(() => loadedStopIds ?? [], [loadedStopIds])
  const { visibleIds, registerRef } = useVisibleItems(loadedForVisible, { rootMargin: '200px' })
  const visibleStopIds = visibleIds
  const registerStopRef = registerRef

  React.useEffect(() => {
    if (!hasMoreStops || !onLoadMore) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '400px', threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMoreStops, onLoadMore, loadedStopIds])
  const { t, tWithParams } = useTranslations(lang)
  const hasStaleStops = Boolean(
    staleByStopId && Object.values(staleByStopId).some((entry) => entry.stale)
  )

  const [expandedKey, setExpandedKey] = React.useState<string | null>(null)
  const onToggleExpand = React.useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key))
  }, [])

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
      const parsed = parseKmbStopNameCached(fullName, { isKmb: isKmbStop(stop), lang })
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

  // Stagger replay key: query identity only, never live ETA arrays (see the
  // replay rule on staggerClassForIndex). Refresh keeps this key so rows
  // stay still and expand state survives; a new search remounts and replays.
  const listSignature = React.useMemo(() => {
    if (useStopSections) return `keyphrase:${(loadedStopIds ?? []).join(',')}`
    if (multipleStops && loadedStopIds) return `multi:${loadedStopIds.join(',')}`
    return `single:${title}:${stopCode ?? ''}:${routesFilter ?? ''}`
  }, [useStopSections, loadedStopIds, multipleStops, title, stopCode, routesFilter])

  return (
    <div>
      <ResultsHeader
        lang={lang}
        mode="kmb"
        title={title || t('kmb.title')}
        titleAddon={
          stopCode ? (
            <span className="bg-surface-container text-on-surface-variant m3-label-sm shrink-0 rounded-full px-2.5 py-1 font-mono">
              {stopCode}
            </span>
          ) : null
        }
        icon={<Clock className="h-3.5 w-3.5 shrink-0" />}
        subtitle={
          routesFilter?.trim()
            ? `${t('kmb.filtered')} ${routesFilter}`
            : isKeyphraseMode
              ? `${loadedStopIds?.length ?? 0} ${t('kmb.stopsLoaded')}`
              : t('kmb.allRoutesAtStop')
        }
        lastUpdatedAt={lastUpdatedAt}
        stale={stale || hasStaleStops}
        loading={loading}
        onRefresh={onRefresh}
      />

      <div key={listSignature} className="space-y-2">
        {error ? (
          <p className="text-error m3-body-md" aria-live="polite">
            {tWithParams('kmb.updateFailed', { error })}
          </p>
        ) : null}
        {!hasQuery ? (
          <EmptyState title={t('common.selectStop')} />
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
                isFirst={idx === 0}
                stopLookup={stopLookup}
                registerStopRef={registerStopRef}
                stopChipsById={stopChipsById}
                expandedKey={expandedKey}
                onToggleExpand={onToggleExpand}
              />
            ))}

            {/* Infinite scroll sentinel */}
            {hasMoreStops ? (
              <div ref={sentinelRef} className="flex items-center justify-center py-4">
                {loading ? (
                  <div className="text-on-surface-variant m3-body-md flex items-center gap-2">
                    <Loader2 className="ui-spin h-4 w-4" />
                    {t('kmb.loadingMoreStops')}
                  </div>
                ) : (
                  <div className="h-1" /> // Invisible sentinel
                )}
              </div>
            ) : loadedStopIds!.length > 0 ? (
              <div className="text-on-surface-variant m3-label-md py-2 text-center">
                {tWithParams('kmb.allStopsLoaded', { count: loadedStopIds!.length })}
              </div>
            ) : null}
          </>
        ) : precomputedFlat && !multipleStops ? (
          <StaggerList>
            {precomputedFlat.map((g, idx) => {
              const stopId = g.items[0]?.stop ? String(g.items[0].stop).trim() : null
              const stopChips = stopId
                ? (stopChipsById.get(stopId) ??
                  getStopChips(g.items, stopLookup, stopChipsById, lang))
                : getStopChips(g.items, stopLookup, stopChipsById, lang)
              const staggerClass = staggerClassForIndex(idx)

              return (
                <RouteDepartureRow
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
                  staggerClass={cn('ui-cv-row', staggerClass)}
                  stopChips={stopChips}
                  expanded={expandedKey === g.key}
                  onToggleExpand={() => onToggleExpand(g.key)}
                />
              )
            })}
          </StaggerList>
        ) : grouped.length === 0 ? (
          <EmptyState title={formatNoScheduledText(t)} />
        ) : (
          <StaggerList>
            {grouped.map((g, idx) => {
              const stopId = g.items[0]?.stop ? String(g.items[0].stop).trim() : null
              const stopChips = stopId
                ? (stopChipsById.get(stopId) ??
                  getStopChips(g.items, stopLookup, stopChipsById, lang))
                : getStopChips(g.items, stopLookup, stopChipsById, lang)
              const staggerClass = staggerClassForIndex(idx)

              return (
                <RouteDepartureRow
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
                  staggerClass={cn('ui-cv-row', staggerClass)}
                  stopChips={stopChips}
                  expanded={expandedKey === g.key}
                  onToggleExpand={() => onToggleExpand(g.key)}
                />
              )
            })}
          </StaggerList>
        )}
      </div>
    </div>
  )
})
