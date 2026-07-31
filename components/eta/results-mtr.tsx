'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Info, RefreshCw, TrainFront } from 'lucide-react'

import { LivePulse } from '@/components/m3/motion'
import { Marquee } from '@/components/ui/marquee'
import { findMtrStationBySta } from '@/lib/data/mtr-stations'
import { getLineColor, getMtrLineName } from '@/lib/eta/line-colors'
import { formatUiTime } from '@/lib/eta/format'
import { formatRelativeAgeLabel, isStaleByAge } from '@/lib/eta/stale'
import type { MtrScheduleResponse, MtrTrainEntry } from '@/lib/eta/mtr'
import type { UiLanguage } from '@/lib/eta/types'
import { getReadableForeground } from '@/lib/ui/color'
import { cn } from '@/lib/utils'
import { ExpandableEtaRow } from '@/components/eta/expandable-eta-row'

type Props = {
  title: string
  lang: UiLanguage
  schedule: MtrScheduleResponse | null
  error?: string | null
  stale?: boolean
  lastUpdatedAt?: number | null
  onRefresh: () => void
  loading?: boolean
}

type MtrDirection = 'UP' | 'DOWN'

// Stations where “via Racecourse” is relevant, by direction.
// These rules are intentionally explicit (do not infer via station ordering).
const EAL_VIA_RACECOURSE_BY_DIR: Record<MtrDirection, ReadonlySet<string>> = {
  UP: new Set(['ADM', 'EXC', 'HUH', 'MKK', 'KOT', 'TAW', 'SHT']),
  DOWN: new Set(['LMC', 'LOW', 'SHS', 'FAN', 'TWO', 'TAP', 'UNI']),
}

/**
 * Determine if we should show “via Racecourse” for a train.
 * Only show when:
 * 1. Line is EAL
 * 2. Train's route is "RAC"
 * 3. The current station/direction pair makes it relevant
 *
 * Never show at Fo Tan (FOT) or Racecourse (RAC).
 */
function shouldShowViaRacecourse(params: {
  line: string
  currentSta: string
  dir: MtrDirection
  route: string | undefined
}): boolean {
  if (params.line !== 'EAL') return false
  if (params.route !== 'RAC') return false

  // Explicit exceptions
  if (params.currentSta === 'FOT' || params.currentSta === 'RAC') return false

  return EAL_VIA_RACECOURSE_BY_DIR[params.dir].has(params.currentSta)
}

function formatDest(dest: unknown, lang: UiLanguage) {
  const raw = String(dest ?? '')
  if (!raw) return ''
  const station = findMtrStationBySta(raw)
  if (!station) return raw
  return lang === 'en' ? station.nameEn : station.nameTc
}

function formatDestWithRacecourse(dest: unknown, lang: UiLanguage, showViaRacecourse: boolean) {
  const destName = formatDest(dest, lang)
  if (!showViaRacecourse) return destName

  const suffix = lang === 'en' ? ' · Via Racecourse' : ' · 經馬場'
  return `${destName}${suffix}`
}

function formatMinutes(ttnt: unknown, lang: UiLanguage) {
  const raw = String(ttnt ?? '').trim()
  if (!raw) return { text: '—', arriving: false }
  const minutes = Number(raw)
  if (Number.isNaN(minutes)) return { text: raw, arriving: false }
  if (minutes <= 0)
    return {
      text: lang === 'en' ? 'Arriving' : '即將到達',
      arriving: true,
    }
  return {
    text: lang === 'en' ? `${minutes} min` : `${minutes} 分`,
    arriving: false,
  }
}

function formatPlatform(plat: unknown) {
  const raw = String(plat ?? '').trim()
  if (!raw) return ''
  return raw
}

type MtrLineCardProps = {
  payload: {
    UP?: MtrTrainEntry[]
    DOWN?: MtrTrainEntry[]
  }
  line: string
  sta: string
  lang: UiLanguage
  lineColor?: string
  upLabel: string
  downLabel: string
  expanded: boolean
  onToggle: () => void
  staggerClass?: string
}

