'use client'

import * as React from 'react'
import { ChevronDown, Info, RefreshCw, TramFront, TriangleAlert } from 'lucide-react'

import { EtaValue, LivePulse } from '@/components/m3/motion'
import { EmptyState } from '@/components/eta/empty-state'
import { ExpandableEtaRow } from '@/components/eta/expandable-eta-row'
import { staggerClassForIndex, StaggerList } from '@/components/eta/stagger-list'
import { ResultsHeader } from '@/components/eta/results-header'
import { Marquee } from '@/components/ui/marquee'
import {
  formatLrtEtaLabel,
  getLrtDisplayTime,
  groupLrtEntriesByRoute,
  isLrtArrivingText,
  type LrtRouteGroup,
  type LrtRouteListEntry,
} from '@/lib/eta/lrt-eta-groups'
import { getLineColor } from '@/lib/eta/line-colors'
import { useTranslations } from '@/lib/eta/i18n'
import { pickLangZh } from '@/lib/eta/pick-lang'
import type { LrtScheduleResponse } from '@/lib/eta/direct/lrt'
import type { UiLanguage } from '@/lib/eta/types'
import { getReadableForeground } from '@/lib/ui/color'
import { cn } from '@/lib/utils'

function formatTrainLength(
  length: number,
  tWithParams: (key: string, params: Record<string, string | number>) => string
) {
  return tWithParams('lrt.trainCars', { count: length })
}

function formatArrivalDeparture(code: string, t: (key: string) => string) {
  return code === 'A' ? t('lrt.arrivingLabel') : t('lrt.departingLabel')
}

function isEntryArriving(entry: LrtRouteListEntry, lang: UiLanguage): boolean {
  return entry.arrival_departure === 'A' || isLrtArrivingText(getLrtDisplayTime(entry, lang))
}

function formatNoScheduledText(t: (key: string) => string) {
  return t('lrt.noScheduledTrains')
}

