'use client'

import * as React from 'react'
import { Info, RefreshCw, TramFront } from 'lucide-react'

import { LivePulse } from '@/components/m3/motion'
import { Badge } from '@/components/ui/badge'
import { Marquee } from '@/components/ui/marquee'
import { getLineColor } from '@/lib/eta/line-colors'
import { formatUiTime } from '@/lib/eta/format'
import { formatRelativeAgeLabel, isStaleByAge } from '@/lib/eta/stale'
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
  const updatedAt = lastUpdatedAt ? new Date(lastUpdatedAt) : null
  const relativeAgeLabel = formatRelativeAgeLabel({ lastUpdatedAt, lang })
  const isAgeStale = isStaleByAge({ lastUpdatedAt, mode: 'lrt' })
  const showStale = Boolean(stale || isAgeStale)

  const t = {
    systemTime: lang === 'en' ? 'System time' : lang === 'sc' ? '系统时间' : '系統時間',
    emptyPlatform:
      lang === 'en'
        ? 'No platform data right now.'
        : lang === 'sc'
          ? '暂时没有月台信息。'
          : '暫時沒有月台資訊。',
    refresh: lang === 'en' ? 'Refresh' : '重新整理',
    selectStation: lang === 'en' ? 'Select a station to view trains.' : '選擇車站以查看班次',
    loading: lang === 'en' ? 'Loading trains…' : lang === 'sc' ? '载入班次中…' : '載入班次中…',
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-on-surface m3-headline-sm truncate">{title}</h2>
          <p className="text-on-surface-variant m3-label-md mt-0.5 flex flex-wrap items-center gap-1.5">
            <TramFront className="h-3.5 w-3.5 shrink-0" />
            {lang === 'en' ? 'Light Rail' : lang === 'sc' ? '轻铁' : '輕鐵'}
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
        {loading && !schedule ? (
          <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
            <RefreshCw className="h-4 w-4 animate-spin" />
            {t.loading}
          </div>
        ) : !schedule ? (
          !hasStation ? (
            <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
              <Info className="h-4 w-4" />
              {t.selectStation}
            </div>
          ) : !error ? (
            <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {t.loading}
            </div>
          ) : null
        ) : (schedule.platform_list ?? []).length === 0 ? (
          <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
            <Info className="h-4 w-4" />
            {t.emptyPlatform}
          </div>
        ) : (
          <>
            <div className="text-on-surface-variant m3-label-md flex items-center justify-between gap-2">
              <span>{t.systemTime}</span>
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

                return (
                  <div
                    key={p.platform_id}
                    className={cn(
                      'border-outline-variant border-b pb-4 last:border-0',
                      staggerClass
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
                    </div>

                    <div className="space-y-1">
                      {(p.route_list ?? []).map((r, routeIdx) => {
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
                                <Marquee className="text-on-surface m3-body-md font-medium">
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
                                <div className="text-on-surface font-tabular m3-body-md font-semibold">
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
          </>
        )}
      </div>
    </div>
  )
})