function MtrLineCard({
  payload,
  line,
  sta,
  lang,
  lineColor,
  upLabel,
  downLabel,
  expanded,
  onToggle,
  staggerClass,
}: MtrLineCardProps) {
  const upTrains = payload.UP ?? []
  const downTrains = payload.DOWN ?? []
  const totalTrains = upTrains.length + downTrains.length
  const expandable = totalTrains > 1

  const computeUniqueDestEtas = React.useCallback(
    (trains: MtrTrainEntry[], dir: MtrDirection) => {
      const seenDests = new Set<string>()
      return (trains ?? [])
        .map((train) => {
          const route = String((train as { route?: unknown }).route ?? '')
          const showViaRacecourse = shouldShowViaRacecourse({
            line,
            currentSta: sta,
            dir,
            route: route || undefined,
          })
          const dest = formatDestWithRacecourse(train.dest, lang, showViaRacecourse)
          const platform = formatPlatform(train.plat)
          const eta = formatMinutes(train.ttnt, lang)
          return { dest, platform, eta, key: `${dest}-${route}` }
        })
        .filter((item) => {
          if (!item.dest || seenDests.has(item.dest)) return false
          seenDests.add(item.dest)
          return true
        })
    },
    [line, sta, lang]
  )

  const collapsedItems = [
    ...computeUniqueDestEtas(upTrains, 'UP'),
    ...computeUniqueDestEtas(downTrains, 'DOWN'),
  ]

  const collapsedSummary = (
    <div className="space-y-1">
      {collapsedItems.length === 0 ? (
        <div className="text-on-surface-variant m3-body-md">—</div>
      ) : (
        collapsedItems.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 py-0.5">
            <Marquee className="text-on-surface m3-body-md min-w-0 flex-1 font-medium">
              {item.dest}
            </Marquee>
            <div className="flex shrink-0 items-center gap-2">
              {item.platform ? (
                <span className="text-on-surface-variant m3-label-md font-mono">
                  P{item.platform}
                </span>
              ) : null}
              {item.eta.arriving ? (
                <span className="bg-primary-container text-on-primary-container m3-label-lg font-tabular flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold">
                  <LivePulse />
                  {item.eta.text}
                </span>
              ) : (
                <span className="text-on-surface font-tabular m3-body-md font-semibold">
                  {item.eta.text}
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )

  const trainRow = (train: MtrTrainEntry, dir: MtrDirection, trainIdx: number) => {
    const route = String((train as { route?: unknown }).route ?? '')
    const showViaRacecourse = shouldShowViaRacecourse({
      line,
      currentSta: sta,
      dir,
      route: route || undefined,
    })
    const destText = formatDestWithRacecourse(train.dest, lang, showViaRacecourse)
    const platform = formatPlatform(train.plat)
    const eta = formatMinutes(train.ttnt, lang)

    return (
      <div key={`${dir}-${trainIdx}`} className="flex items-center justify-between gap-3 py-1.5">
        <Marquee className="text-on-surface m3-body-md min-w-0 flex-1 font-medium">
          {destText}
        </Marquee>
        <div className="flex shrink-0 items-center gap-2">
          {platform ? (
            <span className="text-on-surface-variant m3-label-md font-mono">P{platform}</span>
          ) : null}
          {eta.arriving ? (
            <span className="bg-primary-container text-on-primary-container m3-label-lg font-tabular flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold">
              <LivePulse />
              {eta.text}
            </span>
          ) : (
            <span className="text-on-surface font-tabular m3-body-md font-semibold">
              {eta.text}
            </span>
          )}
        </div>
      </div>
    )
  }

  const expandedPanel = (
    <div className="space-y-4">
      <div>
        <div className="text-on-surface-variant m3-label-md mb-1 font-medium">{upLabel}</div>
        <div className="space-y-1">
          {upTrains.length === 0 ? (
            <div className="text-on-surface-variant m3-body-md">—</div>
          ) : (
            upTrains.slice(0, 4).map((train, idx) => trainRow(train, 'UP', idx))
          )}
        </div>
      </div>
      <div>
        <div className="text-on-surface-variant m3-label-md mb-1 font-medium">{downLabel}</div>
        <div className="space-y-1">
          {downTrains.length === 0 ? (
            <div className="text-on-surface-variant m3-body-md">—</div>
          ) : (
            downTrains.slice(0, 4).map((train, idx) => trainRow(train, 'DOWN', idx))
          )}
        </div>
      </div>
    </div>
  )

  const header = (includeChevron: boolean) =>
    line ? (
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3',
          lineColor ? getReadableForeground(lineColor) : 'text-on-surface'
        )}
        style={{ backgroundColor: lineColor }}
      >
        <span className="m3-title-md font-medium">{getMtrLineName(line, lang)}</span>
        {includeChevron ? (
          expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : null}
      </div>
    ) : null

  if (!expandable) {
    return (
      <div className={cn('overflow-hidden rounded-2xl', staggerClass)}>
        {header(false)}
        <div className="bg-surface-container p-4">{collapsedSummary}</div>
      </div>
    )
  }

  return (
    <ExpandableEtaRow
      expanded={expanded}
      onToggle={onToggle}
      className="ui-lift"
      panel={expandedPanel}
    >
      <div className="-mt-3 -mr-3 -ml-4">{header(true)}</div>
      {expanded ? null : <div className="pt-2">{collapsedSummary}</div>}
    </ExpandableEtaRow>
  )
}

export const MtrResults = React.memo(function MtrResults({
  title,
  lang,
  schedule,
  error,
  stale,
  lastUpdatedAt,
  onRefresh,
  loading,
}: Props) {
  const updatedAt = lastUpdatedAt ? new Date(lastUpdatedAt) : null
  const relativeAgeLabel = formatRelativeAgeLabel({ lastUpdatedAt, lang })
  const isAgeStale = isStaleByAge({ lastUpdatedAt, mode: 'mtr' })
  const showStale = Boolean(stale || isAgeStale)

  const [expandedKey, setExpandedKey] = React.useState<string | null>(null)
  const onToggleExpand = React.useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key))
  }, [])

  const t = {
    nextTrain: lang === 'en' ? 'Next Train' : lang === 'sc' ? '下班车' : '下班車',
    refresh: lang === 'en' ? 'Refresh' : '重新整理',
    selectStation: lang === 'en' ? 'Select a station to view trains.' : '選擇車站以查看班次',
    serviceMessage: lang === 'en' ? 'Service message' : lang === 'sc' ? '服务信息' : '服務信息',
    noSchedule:
      lang === 'en'
        ? 'No schedule available.'
        : lang === 'sc'
          ? '暂无班次信息。'
          : '暫無班次信息。',
    viewDetails: lang === 'en' ? 'View details' : lang === 'sc' ? '查看详情' : '查看詳情',
    up: lang === 'en' ? 'UP' : lang === 'sc' ? '上行' : '上行',
    down: lang === 'en' ? 'DOWN' : lang === 'sc' ? '下行' : '下行',
    viaRacecourse: lang === 'en' ? ' · Via Racecourse' : ' · 經馬場',
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-on-surface m3-headline-sm truncate">{title}</h2>
          <p className="text-on-surface-variant m3-label-md mt-0.5 flex flex-wrap items-center gap-1.5">
            <TrainFront className="h-3.5 w-3.5 shrink-0" />
            {t.nextTrain}
            {updatedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {lang === 'en'
                    ? `Updated ${formatUiTime(updatedAt, lang)}`
                    : `更新 ${formatUiTime(updatedAt, lang)}`}
                </span>
                {relativeAgeLabel ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{relativeAgeLabel}</span>
                  </>
                ) : null}
              </>
            ) : null}
            {showStale ? (
              <>
                <span aria-hidden>·</span>
                <span className="text-error">{lang === 'en' ? 'Stale' : '未更新'}</span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          className="text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-primary/30 shrink-0 rounded-full p-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          onClick={onRefresh}
          disabled={loading}
          aria-label={t.refresh}
        >
          <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="space-y-4">
        {error ? (
          <p className="text-error m3-body-md">
            {lang === 'en'
              ? `Update failed. Showing last results. (${error})`
              : `更新失敗。顯示上次結果。(${error})`}
          </p>
        ) : null}
        {!schedule ? (
          <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
            <Info className="h-4 w-4" />
            {t.selectStation}
          </div>
        ) : schedule.status === 0 ? (
          <div className="bg-surface-container rounded-2xl p-4">
            <div className="text-on-surface m3-title-md">{t.serviceMessage}</div>
            <div className="text-on-surface-variant m3-body-md mt-1">
              {schedule.message ?? t.noSchedule}
            </div>
            {schedule.url ? (
              <a
                className="text-primary m3-label-lg mt-3 inline-flex items-center gap-2"
                href={schedule.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={
                  lang === 'en' ? 'View details (opens in new tab)' : '查看詳情（在新分頁開啟）'
                }
              >
                {t.viewDetails} <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        ) : (
          Object.entries(schedule.data ?? {}).map(([key, payload], idx) => {
            const [line, sta] = key.split('-')
            const lineColor = line ? getLineColor(line) : undefined

            const staggerClass =
              idx === 0
                ? 'ui-stagger-1'
                : idx === 1
                  ? 'ui-stagger-2'
                  : idx === 2
                    ? 'ui-stagger-3'
                    : ''

            return (
              <MtrLineCard
                key={key}
                payload={payload}
                line={line}
                sta={sta}
                lang={lang}
                lineColor={lineColor}
                upLabel={t.up}
                downLabel={t.down}
                expanded={expandedKey === key}
                onToggle={() => onToggleExpand(key)}
                staggerClass={staggerClass}
              />
            )
          })
        )}
      </div>
    </div>
  )
})
