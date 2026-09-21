'use client'

import { MapPin, TrainFront } from 'lucide-react'
import * as React from 'react'

import {
  RouteStopCard,
  RouteStopTimeline,
  SoonestEtaPill,
} from '@/components/eta/route-stop-timeline'
import { RouteDrilldown } from '@/components/eta/views/route-drilldown'
import { EmptyState } from '@/components/eta/empty-state'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { staggerClassForIndex } from '@/components/eta/stagger-list'
import { findMtrStationBySta, formatMtrStationName, type MtrLang } from '@/lib/data/mtr-stations'
import { fetchMtrRouteSchedules, listMtrRoutes } from '@/lib/eta/client'
import { LINE_COLOR_FALLBACK, getLineColor, getMtrLineName } from '@/lib/eta/line-colors'
import { useTranslations } from '@/lib/eta/i18n'
import { pickLangZh } from '@/lib/eta/pick-lang'
import type { MtrScheduleResponse, MtrTrainEntry } from '@/lib/eta/mtr'
import type { UiLanguage } from '@/lib/eta/types'
import { getReadableForeground } from '@/lib/ui/color'
import { cn } from '@/lib/utils'
import type { RouteListEntry } from 'hk-bus-eta'

const LINE_ORDER = ['AEL', 'TCL', 'TML', 'TKL', 'EAL', 'SIL', 'TWL', 'ISL', 'KTL', 'DRL']

function toMtrLang(lang: UiLanguage): MtrLang {
  return lang === 'en' ? 'EN' : 'TC'
}

function sortLines(a: string, b: string): number {
  const ai = LINE_ORDER.indexOf(a)
  const bi = LINE_ORDER.indexOf(b)
  if (ai >= 0 && bi >= 0) return ai - bi
  if (ai >= 0) return -1
  if (bi >= 0) return 1
  return a.localeCompare(b)
}

function getRouteDestination(dest: { en: string; zh: string }, lang: UiLanguage): string {
  return pickLangZh(dest, lang)
}

function variantKey(entry: RouteListEntry): string {
  return `${entry.route}|${entry.serviceType}|${entry.bound.mtr ?? ''}`
}

/**
 * Expandable MTR station card. Collapsed header shows the next trains
 * toward the route terminus; expanding lists up to four of them.
 * The card reads both UP and DOWN schedule entries and keeps only
 * trains heading to a station further down the selected route.
 * This mirrors the stop-mode line card breakdown.
 */
