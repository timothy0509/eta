'use client'

import { Info, RefreshCw, TramFront } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

type Props = {
  title: string
  lang: UiLanguage
  schedule: LrtScheduleResponse | null
  error?: string | null
  stale?: boolean
  lastUpdatedAt?: number | null
  onRefresh: () => void
  loading?: boolean
}

export function LrtResults({
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
  }
  return (
    <Card className="bg-card/60 rounded-3xl border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-6">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
            <TramFront className="h-3.5 w-3.5" />
            {lang === 'en' ? 'Light Rail' : lang === 'sc' ? '轻铁' : '輕鐵'}
            {updatedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {lang === 'en'
                    ? `Updated ${formatUiTime(updatedAt, lang)}`
                    : lang === 'sc'
                      ? `更新 ${formatUiTime(updatedAt, lang)}`
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
              <Badge variant="destructive" className="rounded-lg">
                {lang === 'en' ? 'Stale' : lang === 'sc' ? '未更新' : '未更新'}
              </Badge>
            ) : null}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'ui-spin')} />
          {lang === 'en' ? 'Refresh' : '重新整理'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="ui-animate-fade bg-destructive/10 text-destructive rounded-2xl border p-4 text-sm">
            {lang === 'en'
              ? `Update failed. Showing last results. (${error})`
              : lang === 'sc'
                ? `更新失败。显示上次结果。(${error})`
                : `更新失敗。顯示上次結果。(${error})`}
          </div>
        ) : null}
        {!schedule ? (
          <div className="ui-animate-fade bg-background/40 text-muted-foreground flex items-center gap-2 rounded-2xl border p-4 text-sm">
            <Info className="h-4 w-4" />
            {lang === 'en' ? 'Select a station to view trains.' : '選擇車站以查看班次'}
          </div>
        ) : (schedule.platform_list ?? []).length === 0 ? (
          <div className="ui-animate-fade bg-background/40 text-muted-foreground flex items-center gap-2 rounded-2xl border p-4 text-sm">
            <Info className="h-4 w-4" />
            {t.emptyPlatform}
          </div>
        ) : (
          <>
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
              <span>{t.systemTime}</span>
              <span>{schedule.system_time ?? ''}</span>
            </div>

            <div className="space-y-3">
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
                      'ui-animate-in ui-lift bg-background/40 rounded-2xl border p-4',
                      staggerClass
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {lang === 'en'
                          ? `Platform ${p.platform_id}`
                          : lang === 'sc'
                            ? `${p.platform_id}号月台`
                            : `${p.platform_id}號月台`}
                      </div>
                      <Badge variant="secondary" className="rounded-xl">
                        {(p.route_list ?? []).length}{' '}
                        {lang === 'en' ? 'routes' : lang === 'sc' ? '条路线' : '條路線'}
                      </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                      {(p.route_list ?? []).map((r, idx) => (
                        <div
                          key={`${p.platform_id}-${r.route_no}-${idx}`}
                          className="ui-lift bg-card/30 flex items-start justify-between gap-3 rounded-2xl border p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                className={cn(
                                  'shrink-0 rounded-xl ring-1 ring-black/10',
                                  getReadableForeground(getLineColor(String(r.route_no ?? '')))
                                )}
                                style={{
                                  backgroundColor: getLineColor(String(r.route_no ?? '')),
                                }}
                              >
                                {r.route_no}
                              </Badge>
                              <Marquee className="text-sm font-medium">
                                {lang === 'en' ? r.dest_en : r.dest_ch}
                              </Marquee>
                            </div>
                            <div className="text-muted-foreground mt-1 text-xs">
                              {formatArrivalDeparture(r.arrival_departure, lang)} ·{' '}
                              {formatTrainLength(r.train_length, lang)}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-tabular text-lg font-semibold">
                              {lang === 'en' ? r.time_en : r.time_ch}
                            </div>
                            {r.stop ? (
                              <div className="text-destructive text-xs" aria-live="polite">
                                {lang === 'en'
                                  ? 'Stopped'
                                  : lang === 'sc'
                                    ? '暫停服務'
                                    : '暫停服務'}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
