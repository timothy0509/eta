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
import { RouteStopCard } from '@/components/eta/route-stop-timeline'
import { staggerClassForIndex } from '@/components/eta/stagger-list'
import { TickingKmbMinutes, TickingSoonestPill } from '@/components/eta/ticking-eta'
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
import { routeVariantKey } from '@/lib/eta/eta-db-index'
import { getFaresBySeq, groupIntoFareSections } from '@/lib/eta/kmb-fare-sections'
import {
  getTdStopPickDrop,
  getTdVariantInfo,
  resolveTdFullFare,
  tdVariantTagKeys,
  tdVariantTags,
  type TdPickDrop,
} from '@/lib/eta/td-bus'
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
  countRoutesByStopName,
  loadRouteFuseIndex,
  operatorCounts,
  searchRouteIndex,
  type RouteFuseInstance,
} from '@/lib/eta/route-search'
import { getRoutedGeometry } from '@/lib/eta/routing'
import { resolveTdInstantPath } from '@/lib/eta/direct/td-shapes'
import { usePaneStore } from '@/lib/eta/pane-store'
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

/**
 * Expandable KMB stop card. Collapsed header shows the stop plus the
 * soonest bus; expanding lists up to three departures. Matches the
 * stop-mode route card layout.
 */
function KmbRouteStopCard({
  stopEtas,
  name,
  stopCode,
  seq,
  pickDrop,
  lang,
  expanded,
  onToggle,
  selectLabel,
  onSelect,
}: {
  stopEtas: KmbEtaEntryWithLeg[]
  name: string
  stopCode: string | null
  seq: number
  pickDrop: TdPickDrop | null
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
  const { t: cardT } = useTranslations(lang)

  const panel =
    visible.length === 0 ? (
      <div className="text-on-surface-variant m3-body-md flex items-center gap-2">
        {cardT('common.noScheduledBuses')}
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
      badge={<PickDropBadge pickDrop={pickDrop} lang={lang} />}
      eta={<TickingSoonestPill etas={stopEtas} lang={lang} />}
      panel={panel}
      toggleLabel={name}
      selectLabel={selectLabel}
      onSelect={onSelect}
    />
  )
}

/**
 * Boarding/alighting badge from the TD `stopPickDrop` field: 1 is
 * drop-off only, 2 is pick-up only. Stops open both ways (3) and unknown
 * stops render no badge; that is the common case and stays quiet.
 */
function PickDropBadge({ pickDrop, lang }: { pickDrop: TdPickDrop | null; lang: UiLanguage }) {
  const { t } = useTranslations(lang)
  if (pickDrop !== 1 && pickDrop !== 2) return null
  return (
    <span className="bg-surface-container-high text-on-surface-variant m3-label-sm inline-flex shrink-0 items-center rounded-full px-2 py-0.5">
      {pickDrop === 1 ? t('kmb.dropOffOnly') : t('kmb.pickUpOnly')}
    </span>
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
}: {
  listKey: string
  currentVariant: RouteVariant
  variantStops: KmbRouteStopLite[]
  stopsById: Map<string, KmbStopSearchItem>
  etas: Record<string, KmbEtaEntryWithLeg[]>
  lang: UiLanguage
  onSelectStopGroup?: (payload: { stopIds: string[]; title: string; route: string }) => void
}) {
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null)
  const variantKey = routeVariantKey({
    co: currentVariant.co as Company,
    route: currentVariant.route,
    bound: currentVariant.bound,
    serviceType: currentVariant.serviceType,
  })
  const [faresBySeq, setFaresBySeq] = React.useState<Record<number, number>>({})

  React.useEffect(() => {
    let cancelled = false
    getEtaDbIndexes()
      .then(({ routeVariantIndex }) => {
        if (cancelled) return
        const entry = routeVariantIndex.get(variantKey)
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

  const tdVariant = React.useMemo(
    () => ({
      co: currentVariant.co,
      route: currentVariant.route,
      bound: currentVariant.bound,
      serviceType: currentVariant.serviceType,
    }),
    [currentVariant.co, currentVariant.route, currentVariant.bound, currentVariant.serviceType]
  )

  // TD full-journey fare fallback: when the hk-bus-eta per-section lookup
  // has nothing for this variant, every stop shares the scheduled full
  // fare and the list carries a full-journey caption.
  const tdFullFare = React.useMemo(() => resolveTdFullFare(tdVariant), [tdVariant])
  const effectiveFaresBySeq = React.useMemo(() => {
    if (Object.keys(faresBySeq).length > 0) return faresBySeq
    if (tdFullFare === null) return faresBySeq
    const filled: Record<number, number> = {}
    for (const rs of variantStops) filled[rs.seq] = tdFullFare
    return filled
  }, [faresBySeq, tdFullFare, variantStops])
  const usingFullFareFallback =
    Object.keys(faresBySeq).length === 0 && tdFullFare !== null && variantStops.length > 0

  // Only CTB route stops split "{name}, {street}". Other operators keep
  // the existing stop-name parsing untouched.
  const isCtbRoute = normalizeOperator(currentVariant.co) === 'ctb'

  const sections = React.useMemo(
    () => groupIntoFareSections(variantStops, (rs) => effectiveFaresBySeq[rs.seq] ?? null),
    [variantStops, effectiveFaresBySeq]
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
        name={pickCtbDisplayName(ctb?.name, parsed.name)}
        stopCode={parsed.platform ?? parsed.stopCode}
        seq={seq}
        pickDrop={getTdStopPickDrop(tdVariant, rs.seq)}
        lang={lang}
        expanded={expandedKey === cardKey}
        onToggle={() => setExpandedKey((prev) => (prev === cardKey ? null : cardKey))}
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
      {usingFullFareFallback ? (
        <p className="text-on-surface-variant m3-label-md" role="note">
          {t('kmb.fullJourneyFare')}
        </p>
      ) : null}
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
              className={cn('ui-cv-row min-w-0 py-1', staggerClassForIndex(index))}
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
                    className={cn(
                      'ui-cv-row',
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

/**
 * Instant route shape from Transport Department stop coordinates. The TD
 * datasets already order stops by stopSeq per routeSeq direction, so the
 * selected shape draws with no per-route fetch once the dataset is cached.
 * The shared dataset download is never aborted by one view unmounting;
 * late results are dropped by the cancelled flag instead.
 */
function useTdInstantPath(variant: RouteVariant | null, points: GeoPoint[]): GeoPoint[] | null {
  const [result, setResult] = React.useState<{
    variantKey: string
    path: GeoPoint[]
  } | null>(null)

  React.useEffect(() => {
    if (!variant || points.length < 2) return
    let cancelled = false
    const variantKey = variant.key
    const dataset = normalizeOperator(variant.co) === 'gmb' ? 'gmb' : 'bus'
    resolveTdInstantPath({
      dataset,
      route: variant.route,
      co: variant.co,
      variantPoints: points,
    })
      .then((shape) => {
        if (!cancelled && shape) setResult({ variantKey, path: shape.points })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [variant, points])

  return result && variant && result.variantKey === variant.key ? result.path : null
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

  const currentTdInfo = React.useMemo(
    () =>
      currentVariant
        ? getTdVariantInfo({
            co: currentVariant.co,
            route: currentVariant.route,
            bound: currentVariant.bound,
            serviceType: currentVariant.serviceType,
          })
        : null,
    [currentVariant]
  )

  // TD service tags per variant so variants that look identical (same
  // direction and destination) still read apart, e.g. night vs day.
  const tdTagsByVariantKey = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const v of variantsForRoute) {
      const info = getTdVariantInfo({
        co: v.co,
        route: v.route,
        bound: v.bound,
        serviceType: v.serviceType,
      })
      if (!info) continue
      const tags = tdVariantTagKeys(tdVariantTags(info.serviceMode, info.specialType))
      if (tags.length) map.set(v.key, tags)
    }
    return map
  }, [variantsForRoute])

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
  // GMB routes have no OSRM upgrade today, so the TD shape is their whole
  // map. Other operators keep the TD stop-sequence shape as the persistent
  // line: OSRM routes buses like cars and regularly draws the wrong roads,
  // while the TD shape follows the true stop order. OSRM geometry stays as
  // the fallback for variants with no TD match.
  const isGmbRoute = currentVariant ? normalizeOperator(currentVariant.co) === 'gmb' : false
  const routedGeometry = useKmbRouteGeometry(
    isGmbRoute ? null : (currentVariant?.key ?? null),
    geometryPoints
  )
  const tdInstantPath = useTdInstantPath(currentVariant, geometryPoints)
  // Straight segments between stops cut corners versus road geometry, but
  // the line always visits the stops in travel order.
  const displayPath = tdInstantPath ?? routedGeometry ?? routePath

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
                    usageByStopName={usageByStopName}
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
                    {(tdTagsByVariantKey.get(v.key) ?? []).map((tagKey) => (
                      <span key={tagKey} className="m3-label-sm opacity-80">
                        · {t(tagKey)}
                      </span>
                    ))}
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
                  {currentTdInfo?.journeyTimeMinutes != null ? (
                    <span className="m3-label-md ml-2 whitespace-nowrap opacity-80">
                      ·{' '}
                      {tWithParams('kmb.journeyTime', {
                        count: currentTdInfo.journeyTimeMinutes,
                      })}
                    </span>
                  ) : null}
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
              <KmbRouteStopList
                listKey={currentVariant.key}
                currentVariant={currentVariant}
                variantStops={variantStops}
                stopsById={stopsById}
                etas={etas}
                lang={lang}
                onSelectStopGroup={onSelectStopGroup}
              />
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
