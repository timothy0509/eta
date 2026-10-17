'use client'

import * as React from 'react'

import { TimetableTable } from '@/components/eta/route-details-dialog'
import { getDayType, resolveVariantKey } from '@/lib/eta/headway/lookup'
import type { DayType } from '@/lib/eta/headway/types'
import { useHeadwayIndex } from '@/lib/eta/headway/use-headway-schedule'
import { useTranslations } from '@/lib/eta/i18n'
import type { UiLanguage } from '@/lib/eta/types'

const DAY_LABEL_KEYS: Record<DayType, string> = {
  weekday: 'kmb.scheduleWeekday',
  saturday: 'kmb.scheduleSaturday',
  sunday: 'kmb.scheduleSunday',
  holiday: 'kmb.scheduleHoliday',
}

/**
 * Collapsed-by-default per-route timetable from the prebuilt headway index.
 * Shows today's day type in the summary and reuses the stop-mode
 * TimetableTable (first/last bar plus headway rows, current window
 * highlighted) for the content. Renders null while the index loads (or
 * fails) and when the variant is unknown.
 */
export function RouteScheduleSection({
  variantKey,
  lang,
}: {
  variantKey: string
  lang: UiLanguage
}) {
  const index = useHeadwayIndex()
  const { t } = useTranslations(lang)

  const content = React.useMemo(() => {
    if (!index) return null
    const resolved = resolveVariantKey(index.variants, variantKey)
    if (!resolved) return null
    const schedule = index.variants[resolved]
    if (!schedule) return null
    const dayType = getDayType(new Date(), index.holidays)
    const windows = schedule.headway?.[dayType] ?? schedule.headway?.weekday
    const span = schedule.span[dayType] ?? schedule.span.weekday
    if ((!windows || windows.length === 0) && !span) return null
    return { schedule, dayType }
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
      <div className="mt-2">
        <TimetableTable schedule={content.schedule} dayType={content.dayType} lang={lang} isToday />
      </div>
    </details>
  )
}