function MtrRouteStopCard({
  sta,
  seq,
  stationStas,
  selectedLine,
  schedule,
  lang,
  color,
  onSelectStation,
  currentVariant,
}: {
  sta: string
  seq: number
  stationStas: string[]
  selectedLine: string
  schedule: MtrScheduleResponse | undefined
  lang: UiLanguage
  color: string
  onSelectStation?: (sta: string, line: string, name: string) => void
  currentVariant: RouteListEntry
}) {
  const [expanded, setExpanded] = React.useState(false)
  const { t } = useTranslations(lang)
  const station = findMtrStationBySta(sta)
  const name = station ? formatMtrStationName(station, toMtrLang(lang)) : sta

  const downstreamStas = React.useMemo(() => new Set(stationStas.slice(seq)), [stationStas, seq])
  const soonestTrains = React.useMemo(() => {
    const payload = schedule?.data?.[`${selectedLine}-${sta}`]
    if (!payload) return []
    const matching: MtrTrainEntry[] = []
    for (const dir of ['UP', 'DOWN'] as const) {
      for (const train of payload[dir] ?? []) {
        const dest = String(train.dest ?? '').trim()
        if (!dest || !downstreamStas.has(dest)) continue
        matching.push(train)
      }
    }
    return matching.sort((a, b) => {
      const aMin = Number(String(a.ttnt ?? '').trim())
      const bMin = Number(String(b.ttnt ?? '').trim())
      const aSafe = Number.isNaN(aMin) ? Number.MAX_SAFE_INTEGER : aMin
      const bSafe = Number.isNaN(bMin) ? Number.MAX_SAFE_INTEGER : bMin
      return aSafe - bSafe
    })
  }, [schedule, selectedLine, sta, downstreamStas])

  const trainLine = (ttnt: unknown) => {
    const raw = String(ttnt ?? '').trim()
    if (!raw) return { text: '—', arriving: false }
    const minutes = Number(raw)
    if (Number.isNaN(minutes)) return { text: raw, arriving: false }
    if (minutes <= 0) return { text: t('common.now'), arriving: true }
    return { text: `${minutes} ${t('common.minutesUnit')}`, arriving: false }
  }

  const soonestText =
    soonestTrains.length > 0 ? trainLine(soonestTrains[0]?.ttnt) : { text: '—', arriving: false }

  const etaNode =
    soonestTrains.length > 0 ? (
      <SoonestEtaPill
        minutes={soonestText.arriving ? 0 : Number(String(soonestTrains[0]?.ttnt ?? ''))}
        arriving={soonestText.arriving}
        lang={lang}
      />
    ) : (
      <SoonestEtaPill minutes={null} lang={lang} />
    )

  const renderTrains = (list: MtrTrainEntry[]) => (
    <div className="space-y-1">
      {list.length === 0 ? (
        <div className="text-on-surface-variant m3-body-md">—</div>
      ) : (
        list.slice(0, 4).map((train, trainIdx) => {
          const destRaw = String(train.dest ?? '')
          const destStation = findMtrStationBySta(destRaw)
          const destName = destStation
            ? formatMtrStationName(destStation, toMtrLang(lang))
            : destRaw || '—'
          const platform = String(train.plat ?? '').trim()
          const eta = trainLine(train.ttnt)
          return (
            <div
              key={`${trainIdx}:${destRaw}:${String(train.ttnt ?? '')}`}
              className="flex items-center justify-between gap-3 py-0.5"
            >
              <div className="text-on-surface m3-body-md min-w-0 flex-1 truncate font-medium">
                {destName}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {platform ? (
                  <span className="text-on-surface-variant m3-label-md font-mono">P{platform}</span>
                ) : null}
                <span className="text-on-surface font-tabular m3-body-md font-semibold">
                  {eta.text}
                </span>
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  const panel =
    soonestTrains.length === 0 && !schedule ? (
      <div className="text-on-surface-variant m3-body-md">{t('mtr.noSchedule')}</div>
    ) : (
      <div className="space-y-1">
        <div className="text-on-surface-variant m3-label-md mb-1 font-medium">
          {getRouteDestination(currentVariant.dest, lang)}
        </div>
        {renderTrains(soonestTrains)}
      </div>
    )

  return (
    <RouteStopCard
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      color={color}
      seq={seq}
      name={name}
      subtitle={sta}
      eta={etaNode}
      panel={panel}
      toggleLabel={typeof name === 'string' ? name : sta}
      selectLabel={onSelectStation ? t('common.viewEtas') : undefined}
      onSelect={onSelectStation ? () => onSelectStation(sta, selectedLine, name) : undefined}
    />
  )
}

export function MtrRoutesView({
  lang,
  onSelectStation,
}: {
  lang: UiLanguage
  onSelectStation?: (sta: string, line: string, name: string) => void
}) {
  const { t } = useTranslations(lang)
  const [selectedLine, setSelectedLine] = React.useState<string | null>(null)
  const [mtrRoutes, setMtrRoutes] = React.useState<RouteListEntry[]>([])
  const [routesLoading, setRoutesLoading] = React.useState(true)
  const [routesError, setRoutesError] = React.useState<string | null>(null)
  const [retryKey, setRetryKey] = React.useState(0)
  const [selectedVariant, setSelectedVariant] = React.useState<RouteListEntry | null>(null)
  const [schedulesBySta, setSchedulesBySta] = React.useState<Record<string, MtrScheduleResponse>>(
    {}
  )

  React.useEffect(() => {
    let cancelled = false
    listMtrRoutes()
      .then((data) => {
        if (cancelled) return
        setMtrRoutes(data)
        setRoutesError(null)
      })
      .catch((err) => {
        if (!cancelled) {
          setRoutesError(err instanceof Error ? err.message : t('errors.updateFailedGeneric'))
        }
      })
      .finally(() => {
        if (!cancelled) setRoutesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [retryKey, t])

  const lines = React.useMemo(() => {
    const set = new Set<string>()
    for (const route of mtrRoutes) {
      set.add(route.route)
    }
    return Array.from(set).sort(sortLines)
  }, [mtrRoutes])

  const variantsForLine = React.useMemo(() => {
    if (!selectedLine) return []
    return mtrRoutes
      .filter((route) => route.route === selectedLine)
      .sort(
        (a, b) =>
          getRouteDestination(a.dest, lang).localeCompare(getRouteDestination(b.dest, lang)) ||
          a.serviceType.localeCompare(b.serviceType)
      )
  }, [mtrRoutes, selectedLine, lang])

  const currentVariant = React.useMemo(() => {
    if (!selectedLine) return null
    if (
      selectedVariant &&
      variantsForLine.some((v) => variantKey(v) === variantKey(selectedVariant))
    ) {
      return selectedVariant
    }
    return variantsForLine[0] ?? null
  }, [selectedLine, selectedVariant, variantsForLine])

  const stationStas = React.useMemo(() => {
    if (!currentVariant) return []
    return (currentVariant.stops.mtr ?? []).map((sta) => sta.toUpperCase())
  }, [currentVariant])

  React.useEffect(() => {
    if (!selectedLine || stationStas.length === 0) return

    let cancelled = false
    let inFlight = false
    const line = selectedLine
    const mtrLang = toMtrLang(lang)

    const load = async () => {
      if (cancelled || inFlight) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      inFlight = true
      try {
        const result = await fetchMtrRouteSchedules({
          line,
          stas: stationStas,
          lang: mtrLang,
        })

        if (cancelled) return

        const next: Record<string, MtrScheduleResponse> = {}
        for (const sta of stationStas) {
          const scheduleKey = `${line}-${sta}-${mtrLang}`
          const schedule = result.byKey[scheduleKey]
          if (schedule) next[sta] = schedule
        }
        setSchedulesBySta(next)
      } catch {
        if (!cancelled) setSchedulesBySta({})
      } finally {
        inFlight = false
      }
    }

    void load()

    const interval = window.setInterval(() => {
      void load()
    }, 30_000)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [selectedLine, stationStas, lang])

  const lineColor = selectedLine ? getLineColor(selectedLine) : LINE_COLOR_FALLBACK

  const handleRetryRoutes = React.useCallback(() => {
    setRoutesError(null)
    setRoutesLoading(true)
    setRetryKey((k) => k + 1)
  }, [])

  return (
    <div className="card-m3 p-4">
      <div className="m3-title-md text-on-surface mb-3 flex items-center gap-2">
        <TrainFront className="h-5 w-5" />
        {t('mtr.lines')}
      </div>

      {!selectedLine ? (
        routesLoading ? (
          <ResultsSkeleton />
        ) : routesError && mtrRoutes.length === 0 ? (
          <EmptyState
            title={t('common.wentWrong')}
            hint={routesError}
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
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {lines.map((line, idx) => {
              const color = getLineColor(line)
              const fg = getReadableForeground(color)
              return (
                <button
                  key={line}
                  type="button"
                  onClick={() => {
                    setSchedulesBySta({})
                    setSelectedVariant(null)
                    setSelectedLine(line)
                  }}
                  style={{ backgroundColor: color }}
                  className={cn(
                    'ui-press rounded-2xl p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none',
                    staggerClassForIndex(idx),
                    fg
                  )}
                >
                  <div className="m3-title-lg">{getMtrLineName(line, lang)}</div>
                  <div className="m3-label-lg opacity-90">{t('common.route')}</div>
                </button>
              )
            })}
          </div>
        )
      ) : (
        <RouteDrilldown
          lang={lang}
          onBack={() => {
            setSchedulesBySta({})
            setSelectedLine(null)
            setSelectedVariant(null)
          }}
          title={
            <span
              className="m3-title-md rounded-full px-4 py-2"
              style={{
                backgroundColor: lineColor,
                color: getReadableForeground(lineColor) === 'text-white' ? '#fff' : '#000',
              }}
            >
              {getMtrLineName(selectedLine, lang)}
            </span>
          }
        >
          {variantsForLine.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {variantsForLine.map((variant) => (
                <button
                  key={variantKey(variant)}
                  type="button"
                  onClick={() => {
                    setSchedulesBySta({})
                    setSelectedVariant(variant)
                  }}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                    currentVariant && variantKey(currentVariant) === variantKey(variant)
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  )}
                >
                  {getRouteDestination(variant.dest, lang)}
                  {variant.serviceType !== '1' ? ` · ${variant.serviceType}` : ''}
                </button>
              ))}
            </div>
          )}

          {currentVariant && variantsForLine.length === 1 && (
            <div className="text-on-surface-variant m3-body-md">
              {getRouteDestination(currentVariant.dest, lang)}
            </div>
          )}

          <div className="bg-surface-container rounded-2xl p-4">
            <div className="m3-title-md text-on-surface mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t('mtr.stations')}
              <span className="text-on-surface-variant m3-body-md ml-auto">
                {stationStas.length}
              </span>
            </div>

            <RouteStopTimeline key={currentVariant ? variantKey(currentVariant) : selectedLine}>
              {stationStas.map((sta, idx) => (
                <MtrRouteStopCard
                  key={sta}
                  sta={sta}
                  seq={idx + 1}
                  stationStas={stationStas}
                  selectedLine={selectedLine}
                  schedule={schedulesBySta[sta]}
                  lang={lang}
                  color={lineColor}
                  onSelectStation={onSelectStation}
                  currentVariant={currentVariant!}
                />
              ))}
            </RouteStopTimeline>
          </div>
        </RouteDrilldown>
      )}
    </div>
  )
}
