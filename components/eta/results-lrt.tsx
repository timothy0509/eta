'use client'

import * as React from 'react'
import { Info, RefreshCw, TramFront } from 'lucide-react'

import { LivePulse } from '@/components/m3/motion'
import {
  ApiStatusFooter,
  EtaRealtimeBadge,
  SortByTimeToggle,
  etaNumeralClass,
} from '@/components/eta/eta-card-parts'
import { resolveEtaBadge, sortBySoonestMinutes } from '@/lib/eta/eta-badges'
import { ResultsHeader } from '@/components/eta/results-header'
import { Badge } from '@/components/ui/badge'
import { Marquee } from '@/components/ui/marquee'
import { getLineColor } from '@/lib/eta/line-colors'
import { useTranslations } from '@/lib/eta/i18n'
import { usePaneStore } from '@/lib/eta/pane-store'
import type { LrtScheduleResponse } from '@/lib/eta/direct/lrt'
import type { UiLanguage } from '@/lib/eta/types'
import { getReadableForeground } from '@/lib/ui/color'
import { cn } from '@/lib/utils'

function formatTrainLength(length: number, lang: UiLanguage) {
  if (lang === 'en') return `${length}-car`
  return `${length}卡`
}

function formatArrivalDeparture(code: string, lang: UiLanguage) {
  if (lang === 'en') return code === 'A' ? 'Arriving' : 'Departing'
  if (lang === 'sc') return code === 'A' ? '到达' : '离开'
  return code === 'A' ? '到達' : '離開'
}

function isArrivingTime(time: string | number | null | undefined) {
  const text = String(time ?? '')
  const lower = text.toLowerCase()
  return (
    lower.includes('arriv') ||
    text.includes('到達') ||
    text.includes('到达') ||
    text.includes('即將') ||
    text.includes('即将')
  )
}

/** Soonest-first minutes for a Light Rail route entry. Dash text maps to null (last). */
function lrtMinutes(
  route: { arrival_departure: string; time_en: string; time_ch: string },
  lang: UiLanguage
): number | null {
  if (route.arrival_departure === 'A') return 0
  const text = String(lang === 'en' ? route.time_en : (route.time_ch ?? ''))
  if (isArrivingTime(text)) return 0
  const match = text.match(/-?\d+/)
  return match ? Number(match[0]) : null
}

type Props = {
  title: string
  lang: UiLanguage
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
  schedule,
  hasStation,
  error,
  stale,
  lastUpdatedAt,
  onRefresh,
  loading,
}: Props) {
  const { t, tWithParams } = useTranslations(lang)

  /** Sort-by-time toggle. Transient pane-store state, works in the desktop column and mobile list. */
  const sortByTime = usePaneStore((s) => s.sortByTime)
  const setSortByTime = usePaneStore((s) => s.setSortByTime)
  const onToggleSort = React.useCallback(() => {
    setSortByTime(!sortByTime)
  }, [setSortByTime, sortByTime])

  /** Freshness heuristic badge, shared by every route on this card. */
  const platformBadge = resolveEtaBadge({ mode: 'lrt', lastUpdatedAt })

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
        sortControl={<SortByTimeToggle active={sortByTime} onToggle={onToggleSort} lang={lang} />}
      />

      <div className="space-y-4">
        {error ? (
          <p className="text-error m3-body-md">{tWithParams('common.updateFailed', { error })}</p>
        ) : null}
        {loading && !schedule ? (
          <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
            <RefreshCw className="h-4 w-4 animate-spin" />
            {t('lrt.loadingTrains')}
          </div>
        ) : !schedule ? (
          !hasStation ? (
            <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
              <Info className="h-4 w-4" />
              {t('lrt.selectStation')}
            </div>
          ) : !error ? (
            <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {t('lrt.loadingTrains')}
            </div>
          ) : null
        ) : (schedule.platform_list ?? []).length === 0 ? (
          <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
            <Info className="h-4 w-4" />
            {t('lrt.emptyPlatform')}
          </div>
        ) : (
          <>
            <div className="text-on-surface-variant m3-label-md flex items-center justify-between gap-2">
              <span>{t('lrt.systemTime')}</span>
              <span className="font-tabular">{schedule.system_time ?? ''}</span>
            </div>

            <div className="space-y-4">
              {(schedule.platform_list ?? []).map((p, idx) => {
                const staggerClass =
                  idx === 0
                    ? 'ui-stagger-1'
                    : idx === 1
                      ? 'ui-stagger-2'
                      : idx === 2
                        ? 'ui-stagger-3'
                        : ''

                const routes = sortByTime
                  ? sortBySoonestMinutes(p.route_list ?? [], (r) => lrtMinutes(r, lang))
                  : (p.route_list ?? [])

                return (
                  <div
                    key={p.platform_id}
                    className={cn(
                      'border-outline-variant border-b pb-4 last:border-0',
                      staggerClass,
                      stale && 'opacity-60'
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="bg-primary h-2 w-2 shrink-0 rounded-full" aria-hidden />
                      <span className="text-on-surface m3-title-md">
                        {lang === 'en' ? `Platform ${p.platform_id}` : `${p.platform_id}號月台`}
                      </span>
                      <span className="text-on-surface-variant m3-label-md">
                        {(p.route_list ?? []).length} {lang === 'en' ? 'routes' : '條路線'}
                      </span>
                      <EtaRealtimeBadge badge={platformBadge} lang={lang} />
                    </div>

                    <div className="space-y-1">
                      {routes.map((r, routeIdx) => {
                        const routeColor = getLineColor(String(r.route_no ?? ''))
                        const timeText = String(lang === 'en' ? r.time_en : (r.time_ch ?? ''))
                        const arriving = r.arrival_departure === 'A' || isArrivingTime(timeText)

                        return (
                          <div
                            key={`${p.platform_id}-${r.route_no}-${routeIdx}`}
                            className="flex items-center justify-between gap-3 py-1.5"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <Badge
                                className={cn(
                                  'shrink-0 rounded-lg ring-1 ring-black/10',
                                  getReadableForeground(routeColor)
                                )}
                                style={{ backgroundColor: routeColor }}
                              >
                                {r.route_no}
                              </Badge>
                              <div className="min-w-0 flex-1">
                                <Marquee
                                  title={lang === 'en' ? r.dest_en : r.dest_ch}
                                  className="text-on-surface m3-body-md font-medium"
                                >
                                  {lang === 'en' ? r.dest_en : r.dest_ch}
                                </Marquee>
                                <div className="text-on-surface-variant m3-label-md">
                                  {formatArrivalDeparture(r.arrival_departure, lang)} ·{' '}
                                  {formatTrainLength(r.train_length, lang)}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              {arriving ? (
                                <span className="bg-primary-container text-on-primary-container m3-label-lg font-tabular flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold">
                                  <LivePulse />
                                  {timeText}
                                </span>
                              ) : (
                                <div
                                  className={etaNumeralClass(lrtMinutes(r, lang), platformBadge)}
                                >
                                  {timeText}
                                </div>
                              )}
                              {r.stop ? (
                                <div className="text-error m3-label-md" aria-live="polite">
                                  {lang === 'en' ? 'Stopped' : '暫停服務'}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4">
              <ApiStatusFooter lang={lang} mode="lrt" lastUpdatedAt={lastUpdatedAt} stale={stale} />
            </div>
          </>
        )}
      </div>
    </div>
  )
})
