'use client'

import { ChevronDown, ChevronLeft, Clock, Info, Search, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import * as React from 'react'

import { RouteBadge } from '@/components/eta/route-badge'
import { Marquee } from '@/components/ui/marquee'
import { EmptyState } from '@/components/eta/empty-state'
import { FavoriteSaveButton } from '@/components/eta/favorite-save-button'
import { OperatorFilter } from '@/components/eta/operator-filter'
import { formatScheduledLine } from '@/components/eta/results-kmb'
import {
  SpecialDeparturesLine,
  DepartureChips,
  CARD_CHIP_LIMIT,
} from '@/components/eta/route-details-dialog'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { RouteResultCard } from '@/components/eta/route-result-card'
import { RouteScheduleSection } from '@/components/eta/route-schedule-section'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RouteStopCard } from '@/components/eta/route-stop-timeline'
import { staggerClassForIndex } from '@/components/eta/stagger-list'
import { TickingKmbMinutes, TickingSoonestPill } from '@/components/eta/ticking-eta'
import { useHeadwaySchedule } from '@/lib/eta/headway/use-headway-schedule'
import { formatEtaOrdinals } from '@/lib/eta/kmb-eta-groups'
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
import type { Company } from 'hk-bus-eta'

import { getEtaDbIndexes } from '@/lib/eta/direct/eta-db'
import { findRouteEntryByFamily, routeVariantKey } from '@/lib/eta/eta-db-index'
import { getFaresBySeq, groupIntoFareSections } from '@/lib/eta/kmb-fare-sections'
import {
  FARE_UNKNOWN_COLOR,
  getFareSectionColor,
  getStreetSectionColor,
} from '@/lib/eta/fare-colors'
import { formatFareHkd } from '@/lib/eta/format'
import type { GeoPoint } from '@/lib/eta/geo'
import { formatKmbRouteEndpointName, parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import {
  buildStreetRuns,
  parseCtbStopNameCached,
  pickCtbDisplayName,
} from '@/lib/eta/ctb-stop-street'
import { normalizeOperator } from '@/lib/eta/operator-colors'
import { pickLang } from '@/lib/eta/pick-lang'
import { getReadableForeground } from '@/lib/ui/color'
import {
  buildRouteSearchIndex,
  compareRouteVariants,
  countRoutesByStopName,
  loadRouteFuseIndex,
  operatorCounts,
  pickCanonicalVariant,
  searchRouteIndex,
  type RouteFuseInstance,
} from '@/lib/eta/route-search'
import { getRouteDisplayGeometry } from '@/lib/eta/routing'
import { usePaneStore } from '@/lib/eta/pane-store'
import { useInfiniteScroll } from '@/lib/eta/use-infinite-scroll'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
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
  gtfsId: string
  region: string
  origin: { en: string; tc: string; sc: string }
  destination: { en: string; tc: string; sc: string }
}

/** Selected region entry (search hit), not just co|route: same-number
 * minibus routes in different regions are separate selections. */
type RouteSelection = {
  co: string
  route: string
  region: string
}

function variantBaseKey(entry: {
  co?: string
  route?: string
  bound?: string
  dir?: string
  serviceType?: string
  service_type?: string | number
  gtfsId?: string
}): string {
  const base = `${normalizeOperator(entry.co)}|${String(entry.route ?? '').toUpperCase()}|${entry.bound ?? entry.dir ?? ''}|${String(entry.serviceType ?? entry.service_type ?? '')}`
  const gtfsId = String(entry.gtfsId ?? '').trim()
  return gtfsId ? `${base}|${gtfsId}` : base
}

function hasDuplicateOperators(variants: RouteVariant[]): boolean {
  const cos = new Set(variants.map((v) => normalizeOperator(v.co)))
  return cos.size > 1
}

/**
 * Expandable KMB stop card. Collapsed header shows the stop plus the
 * soonest bus; expanding lists up to three departures. Matches the
 * stop-mode route card layout.
 */
