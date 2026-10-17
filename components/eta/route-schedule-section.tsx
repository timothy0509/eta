'use client'

import { CalendarDays, ChevronRight } from 'lucide-react'
import * as React from 'react'

import { FullTimetable, daysWithData } from '@/components/eta/route-details-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { getDayType, resolveVariantKey } from '@/lib/eta/headway/lookup'
import type { DayType } from '@/lib/eta/headway/types'
import { useHeadwayIndex } from '@/lib/eta/headway/use-headway-schedule'
import { useTranslations } from '@/lib/eta/i18n'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

const DAY_LABEL_KEYS: Record<DayType, string> = {
  weekday: 'kmb.scheduleWeekday',
  saturday: 'kmb.scheduleSaturday',
  sunday: 'kmb.scheduleSunday',
  holiday: 'kmb.scheduleHoliday',
}

/**
 * Timetable popup for the route view. The trigger looks like the old
 * collapsed row (title plus today's day type) and the dialog reuses the
 * stop-mode FullTimetable with day tabs, so alternate days work the same
 * way in both places. Renders null while the index loads (or fails) and
 * when the variant is unknown.
 */
export function RouteScheduleSection({
  variantKey,
  lang,
  className,
}: {
  variantKey: string
  lang: UiLanguage
  className?: string
}) {
  const index = useHeadwayIndex()
  const { t } = useTranslations(lang)

  const dayType = React.useMemo(() => {
    if (!index) return null
    const resolved = resolveVariantKey(index.variants, variantKey)
    if (!resolved) return null
    const schedule = index.variants[resolved]
    if (!schedule) return null
    // The button stays visible whenever any day has timetable data, but
    // the label names the day the dialog will actually open on (mirroring
    // FullTimetable's default tab) instead of always claiming today.
    const available = daysWithData(schedule, null)
    if (available.length === 0) return null
    const today = getDayType(new Date(), index.holidays)
    return available.includes(today) ? today : (available[0] ?? 'weekday')
  }, [index, variantKey])

  if (!dayType) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'card-m3 text-on-surface m3-title-md ui-press inline-flex min-h-[48px] w-full items-center gap-2 px-4 py-3 text-left transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none',
            className
          )}
        >
          <CalendarDays className="text-on-surface-variant h-4 w-4 shrink-0" aria-hidden />
          {t('kmb.scheduleTitle')}
          <span className="text-on-surface-variant m3-label-md font-normal">
            {t(DAY_LABEL_KEYS[dayType])}
          </span>
          <ChevronRight className="text-on-surface-variant ml-auto h-4 w-4 shrink-0" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent className="bg-surface-container-low max-h-[85dvh] gap-0 overflow-y-auto rounded-3xl border-0 p-0">
        <div className="space-y-4 p-5 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-on-surface m3-title-lg">
              {t('kmb.scheduleFullTitle')}
            </DialogTitle>
            <DialogDescription className="text-on-surface-variant m3-body-md">
              {t('kmb.scheduleTitle')} · {t(DAY_LABEL_KEYS[dayType])}
            </DialogDescription>
          </DialogHeader>
          <FullTimetable baseKey={variantKey} lang={lang} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
