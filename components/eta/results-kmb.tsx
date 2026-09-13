'use client'

import { ChevronDown, ChevronUp, Clock, Info, Loader2 } from 'lucide-react'
import * as React from 'react'

import type { EtaGroup, PrecomputedGroups } from '@/lib/eta/kmb-eta-groups'
import { groupEtasByVariant } from '@/lib/eta/kmb-eta-groups'
import { RouteBadge } from '@/components/eta/route-badge'
import {
  ApiStatusFooter,
  EtaRealtimeBadge,
  EtaTimeline,
  InterchangePromoBanner,
  SortByTimeToggle,
  WheelchairBadge,
} from '@/components/eta/eta-card-parts'
import { LivePulse, StaggerContainer, StaggerItem } from '@/components/m3/motion'
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
import { hasWheelchairAccess, resolveEtaBadge, sortBySoonestMinutes } from '@/lib/eta/eta-badges'
import { formatRelativeMinutesWithDrift } from '@/lib/eta/format'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { getRouteBadgeStyle } from '@/lib/eta/route-badge'
import { ResultsHeader } from '@/components/eta/results-header'
import { useTickingNow } from '@/lib/eta/use-ticking-now'
import { usePaneStore } from '@/lib/eta/pane-store'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/eta/i18n'
import { ExpandableEtaRow } from '@/components/eta/expandable-eta-row'

function pickLang(fields: { en: string; tc: string; sc: string }, lang: UiLanguage) {
  if (lang === 'sc') return fields.sc
  if (lang === 'en') return fields.en
  return fields.tc
}

function MetaChip({ children, widthClass }: { children?: React.ReactNode; widthClass: string }) {
  return (
    <span
      className={cn(
        'text-on-surface-variant m3-label-md truncate text-right font-mono',
        widthClass
      )}
    >
      {children}
    </span>
  )
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
  if (lang === 'en') return 'Now'
  if (lang === 'sc') return '即将到达'
  return '即將到達'
}