function KmbRouteStopCard({
  stopEtas,
  stopId,
  name,
  stopCode,
  seq,
  lang,
  expanded,
  onToggle,
  selectLabel,
  onSelect,
}: {
  stopEtas: KmbEtaEntryWithLeg[]
  /** App stop id for per-stop schedule resolution. */
  stopId: string
  name: string
  stopCode: string | null
  seq: number
  lang: UiLanguage
  expanded: boolean
  onToggle: () => void
  selectLabel?: string
  onSelect?: () => void
}) {
  const sorted = React.useMemo(
    () =>
      [...stopEtas]
        .filter((entry) => Boolean(entry.eta))
        .sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime()),
    [stopEtas]
  )
  const visible = sorted.slice(0, 3)
  const { t: cardT, tWithParams: cardTWithParams } = useTranslations(lang)

  // Scheduled fallback for the stop card's variant (all entries here share
  // one variant; the hook is unconditional with a possibly-null key).
  const cardBaseKey = React.useMemo(() => {
    const first = stopEtas[0]
    if (!first) return null
    return variantBaseKey(first)
  }, [stopEtas])
  const cardScheduled = useHeadwaySchedule(cardBaseKey, undefined, stopId)

  const panel =
    visible.length === 0 ? (
      <div className="space-y-2">
        <div className="text-on-surface-variant m3-body-md flex items-center gap-2">
          {(() => {
            for (const entry of stopEtas) {
              const remark =
                pickLang(
                  { en: entry.rmk_en ?? '', tc: entry.rmk_tc ?? '', sc: entry.rmk_sc ?? '' },
                  lang
                ).trim() || null
              if (remark) return remark
            }
            return cardScheduled &&
              (cardScheduled.headwayMin != null ||
                cardScheduled.headwayRange != null ||
                (cardScheduled.departures != null && cardScheduled.departures.length > 0) ||
                (cardScheduled.departureGroups != null &&
                  cardScheduled.departureGroups.length > 0) ||
                (cardScheduled.first && cardScheduled.last))
              ? formatScheduledLine(cardScheduled, cardT, cardTWithParams)
              : cardT('common.noScheduledBuses')
          })()}
        </div>
        {cardScheduled?.departureGroups && cardScheduled.departureGroups.length > 0 ? (
          <SpecialDeparturesLine special={cardScheduled.departureGroups} lang={lang} />
        ) : cardScheduled?.departures && cardScheduled.departures.length > 0 ? (
          <DepartureChips departures={cardScheduled.departures} lang={lang} cap={CARD_CHIP_LIMIT} />
        ) : null}
        {cardScheduled?.special ? (
          <SpecialDeparturesLine special={cardScheduled.special} lang={lang} />
        ) : null}
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
            const label = formatEtaOrdinals(entry.eta_seq, lang)
            const isFirst = entryIdx === 0
            if (isFirst) {
              return (
                <div
                  key={`${entry.eta_seq}:${entryIdx}`}
                  className="bg-primary-container text-on-primary-container w-1/3 min-w-0 rounded-xl px-2 py-1.5 text-center sm:px-3 sm:py-2"
                >
                  <div className="m3-label-md opacity-80">{label}</div>
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
                <div className="text-on-surface-variant m3-label-md">{label}</div>
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
        {stopCode ? (
          <div className="text-on-surface-variant m3-label-sm flex min-w-0 items-center gap-1.5 overflow-hidden">
            <span className="min-w-0 flex-1 truncate font-mono">{stopCode}</span>
          </div>
        ) : null}
      </div>
    )

  return (
    <RouteStopCard
      expanded={expanded}
      onToggle={onToggle}
      seq={seq}
      name={name}
      subtitle={stopCode}
      eta={<TickingSoonestPill etas={stopEtas} lang={lang} />}
      panel={panel}
      toggleLabel={name}
      selectLabel={selectLabel}
      onSelect={onSelect}
    />
  )
}

/**
 * Colored pill with a sticky vertical label. The building block of the fare
 * rail and the CTB street rail. Sections without data render the neutral
 * rail with no label. Renders as a grid item spanning its run in timeline
 * mode, or stretched inside a SectionRail in section mode.
 */
function RailPill({
  label,
  color,
  flip = true,
  className,
  style,
}: {
  label: string | null
  color: string
  /**
   * False renders the label upright instead of upside down. The street rail
   * passes this for Chinese, which conventionally reads top to bottom with
   * no rotation; Latin keeps the fare rail style.
   */
  flip?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      aria-hidden={!label}
      aria-label={label ?? undefined}
      title={label ?? undefined}
      className={cn('flex min-h-16 flex-col rounded-full py-2', className)}
      style={{ backgroundColor: color, ...style }}
    >
      {label ? (
        <div className="sticky top-16 flex justify-center">
          <span
            aria-hidden
            className={cn(
              'font-tabular m3-label-md font-semibold whitespace-nowrap',
              getReadableForeground(color),
              flip && 'rotate-180'
            )}
            style={{ writingMode: 'vertical-rl' }}
          >
            {label}
          </span>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Vertical section rail copied from the fare display: a colored pill with a
 * sticky vertical label. Used for both the fare rail and the CTB street rail.
 * Sections without data render the neutral rail with no label.
 */
function SectionRail({
  label,
  color,
  flip = true,
}: {
  label: string | null
  color: string
  /**
   * False renders the label upright instead of upside down. The street rail
   * passes this for Chinese, which conventionally reads top to bottom with
   * no rotation; Latin keeps the fare rail style.
   */
  flip?: boolean
}) {
  return (
    <div className="flex w-7 shrink-0 flex-col">
      <RailPill label={label} color={color} flip={flip} className="flex-1" />
    </div>
  )
}

function KmbRouteStopList({
  currentVariant,
  variantStops,
  stopsById,
  etas,
  lang,
  onSelectStopGroup,
  listKey,
  expandedKey,
  onToggleStop,
}: {
  listKey: string
  currentVariant: RouteVariant
  variantStops: KmbRouteStopLite[]
  stopsById: Map<string, KmbStopSearchItem>
  etas: Record<string, KmbEtaEntryWithLeg[]>
  lang: UiLanguage
  onSelectStopGroup?: (payload: { stopIds: string[]; title: string; route: string }) => void
  expandedKey: string | null
  onToggleStop: (cardKey: string) => void
}) {
  const variantKey = routeVariantKey({
    co: currentVariant.co as Company,
    route: currentVariant.route,
    bound: currentVariant.bound,
    serviceType: currentVariant.serviceType,
    gtfsId: currentVariant.gtfsId,
  })
  const [faresBySeq, setFaresBySeq] = React.useState<Record<number, number>>({})

  React.useEffect(() => {
    let cancelled = false
    getEtaDbIndexes()
      .then(({ routeVariantIndex }) => {
        if (cancelled) return
        const entry =
          routeVariantIndex.get(variantKey) ??
          findRouteEntryByFamily(routeVariantIndex, {
            co: currentVariant.co as Company,
            route: currentVariant.route,
            bound: currentVariant.bound,
            serviceType: currentVariant.serviceType,
          })
        setFaresBySeq(entry ? getFaresBySeq(entry, currentVariant.co) : {})
      })
      .catch(() => {
        if (!cancelled) setFaresBySeq({})
      })
    return () => {
      cancelled = true
    }
    // listKey already remounts this list on variant change, and the key
    // string is cheaper to depend on than the whole variant object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey])

  const { t } = useTranslations(lang)

  // Only CTB route stops split "{name}, {street}". Other operators keep
  // the existing stop-name parsing untouched.
  const isCtbRoute = normalizeOperator(currentVariant.co) === 'ctb'

  const sections = React.useMemo(
    () => groupIntoFareSections(variantStops, (rs) => faresBySeq[rs.seq] ?? null),
    [variantStops, faresBySeq]
  )

  // Known fare sections consume palette indices in order; unknown
  // sections render the neutral rail without shifting later colors.
  // Shared with the timeline grid below so both modes agree.
  const sectionColors = React.useMemo(
    () =>
      sections.map((section, idx) => {
        if (section.fare === null) return FARE_UNKNOWN_COLOR
        const knownIdx = sections.slice(0, idx).filter((s) => s.fare !== null).length
        return getFareSectionColor(knownIdx)
      }),
    [sections]
  )

  const seqByStopSeq = React.useMemo(() => {
    const map = new Map<number, number>()
    variantStops.forEach((rs, index) => {
      if (!map.has(rs.seq)) map.set(rs.seq, index + 1)
    })
    return map
  }, [variantStops])

  // First stop row per section, so entrance stagger stays global
  // across sections. The list remounts on `listKey`, which replays the
  // stagger on variant change but keeps rows still on refresh.
  const sectionStartRows = React.useMemo(() => {
    const counts = sections.map((section) => section.items.length)
    return counts.map((_, idx) => counts.slice(0, idx).reduce((a, b) => a + b, 0))
  }, [sections])

  // Street per stop sequence for the CTB street rail. Null when the stop
  // name has no "{name}, {street}" shape. Splits off the already-parsed
  // name so joint KMB/CTB stops keep the EN title-casing.
  const streetBySeq = React.useMemo(() => {
    const map = new Map<number, string | null>()
    if (!isCtbRoute) return map
    for (const rs of variantStops) {
      if (map.has(rs.seq)) continue
      const stop = stopsById.get(rs.stopId)
      const fullName = stop
        ? pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
        : rs.stopId
      const parsed = parseKmbStopNameCached(fullName, {
        isKmb: isKmbStop(stop),
        lang,
      })
      map.set(rs.seq, parseCtbStopNameCached(parsed.name).street)
    }
    return map
  }, [variantStops, stopsById, lang, isCtbRoute])

  // Skip the street rail entirely when no stop on the route has a street.
  const showStreetRail =
    isCtbRoute && Array.from(streetBySeq.values()).some((street) => street !== null)

  // Global street runs across the whole route. A road never splits at a fare
  // boundary; consecutive stops on the same street share one rail. Stops
  // without a street get the neutral rail with no label, the same way fare
  // sections without fare data skip the label.
  const streetSections = React.useMemo(() => {
    if (!showStreetRail) return null
    return buildStreetRuns(variantStops, (rs) => streetBySeq.get(rs.seq) ?? null)
  }, [variantStops, streetBySeq, showStreetRail])

  // Row timeline for grid mode: one row per stop, fare runs in column 1 and
  // street runs in column 2, each spanning exactly its own rows. Both rails
  // stay continuous with independent breaks, so neither splits the other.
  // Runs partition the stop list in order, so starts are cumulative offsets.
  const timeline = React.useMemo(() => {
    if (!streetSections) return null
    const withRows = <R extends { key: string; items: readonly unknown[] }>(runs: R[]) => {
      let row = 1
      return runs.map((run) => {
        const start = row
        row += run.items.length
        return { ...run, start, span: run.items.length }
      })
    }
    return {
      fareRuns: withRows(
        sections.map((section, sectionIdx) => ({
          key: `fare:${section.fare ?? 'unknown'}:${sectionIdx}`,
          label: section.fare !== null ? formatFareHkd(section.fare) : null,
          color: sectionColors[sectionIdx] ?? FARE_UNKNOWN_COLOR,
          items: section.items,
        }))
      ),
      streetRuns: withRows(
        streetSections.map((streetSection, streetIdx) => ({
          key: `street:${streetSection.street ?? 'unknown'}:${streetIdx}`,
          label: streetSection.street,
          color:
            streetSection.street !== null
              ? getStreetSectionColor(streetSection.colorIdx)
              : FARE_UNKNOWN_COLOR,
          items: streetSection.items,
        }))
      ),
    }
  }, [streetSections, sections, sectionColors])

  const renderStopCard = (rs: KmbRouteStopLite) => {
    const seq = seqByStopSeq.get(rs.seq) ?? rs.seq
    const stop = stopsById.get(rs.stopId)
    const stopEtas = etas[rs.stopId] ?? []
    const fullName = stop
      ? pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
      : rs.stopId
    const parsed = parseKmbStopNameCached(fullName, {
      isKmb: isKmbStop(stop),
      lang,
    })
    // Split the street off the already-parsed name so joint KMB/CTB stops
    // keep the EN title-casing.
    const ctb = isCtbRoute ? parseCtbStopNameCached(parsed.name) : null
    const group = getStopGroupForClick(rs.stopId, variantStops, stopsById, lang)
    const cardKey = `${rs.stopId}:${rs.seq}`
    return (
      <KmbRouteStopCard
        stopEtas={stopEtas}
        stopId={rs.stopId}
        name={pickCtbDisplayName(ctb?.name, parsed.name)}
        stopCode={parsed.platform ?? parsed.stopCode}
        seq={seq}
        lang={lang}
        expanded={expandedKey === cardKey}
        onToggle={() => onToggleStop(cardKey)}
        selectLabel={group && onSelectStopGroup ? t('common.viewEtas') : undefined}
        onSelect={
          group && onSelectStopGroup
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
  }

  return (
    <div key={listKey} className="space-y-3">
      {timeline ? (
        <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-2">
          {timeline.fareRuns.map((run) => (
            <RailPill
              key={run.key}
              label={run.label}
              color={run.color}
              className="w-7"
              style={{ gridColumn: 1, gridRow: `${run.start} / span ${run.span}` }}
            />
          ))}
          {timeline.streetRuns.map((run) => (
            <RailPill
              key={run.key}
              label={run.label}
              color={run.color}
              flip={lang === 'en'}
              className="w-7"
              style={{ gridColumn: 2, gridRow: `${run.start} / span ${run.span}` }}
            />
          ))}
          {variantStops.map((rs, index) => (
            <div
              key={`${rs.stopId}:${rs.seq}`}
              id={`kmb-route-stop-${rs.stopId}:${rs.seq}`}
              className={cn('ui-cv-row min-w-0 scroll-mt-4 py-1', staggerClassForIndex(index))}
              style={{ gridColumn: 3, gridRow: index + 1 }}
            >
              {renderStopCard(rs)}
            </div>
          ))}
        </div>
      ) : (
        sections.map((section, sectionIdx) => {
          const fareLabel = section.fare !== null ? formatFareHkd(section.fare) : null
          const sectionColor = sectionColors[sectionIdx] ?? FARE_UNKNOWN_COLOR
          return (
            <section
              key={`${section.fare ?? 'unknown'}:${sectionIdx}`}
              aria-label={fareLabel ?? undefined}
              className="flex gap-2"
            >
              <SectionRail label={fareLabel} color={sectionColor} />
              <div className="min-w-0 flex-1 space-y-2">
                {section.items.map((rs, itemIdx) => (
                  <div
                    key={`${rs.stopId}:${rs.seq}`}
                    id={`kmb-route-stop-${rs.stopId}:${rs.seq}`}
                    className={cn(
                      'ui-cv-row scroll-mt-4',
                      staggerClassForIndex((sectionStartRows[sectionIdx] ?? 0) + itemIdx)
                    )}
                  >
                    {renderStopCard(rs)}
                  </div>
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
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
            gtfsId: String(entry.gtfsId ?? '').trim(),
            region: String(entry.region ?? '').trim(),
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
  // Share the pane-store list so the routes view never fetches its own
  // copy when the stops pane already loaded one. Always revalidate on
  // mount through the cached fetcher; the store guard skips the write
  // when the contents are unchanged.
  const stops = usePaneStore((s) => s.kmbStops)
  const setStops = usePaneStore((s) => s.setKmbStops)
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
  }, [setStops])
  return stops
}

function useKmbRouteGeometry(
  params: {
    variant: {
      key: string
      co: string
      route: string
      bound: string
      serviceType: string
      gtfsId: string
    } | null
    points: GeoPoint[]
  },
  { stopsVariantKey }: { stopsVariantKey: string | null }
): GeoPoint[] | null {
  const [result, setResult] = React.useState<{
    variantKey: string
    geometry: GeoPoint[]
  } | null>(null)
  const variant = params.variant && stopsVariantKey === params.variant.key ? params.variant : null

  React.useEffect(() => {
    if (!variant || params.points.length < 2) return
    let cancelled = false
    const load = async () => {
      // The per-operator bound lives on the raw eta-db entry. The variant
      // already carries its gtfsId, so geometry resolves to the same
      // region's waypoint file without an extra lookup.
      const gtfsId = String(variant.gtfsId ?? '').trim() || null
      let perCoBound: string | null = null
      try {
        const { routeVariantIndex } = await getEtaDbIndexes()
        const entry =
          routeVariantIndex.get(
            routeVariantKey({
              co: normalizeOperator(variant.co) as Company,
              route: variant.route,
              bound: variant.bound,
              serviceType: variant.serviceType,
              gtfsId: variant.gtfsId,
            })
          ) ??
          findRouteEntryByFamily(routeVariantIndex, {
            co: normalizeOperator(variant.co) as Company,
            route: variant.route,
            bound: variant.bound,
            serviceType: variant.serviceType,
          })
        if (entry) {
          perCoBound = entry.bound[entry.co[0]] ?? null
        }
      } catch {
        perCoBound = null
      }
      if (cancelled) return
      return getRouteDisplayGeometry({
        variantKey: variant.key,
        gtfsId,
        bound: perCoBound,
        points: params.points,
      })
    }
    load()
      .then((geometry) => {
        if (!cancelled && geometry) setResult({ variantKey: variant.key, geometry })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [variant, params.points])

  return result && result.variantKey === variant?.key ? result.geometry : null
}

export function KmbRoutesView({
  lang,
  initialSelection,
  onSelectStopGroup,
}: {
  lang: UiLanguage
  initialSelection?: {
    co: string
    route: string
    region?: string
    bound?: string
    serviceType?: string
  }
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
  const [operators, setOperators] = React.useState<string[]>([])
  const [controlsOpen, setControlsOpen] = React.useState(true)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const routeStopsAll = usePaneStore((s) => s.kmbRouteStops)
  const setRouteStopsAll = usePaneStore((s) => s.setKmbRouteStops)
  const [fuse, setFuse] = React.useState<RouteFuseInstance | null>(null)
  const [manualSelection, setManualSelection] = React.useState<{
    sourceKey: string
    routeKey: RouteSelection | null
    variant: RouteVariant | null
  }>({ sourceKey: '', routeKey: null, variant: null })
  const [variantStops, setVariantStops] = React.useState<KmbRouteStopLite[]>([])
  const [stopsVariantKey, setStopsVariantKey] = React.useState<string | null>(null)
  const [etas, setEtas] = React.useState<Record<string, KmbEtaEntryWithLeg[]>>({})
  const [expandedStop, setExpandedStop] = React.useState<{
    variantKey: string
    cardKey: string
  } | null>(null)

  const addFavorite = useAppStore((s) => s.addFavorite)

  const routeEntries = React.useMemo(() => {
    const map = new Map<string, RouteSelection>()
    // One entry per region so same-number minibus routes in different
    // regions never merge, even before the search index builds.
    for (const r of routes) {
      const co = normalizeOperator(String(r.co ?? 'kmb'))
      const region = String(r.region ?? '').trim()
      const key = region ? `${co}|${r.route}|${region}` : `${co}|${r.route}`
      if (!map.has(key)) map.set(key, { co, route: r.route, region })
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        a.route.localeCompare(b.route, undefined, { numeric: true }) ||
        a.region.localeCompare(b.region)
    )
  }, [routes])

  const initialKey = React.useMemo(
    () =>
      initialSelection
        ? `${normalizeOperator(initialSelection.co)}|${initialSelection.route}|${initialSelection.region ?? ''}|${initialSelection.bound ?? ''}|${initialSelection.serviceType ?? ''}`
        : '',
    [initialSelection]
  )

  const autoRouteKey = React.useMemo(() => {
    if (!initialSelection || routes.length === 0) return null
    const co = normalizeOperator(initialSelection.co)
    const route = initialSelection.route
    const region = initialSelection.region
    const inRegion = routeEntries.filter((e) => normalizeOperator(e.co) === co && e.route === route)
    if (region !== undefined) {
      return inRegion.find((e) => e.region === region) ?? null
    }
    return inRegion[0] ?? null
  }, [initialSelection, routes, routeEntries])

  const autoVariant = React.useMemo(() => {
    if (!initialSelection || !autoRouteKey || routes.length === 0) return null
    const co = normalizeOperator(initialSelection.co)
    const route = initialSelection.route
    const matchingVariants = routes.filter(
      (r) =>
        r.route === route &&
        normalizeOperator(String(r.co ?? 'kmb')) === co &&
        String(r.region ?? '').trim() === autoRouteKey.region
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
    const target =
      matchedVariant ??
      pickCanonicalVariant(
        matchingVariants.map((v) => ({
          bound: v.bound,
          serviceType: v.serviceType,
          source: v,
        }))
      )?.source ??
      matchingVariants[0]
    if (!target) return null
    const targetGtfsId = String(target.gtfsId ?? '').trim()
    return {
      key: targetGtfsId
        ? `${target.co}|${target.route}|${target.bound}|${target.serviceType}|${targetGtfsId}`
        : `${target.co}|${target.route}|${target.bound}|${target.serviceType}`,
      co: String(target.co ?? 'kmb'),
      route: target.route,
      bound: target.bound,
      serviceType: target.serviceType,
      gtfsId: targetGtfsId,
      region: String(target.region ?? '').trim(),
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

  // Load the full route-stop table for stop-name matching and via lines.
  // Shared through the pane store so the stops pane and routes view reuse
  // the same array. Always revalidates on mount; the cached fetcher plus
  // the store guard make repeat loads cheap and render-free.
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
  }, [setRouteStopsAll])

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

  const usageByStopName = React.useMemo(
    () =>
      selectedRouteKey
        ? new Map<string, number>()
        : countRoutesByStopName(routeStopsAll, stopsById, lang),
    [routeStopsAll, stopsById, lang, selectedRouteKey]
  )

  const searchHits = React.useMemo(
    () =>
      searchRouteIndex(searchIndex, debouncedQuery, {
        operator: operators.length > 0 ? operators : null,
        lang,
        fuse,
        stopsById,
      }),
    [searchIndex, debouncedQuery, operators, lang, fuse, stopsById]
  )

  const { visibleCount, hasMore, sentinelRef, loadMore } = useInfiniteScroll({
    totalItems: searchHits.length,
    initialPageSize: 40,
    pageSize: 30,
  })
  const visibleHits = searchHits.slice(0, visibleCount)

  const handleOperatorChange = React.useCallback((codes: string[]) => {
    setOperators(codes)
  }, [])

  const handleClearSearch = React.useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
  }, [])

  const handleClearFilters = React.useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
    setOperators([])
  }, [])

  const variantsForRoute = React.useMemo(() => {
    if (!selectedRouteKey) return []
    const map = new Map<string, RouteVariant>()
    for (const r of routes) {
      if (
        r.route !== selectedRouteKey.route ||
        normalizeOperator(String(r.co ?? 'kmb')) !== selectedRouteKey.co ||
        String(r.region ?? '').trim() !== selectedRouteKey.region
      ) {
        continue
      }
      const gtfsId = String(r.gtfsId ?? '').trim()
      const region = String(r.region ?? '').trim()
      const key = gtfsId
        ? `${r.co}|${r.route}|${r.bound}|${r.serviceType}|${gtfsId}`
        : `${r.co}|${r.route}|${r.bound}|${r.serviceType}`
      if (map.has(key)) continue
      map.set(key, {
        key,
        co: String(r.co ?? 'kmb'),
        route: r.route,
        bound: r.bound,
        serviceType: r.serviceType,
        gtfsId,
        region,
        origin: r.origin,
        destination: r.destination,
      })
    }
    // Outbound (O, 去程) before inbound (I, 回程); normal timetable
    // (service type 1) before specials.
    return Array.from(map.values()).sort(compareRouteVariants)
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
      const currentGtfsId = String(currentVariant.gtfsId ?? '').trim()
      const allRouteStops = routeStopsAll.length > 0 ? routeStopsAll : await fetchKmbRouteStops()
      if (cancelled) return
      const filtered = allRouteStops
        .filter(
          (rs) =>
            rs.route === currentVariant.route &&
            normalizeOperator(rs.co) === co &&
            rs.bound === currentVariant.bound &&
            rs.serviceType === currentVariant.serviceType &&
            (currentGtfsId ? String(rs.gtfsId ?? '').trim() === currentGtfsId : true)
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
        filteredEtas[stopId] = (entries ?? []).filter((eta) => {
          if (variantBaseKey(eta) !== variantKey) return false
          // Same-number regions share the number filter: keep only the
          // selected region's gtfsId when the variant has one.
          if (!currentGtfsId) return true
          return String(eta.gtfsId ?? '').trim() === currentGtfsId
        })
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
  const routedGeometry = useKmbRouteGeometry(
    {
      variant: currentVariant,
      points: geometryPoints,
    },
    { stopsVariantKey }
  )
  const displayPath = routedGeometry ?? routePath

  const mapCenter = React.useMemo(() => {
    if (routePath.length) return routePath[Math.floor(routePath.length / 2)]
    return { lat: 22.3193, lng: 114.1694 }
  }, [routePath])

  const mapMarkers = React.useMemo(() => {
    const isCtbRoute = currentVariant ? normalizeOperator(currentVariant.co) === 'ctb' : false
    const activeCardKey =
      expandedStop && expandedStop.variantKey === currentVariant?.key ? expandedStop.cardKey : null
    return variantStops
      .map((rs) => {
        const stop = stopsById.get(rs.stopId)
        if (!stop) return null
        const cardKey = `${rs.stopId}:${rs.seq}`
        const fullName = pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
        const parsed = parseKmbStopNameCached(fullName, {
          isKmb: isKmbStop(stop),
          lang,
        })
        const ctb = isCtbRoute ? parseCtbStopNameCached(parsed.name) : null
        return {
          id: cardKey,
          lat: stop.lat,
          lng: stop.lng,
          title: pickCtbDisplayName(ctb?.name, parsed.name),
          selected: activeCardKey === cardKey,
        }
      })
      .filter(Boolean) as Array<{
      id: string
      lat: number
      lng: number
      title?: string
      selected?: boolean
    }>
  }, [variantStops, stopsById, lang, currentVariant, expandedStop])

  const mapPolylines = React.useMemo(() => {
    if (!currentVariant) return []
    return [{ id: currentVariant.key, path: displayPath }]
  }, [currentVariant, displayPath])

  const focusPoint = React.useMemo(() => {
    if (!expandedStop || expandedStop.variantKey !== currentVariant?.key) return null
    const match = variantStops.find((rs) => `${rs.stopId}:${rs.seq}` === expandedStop.cardKey)
    if (!match) return null
    const stop = stopsById.get(match.stopId)
    if (!stop) return null
    return { lat: stop.lat, lng: stop.lng, zoom: 15 }
  }, [expandedStop, variantStops, stopsById, currentVariant])

  const scrollStopCardIntoView = React.useCallback((cardKey: string) => {
    if (typeof document === 'undefined') return
    requestAnimationFrame(() => {
      document
        .getElementById(`kmb-route-stop-${cardKey}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  const handleToggleStop = React.useCallback(
    (cardKey: string) => {
      const variantKey = currentVariant?.key
      if (!variantKey) return
      setExpandedStop((prev) =>
        prev && prev.variantKey === variantKey && prev.cardKey === cardKey
          ? null
          : { variantKey, cardKey }
      )
    },
    [currentVariant]
  )

  const handleMapStopClick = React.useCallback(
    (id: string) => {
      const variantKey = currentVariant?.key
      if (!variantKey) return
      const directHit = variantStops.some((rs) => `${rs.stopId}:${rs.seq}` === id)
      const fallbackStop = directHit ? null : variantStops.find((rs) => rs.stopId === id)
      const match = directHit
        ? id
        : fallbackStop
          ? `${fallbackStop.stopId}:${fallbackStop.seq}`
          : null
      if (!match) return
      setExpandedStop((prev) =>
        prev && prev.variantKey === variantKey && prev.cardKey === match
          ? null
          : { variantKey, cardKey: match }
      )
      scrollStopCardIntoView(match)
    },
    [variantStops, scrollStopCardIntoView, currentVariant]
  )

  const expandedStopKey =
    expandedStop && expandedStop.variantKey === currentVariant?.key ? expandedStop.cardKey : null

  const onSaveRoute = () => {
    if (!currentVariant) return
    const gtfsId = String(currentVariant.gtfsId ?? '').trim()
    const region = String(currentVariant.region ?? '').trim()
    const item: FavoritesItem = {
      id: gtfsId
        ? `kmb:route:${currentVariant.co}:${currentVariant.route}:${currentVariant.bound}:${currentVariant.serviceType}:${gtfsId}`
        : `kmb:route:${currentVariant.co}:${currentVariant.route}:${currentVariant.bound}:${currentVariant.serviceType}`,
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
      gtfsId: gtfsId || undefined,
      region: region || undefined,
      origin: currentVariant.origin,
      destination: currentVariant.destination,
    }
    addFavorite(item)
  }

  const hasActiveFilters = query.trim() !== '' || operators.length > 0
  const isRouteSelected = selectedRouteKey !== null

  // Mobile is its own layout, not the desktop overlay restacked. Search
  // is a single card with no map: an empty-region map earns none of the
  // screen. Drilldown is a full-bleed column filling the viewport height:
  // compact header, map, then the stop list in its own scroll region.
  // Nothing else on the page scrolls.
  if (!isDesktop) {
    return (
      <div className="space-y-3">
        {!isRouteSelected ? (
          <div className="card-m3 p-4">
            <div className="m3-title-md mb-3">{t('common.routes')}</div>
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
                value={operators}
                onChange={handleOperatorChange}
                lang={lang}
              />
            </div>
            <div className="mt-3">
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

              {!loading && !error && searchHits.length === 0 ? (
                <EmptyState
                  title={t('common.noResults')}
                  hint={
                    debouncedQuery.trim() !== ''
                      ? tWithParams('kmb.noRoutesMatch', { query: debouncedQuery.trim() })
                      : undefined
                  }
                  action={
                    hasActiveFilters ? (
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
                !loading &&
                !error && (
                  <div className="space-y-3 pb-1">
                    <div className="text-on-surface-variant m3-label-md" role="status">
                      {tWithParams('kmb.routesFound', { count: searchHits.length })}
                    </div>
                    <div className="space-y-3">
                      {visibleHits.map((hit, idx) => (
                        <RouteResultCard
                          key={hit.entry.key}
                          entry={hit.entry}
                          stopsById={stopsById}
                          lang={lang}
                          index={idx}
                          matchReason={hit.matchReason}
                          usageByStopName={usageByStopName}
                          onSelect={() =>
                            setSelectedRouteKey({
                              co: hit.entry.co,
                              route: hit.entry.route,
                              region: hit.entry.region,
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
              )}
            </div>
          </div>
        ) : (
          // Compact header, full-width map, stops in their own scroll: the
          // column fills the viewport height and only the stop list scrolls.
          <div className="bg-surface-container-lowest relative flex h-[calc(100dvh-10rem)] min-h-[480px] flex-col overflow-hidden rounded-3xl border border-[var(--outline-variant)]/15 shadow-sm">
            <div className="bg-surface-container-lowest z-10 shrink-0 border-b border-[var(--outline-variant)]/15 px-3 pt-2 pb-2">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRouteKey(null)
                    setSelectedVariant(null)
                  }}
                  aria-label={t('common.back')}
                  title={t('common.back')}
                  className="bg-secondary-container text-on-secondary-container ui-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <RouteBadge
                  route={selectedRouteKey.route}
                  company={selectedRouteKey.co}
                  size="lg"
                />
                {currentVariant && (
                  <Marquee
                    title={`${pickLang(currentVariant.origin, lang)} ↔ ${pickLang(currentVariant.destination, lang)}`}
                    className="text-on-surface m3-title-md min-w-0 flex-1 font-medium"
                  >
                    {formatKmbRouteEndpointName(pickLang(currentVariant.origin, lang), {
                      co: currentVariant.co,
                      lang,
                    })}{' '}
                    ↔{' '}
                    {formatKmbRouteEndpointName(pickLang(currentVariant.destination, lang), {
                      co: currentVariant.co,
                      lang,
                    })}
                  </Marquee>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      aria-label={t('common.routeDetails')}
                      title={t('common.routeDetails')}
                      className="text-on-surface-variant hover:text-on-surface ui-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Info className="h-5 w-5" aria-hidden />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-surface-container-low max-h-[85dvh] gap-0 overflow-y-auto rounded-3xl border-0 p-0">
                    <div className="space-y-4 p-5">
                      <DialogHeader className="text-left">
                        <DialogTitle className="text-on-surface m3-title-lg">
                          {t('common.routeDetails')}
                        </DialogTitle>
                      </DialogHeader>
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
                              <span>
                                {v.bound === 'I'
                                  ? t('common.inbound')
                                  : v.bound === 'O'
                                    ? t('common.outbound')
                                    : v.bound || null}
                              </span>
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
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <RouteScheduleSection
                              variantKey={`${normalizeOperator(currentVariant.co)}|${currentVariant.route.toUpperCase()}|${currentVariant.bound}|${currentVariant.serviceType}`}
                              lang={lang}
                            />
                          </div>
                          <FavoriteSaveButton onSave={onSaveRoute} label={t('common.save')} />
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              {variantsForRoute.length > 1 && (
                <div
                  className="mt-1.5 flex gap-2 overflow-x-auto pb-1"
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
                      <span>
                        {v.bound === 'I'
                          ? t('common.inbound')
                          : v.bound === 'O'
                            ? t('common.outbound')
                            : v.bound || null}
                      </span>
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
            </div>

            <div className="relative h-56 shrink-0 sm:h-64">
              <TransitMap
                lang={lang}
                center={mapCenter}
                markers={mapMarkers}
                polylines={mapPolylines}
                zoom={13}
                fitKey={currentVariant?.key ?? null}
                focusPoint={focusPoint}
                onMarkerClick={handleMapStopClick}
                ariaLabel={t('common.mapInteractive')}
                className="h-full w-full rounded-none"
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 pb-3">
              <div className="m3-title-md mb-2 flex shrink-0 items-center gap-2 px-1">
                <Clock className="h-5 w-5" />
                {t('kmb.routeStops')}
                {variantStops.length > 0 && (
                  <span className="text-on-surface-variant m3-body-md ml-auto">
                    {variantStops.length}
                  </span>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pb-1">
                {variantStops.length === 0 ? (
                  <ResultsSkeleton />
                ) : (
                  currentVariant && (
                    <KmbRouteStopList
                      listKey={currentVariant.key}
                      currentVariant={currentVariant}
                      variantStops={variantStops}
                      stopsById={stopsById}
                      etas={etas}
                      lang={lang}
                      onSelectStopGroup={onSelectStopGroup}
                      expandedKey={expandedStopKey}
                      onToggleStop={handleToggleStop}
                    />
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest relative overflow-hidden rounded-3xl border border-[var(--outline-variant)]/15 shadow-sm">
      <div className="relative h-[calc(100dvh-10rem)] max-h-[880px] min-h-[640px]">
        <TransitMap
          lang={lang}
          center={mapCenter}
          markers={isRouteSelected ? mapMarkers : []}
          polylines={isRouteSelected ? mapPolylines : []}
          zoom={isRouteSelected ? 13 : 11}
          fitKey={currentVariant?.key ?? null}
          focusPoint={focusPoint}
          onMarkerClick={handleMapStopClick}
          ariaLabel={t('common.mapInteractive')}
          className="h-full w-full rounded-none"
        />
      </div>

      <div className="absolute top-4 bottom-4 left-4 z-10 w-[400px] max-w-[calc(100%-2rem)]">
        <div className="card-m3 flex h-full flex-col overflow-hidden shadow-xl">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            {!isRouteSelected ? (
              <>
                <div className="m3-title-md mb-3">{t('common.routes')}</div>
                <div>
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
                      value={operators}
                      onChange={handleOperatorChange}
                      lang={lang}
                    />
                  </div>
                </div>

                <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
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

                  {!loading && !error && searchHits.length === 0 ? (
                    <EmptyState
                      title={t('common.noResults')}
                      hint={
                        debouncedQuery.trim() !== ''
                          ? tWithParams('kmb.noRoutesMatch', { query: debouncedQuery.trim() })
                          : undefined
                      }
                      action={
                        hasActiveFilters ? (
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
                    !loading &&
                    !error && (
                      <div className="space-y-3 pb-1">
                        <div className="text-on-surface-variant m3-label-md" role="status">
                          {tWithParams('kmb.routesFound', { count: searchHits.length })}
                        </div>
                        <div className="space-y-3">
                          {visibleHits.map((hit, idx) => (
                            <RouteResultCard
                              key={hit.entry.key}
                              entry={hit.entry}
                              stopsById={stopsById}
                              lang={lang}
                              index={idx}
                              matchReason={hit.matchReason}
                              usageByStopName={usageByStopName}
                              onSelect={() =>
                                setSelectedRouteKey({
                                  co: hit.entry.co,
                                  route: hit.entry.route,
                                  region: hit.entry.region,
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
                  )}
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <RouteDrilldown
                  lang={lang}
                  onBack={() => {
                    setSelectedRouteKey(null)
                    setSelectedVariant(null)
                  }}
                  title={
                    <span className="flex min-w-0 items-center gap-2">
                      <RouteBadge
                        route={selectedRouteKey.route}
                        company={selectedRouteKey.co}
                        size="lg"
                      />
                      {currentVariant && (
                        <Marquee
                          title={`${pickLang(currentVariant.origin, lang)} → ${pickLang(currentVariant.destination, lang)}`}
                          className="text-on-surface m3-title-md min-w-0 flex-1 font-medium"
                        >
                          {formatKmbRouteEndpointName(pickLang(currentVariant.origin, lang), {
                            co: currentVariant.co,
                            lang,
                          })}{' '}
                          →{' '}
                          {formatKmbRouteEndpointName(pickLang(currentVariant.destination, lang), {
                            co: currentVariant.co,
                            lang,
                          })}
                        </Marquee>
                      )}
                      <span className="text-on-surface-variant m3-label-md shrink-0 uppercase">
                        {selectedRouteKey.co}
                      </span>
                    </span>
                  }
                >
                  {currentVariant && (
                    <button
                      type="button"
                      onClick={() => setControlsOpen((v) => !v)}
                      aria-expanded={controlsOpen}
                      className="text-on-surface-variant hover:text-on-surface ui-press inline-flex min-h-[36px] items-center gap-1.5 self-start rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span className="m3-label-lg">{t('common.routeDetails')}</span>
                      {!controlsOpen && (
                        <span className="m3-label-md max-w-44 truncate font-normal">
                          {formatKmbRouteEndpointName(pickLang(currentVariant.destination, lang), {
                            co: currentVariant.co,
                            lang,
                          })}
                        </span>
                      )}
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          !controlsOpen && '-rotate-90'
                        )}
                        aria-hidden
                      />
                    </button>
                  )}

                  {controlsOpen && (
                    <>
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
                              <span>
                                {v.bound === 'I'
                                  ? t('common.inbound')
                                  : v.bound === 'O'
                                    ? t('common.outbound')
                                    : v.bound || null}
                              </span>
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
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <RouteScheduleSection
                              variantKey={`${normalizeOperator(currentVariant.co)}|${currentVariant.route.toUpperCase()}|${currentVariant.bound}|${currentVariant.serviceType}`}
                              lang={lang}
                            />
                          </div>
                          <FavoriteSaveButton onSave={onSaveRoute} label={t('common.save')} />
                        </div>
                      )}
                    </>
                  )}
                </RouteDrilldown>

                <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="m3-title-md mb-3 flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {t('kmb.routeStops')}
                    {variantStops.length > 0 && (
                      <span className="text-on-surface-variant m3-body-md ml-auto">
                        {variantStops.length}
                      </span>
                    )}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto pb-1">
                    {variantStops.length === 0 ? (
                      <ResultsSkeleton />
                    ) : (
                      currentVariant && (
                        <KmbRouteStopList
                          listKey={currentVariant.key}
                          currentVariant={currentVariant}
                          variantStops={variantStops}
                          stopsById={stopsById}
                          etas={etas}
                          lang={lang}
                          onSelectStopGroup={onSelectStopGroup}
                          expandedKey={expandedStopKey}
                          onToggleStop={handleToggleStop}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
