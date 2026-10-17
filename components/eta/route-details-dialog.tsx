'use client'

import { CalendarDays, Clock, MapPin, Ticket } from 'lucide-react'
import * as React from 'react'

import { RouteBadge } from '@/components/eta/route-badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { getDayType, resolveVariantKey } from '@/lib/eta/headway/lookup'
import type { DayType, VariantSchedule } from '@/lib/eta/headway/types'
import { useHeadwayIndex } from '@/lib/eta/headway/use-headway-schedule'
import { useTranslations } from '@/lib/eta/i18n'
import { getOperatorColor } from '@/lib/eta/operator-colors'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

export type RouteDetailsDialogProps = {
  trigger: React.ReactNode
  /** Base variant key without leg suffix: co|route|dir|service_type. */
  baseKey: string
  route: string
  co: string
  origin: string | null
  destination: string | null
  operatorName: string
  stopName: string | null
  platform: string | null
  stopCode: string | null
  fareLabel: string | null
  lang: UiLanguage
}

const DAY_ORDER: DayType[] = ['weekday', 'saturday', 'sunday', 'holiday']

const DAY_LABEL_KEYS: Record<DayType, string> = {
  weekday: 'kmb.scheduleWeekday',
  saturday: 'kmb.scheduleSaturday',
  sunday: 'kmb.scheduleSunday',
  holiday: 'kmb.scheduleHoliday',
}