/** Single route group card. Mirrors the bus RouteDepartureRow. */
const LrtRouteDepartureRow = React.memo(function LrtRouteDepartureRow({
  group,
  lang,
  staggerClass,
  expanded,
  onToggleExpand,
}: {
  group: LrtRouteGroup
  lang: UiLanguage
  staggerClass?: string
  expanded: boolean
  onToggleExpand: () => void
}) {
  const { t, tWithParams } = useTranslations(lang)
  const { routeNo, items, hasEta } = group
  const first = items[0]
  const routeColor = getLineColor(routeNo)
  const dest = pickLangZh({ en: group.destEn, zh: group.destCh }, lang)

  const expandable = hasEta && items.length >= 1
  const isExpanded = expandable && expanded

  const firstArriving = first ? isEntryArriving(first, lang) : false
  const firstTimeText = first ? getLrtDisplayTime(first, lang) : '—'

  const firstEtaNode = firstArriving ? (
    <span className="bg-primary-container text-on-primary-container m3-label-md sm:m3-label-lg font-tabular flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold sm:px-2.5">
      <LivePulse />
      <EtaValue key={firstTimeText} value={firstTimeText} />
    </span>
  ) : (
    <span className="text-on-surface font-tabular shrink-0 text-base font-semibold tracking-tight sm:text-xl">
      <EtaValue key={firstTimeText} value={firstTimeText} />
    </span>
  )

  const trainInfoNode = first ? (
    <div className="text-on-surface-variant m3-label-sm flex min-w-0 items-center gap-1.5 overflow-hidden">
      <span className="shrink-0">
        {formatArrivalDeparture(first.arrival_departure, t)} ·{' '}
        {formatTrainLength(first.train_length, tWithParams)}
      </span>
      {first.stop ? <span className="text-error shrink-0">{t('lrt.stopped')}</span> : null}
    </div>
  ) : null

  const routeHeader = ({ showEta, showSubtitle }: { showEta: boolean; showSubtitle: boolean }) => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            'ui-pop inline-flex shrink-0 items-center justify-center rounded-lg border px-3 py-1 font-sans text-base font-bold whitespace-nowrap',
            getReadableForeground(routeColor)
          )}
          style={{
            backgroundColor: routeColor,
            borderColor: routeColor === '#FFFFFF' ? 'var(--outline-variant)' : routeColor,
          }}
        >
          {routeNo}
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <Marquee
            title={dest || undefined}
            className="text-on-surface m3-body-md min-w-0 flex-1 font-medium"
          >
            {dest || t('common.route')}
          </Marquee>
          {trainInfoNode ? (
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
                  {trainInfoNode}
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

  const visibleItems = items.slice(0, 3)

  const etaTile = (entry: LrtRouteListEntry, entryIdx: number) => {
    const timeText = getLrtDisplayTime(entry, lang)
    const arriving = isEntryArriving(entry, lang)
    const isFirst = entryIdx === 0

    if (isFirst) {
      return (
        <div
          key={`${group.key}:${entryIdx}`}
          className="bg-primary-container text-on-primary-container w-1/3 min-w-0 rounded-xl px-2 py-1.5 text-center sm:px-3 sm:py-2"
        >
          <div className="m3-label-md opacity-80">{formatLrtEtaLabel(1, lang)}</div>
          <div className="font-tabular mt-0.5 flex items-center justify-center gap-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
            {arriving ? <LivePulse /> : null}
            <EtaValue key={timeText} value={timeText} />
          </div>
          <div className="m3-label-md mt-1 opacity-80">
            {formatTrainLength(entry.train_length, tWithParams)}
          </div>
          {entry.stop ? (
            <div className="m3-label-md mt-0.5 opacity-80">{t('lrt.stopped')}</div>
          ) : null}
        </div>
      )
    }

    return (
      <div
        key={`${group.key}:${entryIdx}`}
        className="bg-surface-container-high w-1/3 min-w-0 rounded-lg px-2 py-1.5 text-center sm:px-2.5"
      >
        <div className="text-on-surface-variant m3-label-md">
          {formatLrtEtaLabel(entryIdx + 1, lang)}
        </div>
        <div className="text-on-surface font-tabular mt-0.5 text-base font-semibold tracking-tight sm:text-lg">
          <EtaValue key={timeText} value={timeText} />
        </div>
        <div className="text-on-surface-variant m3-label-md mt-0.5">
          {formatTrainLength(entry.train_length, tWithParams)}
        </div>
        {entry.stop ? (
          <div className="text-error m3-label-md mt-0.5">{t('lrt.stopped')}</div>
        ) : null}
      </div>
    )
  }

  const etaPanel = (
    <div className="space-y-2">
      <div className="flex justify-center gap-1.5 pb-0.5 sm:gap-2">
        {visibleItems.map((entry, entryIdx) => etaTile(entry, entryIdx))}
      </div>
      <div className="flex min-h-8 min-w-0 flex-1 items-center">{trainInfoNode}</div>
    </div>
  )

  if (!hasEta) {
    return (
      <div
        className={cn(
          'bg-surface-container relative overflow-hidden rounded-2xl border border-transparent py-3.5 pr-3 pl-0 opacity-70',
          staggerClass
        )}
      >
        <span
          className="absolute inset-y-2.5 left-0 w-1 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
          style={{ backgroundColor: routeColor }}
          aria-hidden
        />
        <div className="space-y-2.5 pl-4">
          {routeHeader({ showEta: false, showSubtitle: true })}
          <div className="text-on-surface-variant m3-body-md flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            {formatNoScheduledText(t)}
          </div>
        </div>
      </div>
    )
  }

  // Non-expandable rows happen only for groups without ETAs, handled above.
  // This guard exists so TypeScript narrows onToggleExpand below.
  if (!expandable) return null

  return (
    <ExpandableEtaRow
      expanded={isExpanded}
      onToggle={onToggleExpand}
      color={routeColor}
      className={staggerClass}
      panel={etaPanel}
      toggleLabel={`${routeNo} ${dest ?? ''}`.trim()}
    >
      {routeHeader({ showEta: !isExpanded, showSubtitle: !isExpanded })}
    </ExpandableEtaRow>
  )
})

