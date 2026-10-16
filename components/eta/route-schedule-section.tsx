'use client'

import * as React from 'react'

import { getDayType, resolveVariantKey } from '@/lib/eta/headway/lookup'
import type { DayType } from '@/lib/eta/headway/types'
import { useHeadwayIndex } from '@/lib/eta/headway/use-headway-schedule'
import { useTranslations } from '@/lib/eta/i18n'
import type { UiLanguage } from '@/lib/eta/types'

function minsToHhmm(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = ((mins % 60) + 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function spanHhmmToDisplay(hhmm: string): string {
  const normalized = hhmm.trim()
  if (/^\d{3,4}$/.test(normalized)) {
    const padded = normalized.padStart(4, '0')
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`
  }
  return normalized
}

const DAY_LABEL_KEYS: Record<DayType, string> = {
  weekday: 'kmb.scheduleWeekday',
  saturday: 'kmb.scheduleSaturday',
  sunday: 'kmb.scheduleSunday',
  holiday: 'kmb.scheduleHoliday',
}

/**
 * Collapsed-by-default per-route timetable from the prebuilt headway index.
 * Shows today's day-type headway windows plus the first/last span. Renders
 * null while the index loads (or fails) and when the variant is unknown.
 */
export function RouteScheduleSection({
  variantKey,
  lang,
}: {
  variantKey: string
  lang: UiLanguage
}) {
  const index = useHeadwayIndex()
  const { t, tWithParams } = useTranslations(lang)

  const content = React.useMemo(() => {
    if (!index) return null
    const resolved = resolveVariantKey(index.variants, variantKey)
    if (!resolved) return null
    const schedule = index.variants[resolved]
    if (!schedule) return null
    const now = new Date()
    const dayType = getDayType(now, index.holidays)
    const windows = schedule.headway[dayType] ?? schedule.headway.weekday
    if (!windows || windows.length === 0) return null
    const span = schedule.span[dayType] ?? schedule.span.weekday
    return { dayType, windows, span }
  }, [index, variantKey])

  if (!content) return null

  return (
    <details className="card-m3 px-4 py-3">
      <summary className="text-on-surface m3-title-md cursor-pointer">
        {t('kmb.scheduleTitle')}{' '}
        <span className="text-on-surface-variant m3-label-md font-normal">
          {t(DAY_LABEL_KEYS[content.dayType])}
        </span>
      </summary>
      <div className="mt-2 space-y-1">
        {content.windows.map(([startMin, endMin, headwayMin], idx) => (
          <div
            key={`${startMin}-${endMin}-${headwayMin}:${idx}`}
            className="m3-body-md text-on-surface-variant"
          >
            {minsToHhmm(startMin)}–{minsToHhmm(endMin)} ·{' '}
            {tWithParams('kmb.scheduleEveryMin', { n: headwayMin })}
          </div>
        ))}
        {content.span ? (
          <div className="text-on-surface-variant m3-body-md">
            {tWithParams('kmb.scheduleFirstLast', {
              first: spanHhmmToDisplay(content.span[0]),
              last: spanHhmmToDisplay(content.span[1]),
            })}
          </div>
        ) : null}
        {content.dayType === 'holiday' ? (
          <div className="text-on-surface-variant m3-label-md">{t('kmb.scheduleHolidayNote')}</div>
        ) : null}
      </div>
    </details>
  )
}
