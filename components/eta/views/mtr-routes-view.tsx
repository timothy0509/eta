'use client'

import { ChevronLeft, MapPin, TrainFront } from 'lucide-react'
import * as React from 'react'

import {
  RouteStopRow,
  RouteStopTimeline,
  SoonestEtaPill,
} from '@/components/eta/route-stop-timeline'
import { FadeIn, MotionCard, StaggerContainer, StaggerItem } from '@/components/m3/motion'
import { findMtrStationBySta, formatMtrStationName, type MtrLang } from '@/lib/data/mtr-stations'
import { fetchMtrRouteSchedules, listMtrRoutes } from '@/lib/eta/client'
import { getLineColor } from '@/lib/eta/line-colors'
import { useTranslations } from '@/lib/eta/i18n'
import { pickSoonestMtrTrain } from '@/lib/eta/pick-soonest-eta'
import type { MtrScheduleResponse } from '@/lib/eta/mtr'
import type { UiLanguage } from '@/lib/eta/types'
import { useTickingNow } from '@/lib/eta/use-ticking-now'
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
  return lang === 'en' ? dest.en : dest.zh
}

function variantKey(entry: RouteListEntry): string {
  return `${entry.route}|${entry.serviceType}|${entry.bound.mtr ?? ''}`
}

export function MtrRoutesView({
  lang,
  onSelectStation,
}: {
  lang: UiLanguage
  onSelectStation?: (sta: string, line: string, name: string) => void
}) {
  const { t } = useTranslations(lang)
  useTickingNow(15_000)
  const [selectedLine, setSelectedLine] = React.useState<string | null>(null)
  const [mtrRoutes, setMtrRoutes] = React.useState<RouteListEntry[]>([])
  const [routesLoading, setRoutesLoading] = React.useState(true)
  const [selectedVariant, setSelectedVariant] = React.useState<RouteListEntry | null>(null)
  const [schedulesBySta, setSchedulesBySta] = React.useState<Record<string, MtrScheduleResponse>>(
    {}
  )

  React.useEffect(() => {
    let cancelled = false
    listMtrRoutes()
      .then((data) => {
        if (!cancelled) setMtrRoutes(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRoutesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    const line = selectedLine
    const mtrLang = toMtrLang(lang)

    const load = async () => {
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
    }

    void load().catch(() => {
      if (!cancelled) setSchedulesBySta({})
    })

    const interval = window.setInterval(() => {
      void load().catch(() => {})
    }, 30_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [selectedLine, stationStas, lang])

  const lineColor = selectedLine ? getLineColor(selectedLine) : '#64748b'

  return (
    <div className="bg-surface-container-low rounded-3xl p-4 shadow-sm">
      <div className="m3-title-md text-on-surface mb-3 flex items-center gap-2">
        <TrainFront className="h-5 w-5" />
        {t('mtr.lines')}
      </div>

      {!selectedLine ? (
        routesLoading ? (
          <div className="text-on-surface-variant m3-body-md py-8 text-center">
            {t('common.refresh')}…
          </div>
        ) : (
          <StaggerContainer className="grid grid-cols-2 gap-3 sm:grid-cols-3" stagger={0.03}>
            {lines.map((line) => {
              const color = getLineColor(line)
              const fg = getReadableForeground(color)
              return (
                <StaggerItem key={line}>
                  <MotionCard
                    hoverScale={1.02}
                    tapScale={0.98}
                    className={cn(
                      'rounded-2xl p-4 shadow-sm transition-shadow hover:shadow-md',
                      fg
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setSchedulesBySta({})
                      setSelectedVariant(null)
                      setSelectedLine(line)
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedLine(line)
                    }}
                  >
                    <div className="m3-title-lg">{line}</div>
                    <div className="m3-label-lg opacity-90">{t('common.route')}</div>
                  </MotionCard>
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        )
      ) : (
        <FadeIn className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSchedulesBySta({})
                setSelectedLine(null)
                setSelectedVariant(null)
              }}
              className="bg-secondary-container text-on-secondary-container m3-label-lg inline-flex items-center gap-1 rounded-full px-4 py-2 transition-colors hover:opacity-90"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('common.back')}
            </button>
            <span
              className="m3-title-md rounded-full px-4 py-2"
              style={{
                backgroundColor: lineColor,
                color: getReadableForeground(lineColor) === 'text-white' ? '#fff' : '#000',
              }}
            >
              {selectedLine}
            </span>
          </div>

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

            <RouteStopTimeline lineColor={lineColor}>
              {stationStas.map((sta, idx) => {
                const station = findMtrStationBySta(sta)
                const downstreamStas = new Set(stationStas.slice(idx + 1))
                const schedule = schedulesBySta[sta]
                const soonest = pickSoonestMtrTrain(schedule, selectedLine, sta, downstreamStas)
                const name = station ? formatMtrStationName(station, toMtrLang(lang)) : sta
                return (
                  <RouteStopRow
                    key={sta}
                    name={name}
                    subtitle={<span className="hidden sm:inline">{sta}</span>}
                    eta={
                      <SoonestEtaPill
                        minutes={soonest.minutes}
                        arriving={soonest.arriving}
                        lang={lang}
                      />
                    }
                    onClick={() => onSelectStation?.(sta, selectedLine, name)}
                  />
                )
              })}
            </RouteStopTimeline>
          </div>

          <div className="bg-surface-container rounded-2xl p-4">
            <div className="m3-title-md text-on-surface mb-2">{t('common.map')}</div>
            <div className="text-on-surface-variant m3-body-md bg-surface-container-high flex h-32 items-center justify-center rounded-2xl">
              {t('common.mapUnavailable')}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  )
}