/** Minutes since midnight (may exceed 1440 for after-midnight windows) to HH:MM. */
export function minsToDisplay(mins: number): string {
  const normalized = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "HHMM" span endpoint to HH:MM display. Falls back to the raw string. */
export function spanHhmmToDisplay(hhmm: string): string {
  const normalized = hhmm.trim()
  if (/^\d{3,4}$/.test(normalized)) {
    const padded = normalized.padStart(4, '0')
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`
  }
  return normalized
}

function daysWithData(schedule: VariantSchedule): DayType[] {
  return DAY_ORDER.filter(
    (day) => (schedule.headway?.[day]?.length ?? 0) > 0 || schedule.span[day] !== undefined
  )
}

/**
 * Day timetable table: first/last summary plus one row per headway window.
 * Pure presentational piece so the dialog shell stays thin and testable.
 */
export function TimetableTable({
  schedule,
  dayType,
  lang,
}: {
  schedule: VariantSchedule
  dayType: DayType
  lang: UiLanguage
}) {
  const { t, tWithParams } = useTranslations(lang)
  const windows = schedule.headway?.[dayType] ?? schedule.headway?.weekday ?? []
  const span = schedule.span[dayType] ?? schedule.span.weekday

  if (windows.length === 0 && !span) {
    return <div className="text-on-surface-variant m3-body-md">{t('kmb.scheduleNoData')}</div>
  }

  return (
    <div className="space-y-2">
      {span ? (
        <div className="bg-surface-container-high flex items-center justify-between gap-3 rounded-xl px-3 py-2">
          <span className="text-on-surface-variant m3-label-md flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {t('kmb.scheduleFirstBus')}
          </span>
          <span className="text-on-surface font-tabular m3-body-md font-semibold">
            {spanHhmmToDisplay(span[0])}
          </span>
          <span className="text-on-surface-variant m3-label-md flex items-center gap-1.5">
            {t('kmb.scheduleLastBus')}
          </span>
          <span className="text-on-surface font-tabular m3-body-md font-semibold">
            {spanHhmmToDisplay(span[1])}
          </span>
        </div>
      ) : null}
      {windows.length > 0 ? (
        <ul className="divide-outline-variant/15 divide-y">
          {windows.map(([startMin, endMin, headwayMin], idx) => (
            <li
              key={`${startMin}-${endMin}-${headwayMin}:${idx}`}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <span className="text-on-surface font-tabular m3-body-md font-medium tabular-nums">
                {minsToDisplay(startMin)}–{minsToDisplay(endMin)}
              </span>
              <span className="text-on-surface-variant m3-body-md">
                {tWithParams('kmb.scheduleEveryRow', { n: headwayMin })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {dayType === 'holiday' ? (
        <div className="text-on-surface-variant m3-label-md">{t('kmb.scheduleHolidayNote')}</div>
      ) : null}
    </div>
  )
}

function FullTimetable({ baseKey, lang }: { baseKey: string; lang: UiLanguage }) {
  const index = useHeadwayIndex()
  const { t, tWithParams } = useTranslations(lang)
  const [tab, setTab] = React.useState<DayType | null>(null)

  const schedule = React.useMemo(() => {
    if (!index) return null
    const resolved = resolveVariantKey(index.variants, baseKey)
    if (!resolved) return null
    return index.variants[resolved] ?? null
  }, [index, baseKey])

  if (!index || !schedule) {
    if (index && !schedule) {
      return <div className="text-on-surface-variant m3-body-md">{t('kmb.scheduleNoData')}</div>
    }
    return <div className="bg-surface-container-high ui-shimmer h-24 rounded-xl" aria-hidden />
  }

  const available = daysWithData(schedule)
  if (available.length === 0) {
    return <div className="text-on-surface-variant m3-body-md">{t('kmb.scheduleNoData')}</div>
  }
  const today = getDayType(new Date(), index.holidays)
  const active =
    tab && available.includes(tab)
      ? tab
      : available.includes(today)
        ? today
        : (available[0] ?? 'weekday')

  return (
    <div className="space-y-3">
      <div
        className="bg-surface-container-high flex gap-1 overflow-x-auto rounded-full p-1"
        role="group"
        aria-label={t('kmb.scheduleFullTitle')}
      >
        {available.map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={active === day}
            onClick={(e) => {
              e.stopPropagation()
              setTab(day)
            }}
            className={cn(
              'ui-press inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none',
              active === day
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            <span className="m3-label-lg">{t(DAY_LABEL_KEYS[day])}</span>
            {day === today ? (
              <span className="bg-primary-container text-on-primary-container m3-label-sm rounded-full px-1.5 py-px">
                {t('kmb.scheduleToday')}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <TimetableTable schedule={schedule} dayType={active} lang={lang} />
      <div className="text-on-surface-variant m3-label-sm">
        {tWithParams('kmb.scheduleDataDate', { date: index.updated })}
      </div>
    </div>
  )
}

/**
 * Route details dialog: header with badge plus destination, stop and fare
 * cards, next departures, and the full day-by-day timetable from the
 * prebuilt headway index.
 */
export function RouteDetailsDialog({
  trigger,
  baseKey,
  route,
  co,
  origin,
  destination,
  operatorName,
  stopName,
  platform,
  stopCode,
  fareLabel,
  lang,
}: RouteDetailsDialogProps) {
  const { t } = useTranslations(lang)
  const operatorColor = getOperatorColor(co)
  const stopCodeLabel = [platform, stopCode].filter(Boolean).join(' · ') || null
  const routeLine =
    origin && destination ? `${origin} → ${destination}` : (destination ?? origin ?? '')
  const screenReaderTitle = destination ? `${route} → ${destination}` : route

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-surface-container-low max-h-[85dvh] gap-0 overflow-y-auto rounded-3xl border-0 p-0">
        <div
          className="h-1.5 w-full shrink-0"
          style={{ backgroundColor: operatorColor }}
          aria-hidden
        />
        <div className="space-y-5 p-5 sm:p-6">
          <DialogHeader className="text-left">
            <div className="flex flex-wrap items-center gap-2 pr-8">
              <RouteBadge route={route} company={co} size="lg" />
              <span className="bg-surface-container-high text-on-surface-variant m3-label-md rounded-full px-2.5 py-1">
                {operatorName}
              </span>
            </div>
            <DialogTitle className="sr-only">{screenReaderTitle}</DialogTitle>
            <DialogDescription className="text-on-surface m3-title-md font-medium break-words">
              {routeLine || t('common.route')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="bg-surface-container-high flex items-start gap-2.5 rounded-2xl px-3.5 py-3">
              <MapPin className="text-on-surface-variant mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-on-surface-variant m3-label-md">{t('common.stop')}</div>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-on-surface m3-body-md min-w-0 flex-1 font-medium break-words">
                    {stopName ?? t('common.unknown')}
                  </div>
                  {stopCodeLabel ? (
                    <div className="text-on-surface-variant m3-label-md shrink-0 font-mono">
                      {stopCodeLabel}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="bg-surface-container-high flex items-start gap-2.5 rounded-2xl px-3.5 py-3">
              <Ticket className="text-on-surface-variant mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0">
                <div className="text-on-surface-variant m3-label-md">{t('common.fare')}</div>
                <div className="text-on-surface font-tabular m3-body-md font-medium">
                  {fareLabel ?? '—'}
                </div>
              </div>
            </div>
          </div>

          <section aria-label={t('kmb.scheduleFullTitle')}>
            <div className="text-on-surface-variant m3-label-md mb-2 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {t('kmb.scheduleFullTitle')}
            </div>
            <FullTimetable baseKey={baseKey} lang={lang} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
