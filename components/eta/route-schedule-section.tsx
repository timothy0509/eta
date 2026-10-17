'use client'

import { CalendarDays } from 'lucide-react'
import * as React from 'react'

import { FullTimetable } from '@/components/eta/route-details-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
 * Timetable popup for route mode. The trigger shows today's day type and
 * opens a dialog with the full day-by-day timetable (day tabs with the
 * today marker), the same FullTimetable used in stop-mode details.
 * Renders null while the index loads (or fails) and when the variant
 * is unknown.
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
    return { dayType }
  }, [index, variantKey])

  if (!content) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="card-m3 text-on-surface m3-title-md ui-press inline-flex min-h-[48px] flex-1 cursor-pointer items-center gap-2 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          {t('kmb.scheduleTitle')}{' '}
          <span className="text-on-surface-variant m3-label-md font-normal">
            {t(DAY_LABEL_KEYS[content.dayType])}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="bg-surface-container-low max-h-[85dvh] overflow-y-auto rounded-3xl border-0 p-5 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle className="text-on-surface m3-title-md">
            {t('kmb.scheduleFullTitle')}
          </DialogTitle>
        </DialogHeader>
        <FullTimetable baseKey={variantKey} lang={lang} />
      </DialogContent>
    </Dialog>
  )
}
