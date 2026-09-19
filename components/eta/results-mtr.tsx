'use client'

import * as React from 'react'
import { ChevronDown, ExternalLink, TrainFront, TriangleAlert } from 'lucide-react'

import { LivePulse } from '@/components/m3/motion'
import { EmptyState } from '@/components/eta/empty-state'
import { staggerClassForIndex } from '@/components/eta/stagger-list'
import { ResultsHeader } from '@/components/eta/results-header'
import { Marquee } from '@/components/ui/marquee'
import { findMtrStationBySta } from '@/lib/data/mtr-stations'
import { getLineColor, getMtrLineName } from '@/lib/eta/line-colors'
import { useTranslations } from '@/lib/eta/i18n'
import { pickLangZh } from '@/lib/eta/pick-lang'
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
  return pickLangZh({ en: station.nameEn, zh: station.nameTc }, lang)
}

function formatDestWithRacecourse(
  dest: unknown,
  lang: UiLanguage,
  viaRacecourseSuffix: string,
  showViaRacecourse: boolean
) {
  const destName = formatDest(dest, lang)
  if (!showViaRacecourse) return destName

  return `${destName}${viaRacecourseSuffix}`
}

function formatMinutes(ttnt: unknown, arrivingText: string, minutesUnit: string) {
  const raw = String(ttnt ?? '').trim()
  if (!raw) return { text: '—', arriving: false }
  const minutes = Number(raw)
  if (Number.isNaN(minutes)) return { text: raw, arriving: false }
  if (minutes <= 0)
    return {
      text: arrivingText,
      arriving: true,
    }
  return {
    text: `${minutes} ${minutesUnit}`,
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
  viaRacecourseSuffix: string
  arrivingText: string
  minutesUnit: string
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
  viaRacecourseSuffix,
  arrivingText,
  minutesUnit,
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
          const dest = formatDestWithRacecourse(
            train.dest,
            lang,
            viaRacecourseSuffix,
            showViaRacecourse
          )
          const platform = formatPlatform(train.plat)
          const eta = formatMinutes(train.ttnt, arrivingText, minutesUnit)
          return { dest, platform, eta, key: `${dest}-${route}` }
        })
        .filter((item) => {
          if (!item.dest || seenDests.has(item.dest)) return false
          seenDests.add(item.dest)
          return true
        })
    },
    [line, sta, lang, viaRacecourseSuffix, arrivingText, minutesUnit]
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
            <Marquee
              title={item.dest}
              className="text-on-surface m3-body-md min-w-0 flex-1 font-medium"
            >
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
    const destText = formatDestWithRacecourse(
      train.dest,
      lang,
      viaRacecourseSuffix,
      showViaRacecourse
    )
    const platform = formatPlatform(train.plat)
    const eta = formatMinutes(train.ttnt, arrivingText, minutesUnit)

    return (
      <div key={`${dir}-${trainIdx}`} className="flex items-center justify-between gap-3 py-1.5">
        <Marquee title={destText} className="text-on-surface m3-body-md min-w-0 flex-1 font-medium">
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
          <ChevronDown className={cn('ui-chevron h-4 w-4', expanded && 'rotate-180')} />
        ) : null}
      </div>
    ) : null

  if (!expandable) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-[var(--outline-variant)]/10 shadow-sm',
          staggerClass
        )}
      >
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
      flush
      panel={expandedPanel}
      toggleLabel={line ? getMtrLineName(line, lang) : 'MTR'}
    >
      {header(true)}
      {expanded ? null : <div className="p-4">{collapsedSummary}</div>}
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
  const { t } = useTranslations(lang)

  const [expandedKey, setExpandedKey] = React.useState<string | null>(null)
  const onToggleExpand = React.useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key))
  }, [])
  const listSignature = React.useMemo(
    () => `mtr:${title}:${Object.keys(schedule?.data ?? {}).join(',')}`,
    [title, schedule]
  )

  return (
    <div key={listSignature}>
      <ResultsHeader
        lang={lang}
        mode="mtr"
        title={title}
        icon={<TrainFront className="h-3.5 w-3.5 shrink-0" />}
        subtitle={t('mtr.nextTrain')}
        lastUpdatedAt={lastUpdatedAt}
        stale={stale}
        loading={loading}
        onRefresh={onRefresh}
      />

      <div className="space-y-4">
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
        {!schedule ? (
          <EmptyState title={t('mtr.selectStation')} />
        ) : schedule.status === 0 ? (
          <div className="bg-surface-container rounded-2xl p-4">
            <div className="text-on-surface m3-title-md">{t('mtr.serviceMessage')}</div>
            <div className="text-on-surface-variant m3-body-md mt-1">
              {schedule.message ?? t('mtr.noSchedule')}
            </div>
            {schedule.url ? (
              <a
                className="text-primary m3-label-lg mt-3 inline-flex items-center gap-2"
                href={schedule.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('mtr.viewDetailsHint')}
              >
                {t('mtr.viewDetails')} <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        ) : (
          Object.entries(schedule.data ?? {}).map(([key, payload], idx) => {
            const [line, sta] = key.split('-')
            const lineColor = line ? getLineColor(line) : undefined

            const staggerClass = staggerClassForIndex(idx)

            return (
              <MtrLineCard
                key={key}
                payload={payload}
                line={line}
                sta={sta}
                lang={lang}
                lineColor={lineColor}
                upLabel={t('mtr.up')}
                downLabel={t('mtr.down')}
                viaRacecourseSuffix={t('mtr.viaRacecourse')}
                arrivingText={t('common.now')}
                minutesUnit={t('common.minutesUnit')}
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
