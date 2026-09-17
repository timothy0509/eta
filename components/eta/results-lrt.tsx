'use client'

import * as React from 'react'
import { RefreshCw, TramFront, TriangleAlert } from 'lucide-react'

import { LivePulse } from '@/components/m3/motion'
import { EmptyState } from '@/components/eta/empty-state'
import { staggerClassForIndex } from '@/components/eta/stagger-list'
import { ResultsHeader } from '@/components/eta/results-header'
import { Badge } from '@/components/ui/badge'
import { Marquee } from '@/components/ui/marquee'
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
  const { t, tWithParams } = useTranslations(lang)

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
        {loading && !schedule ? (
          <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
            <RefreshCw className="h-4 w-4 animate-spin" />
            {t('lrt.loadingTrains')}
          </div>
        ) : !schedule ? (
          !hasStation ? (
            <EmptyState title={t('lrt.selectStation')} />
          ) : !error ? (
            <div className="text-on-surface-variant m3-body-md flex items-center justify-center gap-2 py-8">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {t('lrt.loadingTrains')}
            </div>
          ) : null
        ) : (schedule.platform_list ?? []).length === 0 ? (
          <EmptyState title={t('lrt.emptyPlatform')} />
        ) : (
          <>
            <div className="text-on-surface-variant m3-label-md flex items-center justify-between gap-2">
              <span>{t('lrt.systemTime')}</span>
              <span className="font-tabular">{schedule.system_time ?? ''}</span>
            </div>

            <div className="space-y-4">
              {(schedule.platform_list ?? []).map((p, idx) => {
                const staggerClass = staggerClassForIndex(idx)

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
                        {tWithParams('lrt.platform', { id: p.platform_id })}
                      </span>
                      <span className="text-on-surface-variant m3-label-md">
                        {(p.route_list ?? []).length} {t('lrt.routes')}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {(p.route_list ?? []).map((r, routeIdx) => {
                        const routeColor = getLineColor(String(r.route_no ?? ''))
                        const timeText = pickLangZh(
                          { en: String(r.time_en ?? ''), zh: String(r.time_ch ?? '') },
                          lang
                        )
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
                                  title={pickLangZh({ en: r.dest_en, zh: r.dest_ch }, lang)}
                                  className="text-on-surface m3-body-md font-medium"
                                >
                                  {pickLangZh({ en: r.dest_en, zh: r.dest_ch }, lang)}
                                </Marquee>
                                <div className="text-on-surface-variant m3-label-md">
                                  {formatArrivalDeparture(r.arrival_departure, t)} ·{' '}
                                  {formatTrainLength(r.train_length, tWithParams)}
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
                                  {t('lrt.stopped')}
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