/** Platform section. Mirrors the bus stop section separation. */
const LrtPlatformSection = React.memo(function LrtPlatformSection({
  platformId,
  groups,
  lang,
  isFirst,
  expandedKey,
  onToggleExpand,
}: {
  platformId: number
  groups: LrtRouteGroup[]
  lang: UiLanguage
  isFirst?: boolean
  expandedKey?: string | null
  onToggleExpand?: (key: string) => void
}) {
  const { t, tWithParams } = useTranslations(lang)

  return (
    <div className={cn('ui-cv-auto', !isFirst && 'border-outline-variant mt-5 border-t pt-5')}>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-on-surface m3-title-md min-w-0 truncate">
          {tWithParams('lrt.platform', { id: platformId })}
        </h3>
        <span className="text-on-surface-variant m3-label-md shrink-0">
          {groups.length} {t('lrt.routes')}
        </span>
      </div>

      {groups.length === 0 ? (
        <EmptyState title={t('lrt.emptyPlatform')} className="py-2" />
      ) : (
        <div className="space-y-2">
          {groups.map((g, idx) => (
            <LrtRouteDepartureRow
              key={g.key}
              group={g}
              lang={lang}
              staggerClass={isFirst ? staggerClassForIndex(idx) : ''}
              expanded={expandedKey === `${platformId}:${g.key}`}
              onToggleExpand={() => onToggleExpand?.(`${platformId}:${g.key}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
})

type Props = {
  title: string
  lang: UiLanguage
  stationId?: string
  schedule: LrtScheduleResponse | null
  hasStation?: boolean
  error?: string | null
  stale?: boolean
  lastUpdatedAt?: number | null
  onRefresh: () => void
  loading?: boolean
}

export const LrtResults = React.memo(function LrtResults({
  title,
  lang,
  stationId,
  schedule,
  hasStation,
  error,
  stale,
  lastUpdatedAt,
  onRefresh,
  loading,
}: Props) {
  const { t } = useTranslations(lang)
  const listSignature = React.useMemo(() => `lrt:${stationId ?? title}`, [stationId, title])

  const [expandedKey, setExpandedKey] = React.useState<string | null>(null)
  const onToggleExpand = React.useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key))
  }, [])

  // A stale key would keep a same-named route expanded in the wrong station.
  React.useEffect(() => {
    setExpandedKey(null)
  }, [stationId, title])

  const platformGroups = React.useMemo(() => {
    if (!schedule) return []
    return (schedule.platform_list ?? []).map((p) => ({
      platform_id: p.platform_id,
      groups: groupLrtEntriesByRoute(p.route_list ?? [], lang),
    }))
  }, [schedule, lang])

  return (
    <div>
      <ResultsHeader
        lang={lang}
        mode="lrt"
        title={title}
        icon={<TramFront className="h-3.5 w-3.5 shrink-0" />}
        subtitle={t('lrt.title')}
        lastUpdatedAt={lastUpdatedAt}
        stale={stale}
        loading={loading}
        onRefresh={onRefresh}
      />

      {/* Key covers only the list so the header stays mounted on refresh. */}
      <div key={listSignature}>
        {error ? (
          <EmptyState
            icon={TriangleAlert}
            title={t('errors.updateFailedGeneric')}
            hint={error}
            action={
              <button
                type="button"
                onClick={onRefresh}
                className="bg-primary text-on-primary m3-label-lg ui-press mt-2 inline-flex min-h-[44px] items-center rounded-full px-5 py-2 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
              >
                {t('common.tryAgain')}
              </button>
            }
          />
        ) : null}
        {loading && !schedule ? (
          <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
            <RefreshCw className="ui-spin h-4 w-4" />
            {t('lrt.loadingTrains')}
          </div>
        ) : !schedule ? (
          !hasStation ? (
            <EmptyState title={t('lrt.selectStation')} />
          ) : !error ? (
            <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
              <RefreshCw className="ui-spin h-4 w-4" />
              {t('lrt.loadingTrains')}
            </div>
          ) : null
        ) : (schedule.platform_list ?? []).length === 0 ? (
          <EmptyState title={t('lrt.emptyPlatform')} />
        ) : (
          <>
            <div className="text-on-surface-variant m3-label-md mb-5 flex items-center justify-between gap-2">
              <span>{t('lrt.systemTime')}</span>
              <span className="font-tabular">{schedule.system_time ?? ''}</span>
            </div>

            <StaggerList className="space-y-0">
              {platformGroups.map((p, idx) => (
                <LrtPlatformSection
                  key={p.platform_id}
                  platformId={p.platform_id}
                  groups={p.groups}
                  lang={lang}
                  isFirst={idx === 0}
                  expandedKey={expandedKey}
                  onToggleExpand={onToggleExpand}
                />
              ))}
            </StaggerList>
          </>
        )}
      </div>
    </div>
  )
})