function formatNoScheduledText(lang: UiLanguage) {
  if (lang === 'en') return 'No scheduled buses'
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

function isGroupDimmed(
  items: KmbEtaEntryWithLeg[],
  staleByStopId: Record<string, { stale: boolean; ageMs: number | null }> | undefined,
  stale: boolean | undefined
): boolean {
  const stopId = items[0]?.stop ? String(items[0].stop).trim() : null
  if (stopId && staleByStopId?.[stopId]) return staleByStopId[stopId].stale
  return Boolean(stale)
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
  now,
  staggerClass,
  stopChips,
  expanded,
  onToggleExpand,
  dimmed,
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
  expanded?: boolean
  onToggleExpand?: () => void
  /** Dim the card when its data passed the stale threshold. */
  dimmed?: boolean
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
  const badgeStyle = getRouteBadgeStyle(route, co)

  const { t } = useTranslations(lang)

  const expandable = Boolean(onToggleExpand) && hasEta && items.length >= 1
  const isExpanded = expandable && Boolean(expanded)

  const metaChips = (
    <div className="hidden items-center gap-2 lg:flex">
      <MetaChip widthClass="w-10">{stopChips.platform}</MetaChip>
      <MetaChip widthClass="w-20">{fare ? `HK$ ${fare.hkd.toFixed(1)}` : null}</MetaChip>
      <MetaChip widthClass="w-16">{stopChips.stopCode}</MetaChip>
    </div>
  )

  const InfoButton = (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-primary/30 pointer-events-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
          aria-label={t('common.routeDetails')}
        >
          <Info className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-surface-container-low rounded-3xl border-0">
        <DialogHeader>
          <DialogTitle className="m3-title-md text-on-surface">
            {route} {destination ? `→ ${destination}` : label ? `→ ${label}` : ''}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('common.routeAndStopDetails')}
          </DialogDescription>
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

          {fare ? (
            <div className="space-y-1">
              <div className="text-on-surface-variant m3-label-md">{t('common.fare')}</div>
              <div className="text-on-surface m3-body-md font-medium">
                HK$ {fare.hkd.toFixed(1)}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )

  const formatMinutesDisplay = (minutes: number | null) => {
    if (minutes === null || Number.isNaN(minutes)) return '—'
    if (minutes <= 0) return formatArrivingText(lang)
    return lang === 'en' ? `${minutes} min` : `${minutes} 分`
  }

  const firstMinutes = first?.eta
    ? formatRelativeMinutesWithDrift(first.eta, first.data_timestamp, now)
    : null
  const firstIsArriving = firstMinutes !== null && !Number.isNaN(firstMinutes) && firstMinutes <= 0

  const firstBadge = first?.eta
    ? resolveEtaBadge({
        mode: 'kmb',
        etaSeq: first.eta_seq,
        rmk_tc: first.rmk_tc,
        rmk_sc: first.rmk_sc,
        rmk_en: first.rmk_en,
        dataTimestamp: first.data_timestamp,
        now,
      })
    : 'scheduled'
  const groupWheelchair = items.some((entry) =>
    hasWheelchairAccess(entry.rmk_tc, entry.rmk_sc, entry.rmk_en)
  )
  const timelineMinutes = items
    .slice(0, 3)
    .map((entry) =>
      entry.eta ? formatRelativeMinutesWithDrift(entry.eta, entry.data_timestamp, now) : null
    )

  const FirstEta = () =>
    firstIsArriving ? (
      <span className="bg-primary-container text-on-primary-container m3-label-md sm:m3-label-lg font-tabular flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold sm:px-2.5">
        <LivePulse />
        {formatArrivingText(lang)}
      </span>
    ) : (
      <span className="text-on-surface font-tabular shrink-0 text-base font-semibold tracking-tight sm:text-xl">
        {formatMinutesDisplay(firstMinutes)}
      </span>
    )

  const routeHeader = (showEta: boolean) => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <RouteBadge route={route} company={co} size="lg" />
        <span className="text-on-surface-variant m3-label-md hidden shrink-0 sm:inline">
          {formatOperatorLabel(first?.co ?? co, lang)}
        </span>
        <Marquee
          title={typeof label === 'string' ? label : undefined}
          className="text-on-surface m3-body-md min-w-0 flex-1 font-medium"
        >
          {label || 'Route'}
        </Marquee>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {metaChips}
        {InfoButton}
        {showEta && hasEta ? (
          <>
            <EtaRealtimeBadge badge={firstBadge} lang={lang} />
            <WheelchairBadge visible={groupWheelchair} lang={lang} />
          </>
        ) : null}
        {showEta && hasEta ? <FirstEta /> : null}
        {expandable ? (
          isExpanded ? (
            <ChevronUp className="text-on-surface-variant h-4 w-4" />
          ) : (
            <ChevronDown className="text-on-surface-variant h-4 w-4" />
          )
        ) : null}
      </div>
    </div>
  )

  const etaPanel = (
    <div className="space-y-2">
      <div className="flex justify-center gap-1.5 pb-0.5 sm:gap-2">
        {items.map((entry, entryIdx) => {
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
          const isFirst = entry.eta_seq === 1
          const isArriving = minutes !== null && !Number.isNaN(minutes) && minutes <= 0

          if (isFirst) {
            return (
              <div
                key={`${variantKey}:${entry.eta_seq}:${entry.eta ?? ''}:${entry.data_timestamp ?? ''}:${entryIdx}`}
                className="bg-primary-container text-on-primary-container w-1/3 min-w-0 rounded-xl px-2 py-1.5 text-center sm:px-3 sm:py-2"
              >
                <div className="m3-label-md opacity-80">{formatEtaLabel(entry.eta_seq, lang)}</div>
                <div className="font-tabular mt-0.5 flex items-center justify-center gap-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
                  {isArriving ? <LivePulse /> : null}
                  {formatMinutesDisplay(minutes)}
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
              key={`${variantKey}:${entry.eta_seq}:${entry.eta ?? ''}:${entry.data_timestamp ?? ''}:${entryIdx}`}
              className="bg-surface-container-high w-1/3 min-w-0 rounded-lg px-2 py-1.5 text-center sm:px-2.5"
            >
              <div className="text-on-surface-variant m3-label-md">
                {formatEtaLabel(entry.eta_seq, lang)}
              </div>
              <div className="text-on-surface font-tabular text-base font-semibold tracking-tight sm:text-lg">
                {formatMinutesDisplay(minutes)}
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
      <EtaTimeline minutes={timelineMinutes} lang={lang} stale={dimmed} />
    </div>
  )

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
          className="absolute inset-y-2.5 left-0 w-[3px] rounded-full"
          style={{ backgroundColor: badgeStyle.bgColor }}
          aria-hidden
        />
        <div className="space-y-2.5 pl-4">
          {routeHeader(false)}
          <div className="text-on-surface-variant m3-body-md flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            {remark || formatNoScheduledText(lang)}
          </div>
        </div>
      </div>
    )
  }

  if (!expandable) {
    return (
      <div
        className={cn(
          'bg-surface-container relative overflow-hidden rounded-2xl border border-[var(--outline-variant)]/10 py-3.5 pr-3 pl-0 shadow-sm',
          staggerClass,
          dimmed && 'opacity-60'
        )}
      >
        <span
          className="absolute inset-y-2.5 left-0 w-[3px] rounded-full"
          style={{ backgroundColor: badgeStyle.bgColor }}
          aria-hidden
        />
        <div className="space-y-2.5 pl-4">
          {routeHeader(true)}
          <EtaTimeline minutes={timelineMinutes} lang={lang} stale={dimmed} />
        </div>
      </div>
    )
  }

  return (
    <ExpandableEtaRow
      expanded={isExpanded}
      onToggle={onToggleExpand!}
      color={badgeStyle.bgColor}
      className={cn(staggerClass, dimmed && 'opacity-60')}
      panel={etaPanel}
      toggleLabel={`${route} ${label ?? ''}`.trim()}
    >
      {routeHeader(!isExpanded)}
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
  now,
  isFirst,
  stopLookup,
  registerStopRef,
  stopChipsById,
  expandedKey,
  onToggleExpand,
  dimmed,
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
  expandedKey?: string | null
  onToggleExpand?: (key: string) => void
  dimmed?: boolean
}) {
  const stopName = stopInfo ? pickStopName(stopInfo, lang) : `Stop ${stopId}`
  const parsed = parseKmbStopNameCached(stopName)
  const stopCodeBadge = parsed.platform ?? parsed.stopCode ?? null
  const stopRef = registerStopRef ? registerStopRef(stopId) : undefined

  return (
    <div ref={stopRef} className={cn(!isFirst && 'border-outline-variant mt-5 border-t pt-5')}>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-on-surface m3-title-md min-w-0 truncate">{parsed.name}</h3>
        {stopCodeBadge ? (
          <span className="text-on-surface-variant m3-label-md shrink-0 font-mono">
            {stopCodeBadge}
          </span>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <div className="text-on-surface-variant m3-body-md flex items-center gap-2 py-2">
          <Info className="h-4 w-4" />
          {formatNoScheduledText(lang)}
        </div>
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
              expanded={expandedKey === g.key}
              onToggleExpand={() => onToggleExpand?.(g.key)}
              dimmed={dimmed}
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
  const hasStaleStops = Boolean(
    staleByStopId && Object.values(staleByStopId).some((entry) => entry.stale)
  )

  const [expandedKey, setExpandedKey] = React.useState<string | null>(null)
  const onToggleExpand = React.useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key))
  }, [])

  /** Sort-by-time toggle. Transient pane-store state, works in the desktop column and mobile list. */
  const sortByTime = usePaneStore((s) => s.sortByTime)
  const setSortByTime = usePaneStore((s) => s.setSortByTime)
  const onToggleSort = React.useCallback(() => {
    setSortByTime(!sortByTime)
  }, [setSortByTime, sortByTime])

  const groupSoonestMinutes = React.useCallback(
    (group: EtaGroup) => {
      const upcoming = group.items.find((entry) => entry.eta)
      if (!upcoming?.eta) return null
      return formatRelativeMinutesWithDrift(upcoming.eta, upcoming.data_timestamp, now)
    },
    [now]
  )

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

  const sortedFlat = React.useMemo(
    () =>
      precomputedFlat && sortByTime
        ? sortBySoonestMinutes(precomputedFlat, groupSoonestMinutes)
        : precomputedFlat,
    [precomputedFlat, sortByTime, groupSoonestMinutes]
  )
  const sortedGrouped = React.useMemo(
    () => (sortByTime ? sortBySoonestMinutes(grouped, groupSoonestMinutes) : grouped),
    [grouped, sortByTime, groupSoonestMinutes]
  )

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
        sortControl={<SortByTimeToggle active={sortByTime} onToggle={onToggleSort} lang={lang} />}
      />

      <div className="space-y-2">
        {error ? (
          <p className="text-error m3-body-md">{tWithParams('kmb.updateFailed', { error })}</p>
        ) : null}
        {!hasQuery ? (
          <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
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
                expandedKey={expandedKey}
                onToggleExpand={onToggleExpand}
                dimmed={staleByStopId?.[stopId]?.stale ?? stale ?? hasStaleStops}
              />
            ))}

            {/* Infinite scroll sentinel */}
            {hasMoreStops ? (
              <div ref={sentinelRef} className="flex items-center justify-center py-4">
                {loading ? (
                  <div className="text-on-surface-variant m3-body-md flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
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
        ) : sortedFlat && !multipleStops ? (
          <StaggerContainer className="space-y-2" stagger={0.02}>
            {sortedFlat.map((g, idx) => {
              const stopId = g.items[0]?.stop ? String(g.items[0].stop).trim() : null
              const stopChips = stopId
                ? (stopChipsById.get(stopId) ??
                  getStopChips(g.items, stopLookup, stopChipsById, lang))
                : getStopChips(g.items, stopLookup, stopChipsById, lang)
              const staggerClass =
                idx === 0
                  ? 'ui-stagger-1'
                  : idx === 1
                    ? 'ui-stagger-2'
                    : idx === 2
                      ? 'ui-stagger-3'
                      : ''

              return (
                <StaggerItem key={g.key}>
                  <RouteDepartureRow
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
                    expanded={expandedKey === g.key}
                    onToggleExpand={() => onToggleExpand(g.key)}
                    dimmed={isGroupDimmed(g.items, staleByStopId, stale || hasStaleStops)}
                  />
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        ) : sortedGrouped.length === 0 ? (
          <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
            <Info className="h-4 w-4" />
            {formatNoScheduledText(lang)}
          </div>
        ) : (
          <StaggerContainer className="space-y-2" stagger={0.02}>
            {sortedGrouped.map((g, idx) => {
              const stopId = g.items[0]?.stop ? String(g.items[0].stop).trim() : null
              const stopChips = stopId
                ? (stopChipsById.get(stopId) ??
                  getStopChips(g.items, stopLookup, stopChipsById, lang))
                : getStopChips(g.items, stopLookup, stopChipsById, lang)
              const staggerClass =
                idx === 0
                  ? 'ui-stagger-1'
                  : idx === 1
                    ? 'ui-stagger-2'
                    : idx === 2
                      ? 'ui-stagger-3'
                      : ''

              return (
                <StaggerItem key={g.key}>
                  <RouteDepartureRow
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
                    expanded={expandedKey === g.key}
                    onToggleExpand={() => onToggleExpand(g.key)}
                    dimmed={isGroupDimmed(g.items, staleByStopId, stale || hasStaleStops)}
                  />
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        )}
      </div>
      {hasQuery ? (
        <div className="mt-4 space-y-3">
          <InterchangePromoBanner lang={lang} />
          <ApiStatusFooter
            lang={lang}
            mode="kmb"
            lastUpdatedAt={lastUpdatedAt}
            stale={stale || hasStaleStops}
          />
        </div>
      ) : null}
    </div>
  )
})
