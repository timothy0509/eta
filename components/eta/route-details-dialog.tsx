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
import {
  getDayType,
  activeHeadwayIndex,
  resolveVariantKey,
  scheduleForStop,
} from '@/lib/eta/headway/lookup'
import type { DayType, SpecialDayDepartures, VariantSchedule } from '@/lib/eta/headway/types'
import { useHeadwayIndex } from '@/lib/eta/headway/use-headway-schedule'
import { useTranslations } from '@/lib/eta/i18n'
import { getOperatorColor } from '@/lib/eta/operator-colors'
import type { UiLanguage } from '@/lib/eta/types'
import { useTickingNow } from '@/lib/eta/use-ticking-now'
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
  /** App stop id for per-stop timetable resolution; omit for route-level. */
  stopId?: string | null
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

function daysWithData(schedule: VariantSchedule, stopId?: string | null): DayType[] {
  return DAY_ORDER.filter((day) => {
    const resolved = scheduleForStop(schedule, stopId ?? null, day)
    return (
      (resolved.windows?.length ?? 0) > 0 ||
      (resolved.departures?.length ?? 0) > 0 ||
      (resolved.specials?.length ?? 0) > 0 ||
      resolved.span !== undefined
    )
  })
}

/**
 * Day timetable table: first/last summary plus one row per headway window.
 * The row covering the current time gets a highlighted background and a
 * "Now" chip when `isToday` is set and the windows come from today's own
 * day-type table (not the weekday fallback). Pure presentational piece so
 * the dialog shell stays thin and testable.
 */
export function TimetableTable({
  schedule,
  dayType,
  lang,
  isToday = false,
  now,
  stopId = null,
}: {
  schedule: VariantSchedule
  dayType: DayType
  lang: UiLanguage
  isToday?: boolean
  /** Test override for the live clock; omit in normal use. */
  now?: Date
  /** App stop id for per-stop resolution; omit for the variant-level table. */
  stopId?: string | null
}) {
  const { t, tWithParams } = useTranslations(lang)
  const tick = useTickingNow(60_000)
  const resolved = scheduleForStop(schedule, stopId, dayType)
  const windows = resolved.windows ?? []
  const departures = resolved.departures ?? []
  const specials = resolved.specials
  const span = resolved.span
  // Weekday fallback windows do not describe today's service, so only
  // highlight when the day-type table exists for today.
  const hasExactTable = resolved.windows !== null && schedule.headway?.[dayType] !== undefined
  const nowDate = now ?? new Date(tick)
  const activeIdx =
    isToday && hasExactTable
      ? activeHeadwayIndex(windows, nowDate.getHours() * 60 + nowDate.getMinutes())
      : null

  if (windows.length === 0 && departures.length === 0 && !specials && !span) {
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
        <div className="space-y-1.5">
          <div className="text-on-surface-variant m3-label-md">{t('kmb.scheduleFrequency')}</div>
          <ul className="divide-outline-variant/15 divide-y">
            {windows.map(([startMin, endMin, headwayMin], idx) => {
              const active = idx === activeIdx
              return (
                <li
                  key={`${startMin}-${endMin}-${headwayMin}:${idx}`}
                  aria-current={active ? 'time' : undefined}
                  className={cn(
                    '-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors',
                    active ? 'bg-primary-container text-on-primary-container' : 'text-on-surface'
                  )}
                >
                  <span className="m3-body-md font-tabular font-medium tabular-nums">
                    {minsToDisplay(startMin)}–{minsToDisplay(endMin)}
                  </span>
                  {active ? (
                    <span className="m3-label-sm flex items-center gap-2 font-medium">
                      {tWithParams('kmb.scheduleEveryRow', { n: headwayMin })}
                      <span className="bg-on-primary-container text-primary-container m3-label-sm rounded-full px-1.5 py-px font-semibold">
                        {t('kmb.scheduleNow')}
                      </span>
                    </span>
                  ) : (
                    <span className="m3-body-md text-on-surface-variant">
                      {tWithParams('kmb.scheduleEveryRow', { n: headwayMin })}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : departures.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" role="list" aria-label={t('kmb.scheduleTitle')}>
          {departures.map((depMin, idx) => (
            <span
              key={`${depMin}:${idx}`}
              role="listitem"
              className="bg-surface-container-high text-on-surface font-tabular m3-body-md rounded-lg px-2.5 py-1 font-medium tabular-nums"
            >
              {minsToDisplay(depMin)}
            </span>
          ))}
        </div>
      ) : null}
      {specials ? (
        <div className="space-y-1.5 pt-1">
          <div className="text-on-surface-variant m3-label-md">{t('kmb.scheduleSpecial')}</div>
          {specials.map((group, groupIdx) => (
            <div key={`${group.origin}:${groupIdx}`} className="space-y-1">
              {group.origin ? (
                <div className="text-on-surface m3-label-md font-medium">{group.origin}</div>
              ) : null}
              <div
                className="flex flex-wrap gap-1.5"
                role="list"
                aria-label={group.origin || t('kmb.scheduleSpecial')}
              >
                {group.departures.map((depMin, idx) => (
                  <span
                    key={`${depMin}:${idx}`}
                    role="listitem"
                    className="bg-surface-container-high text-on-surface font-tabular m3-body-md rounded-lg px-2.5 py-1 font-medium tabular-nums"
                  >
                    {minsToDisplay(depMin)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {dayType === 'holiday' ? (
        <div className="text-on-surface-variant m3-label-md">{t('kmb.scheduleHolidayNote')}</div>
      ) : null}
    </div>
  )
}

/** Max time chips per special group on compact cards; the rest fold into +N. */
const CARD_SPECIAL_CHIP_LIMIT = 6

/**
 * Compact special-departures line for no-ETA cards: origin label plus time
 * chips per group, capped with a +N overflow chip. Route-level info, so it
 * renders wherever the card renders regardless of the current stop.
 */
export function SpecialDeparturesLine({
  special,
  lang,
}: {
  special: SpecialDayDepartures[]
  lang: UiLanguage
}) {
  const { t } = useTranslations(lang)
  if (special.length === 0) return null
  return (
    <div className="space-y-1.5">
      <div className="text-on-surface-variant m3-label-md">{t('kmb.scheduleSpecial')}</div>
      {special.map((group, groupIdx) => {
        const visible = group.departures.slice(0, CARD_SPECIAL_CHIP_LIMIT)
        const overflow = group.departures.length - visible.length
        return (
          <div key={`${group.origin}:${groupIdx}`} className="space-y-1">
            {group.origin ? (
              <div className="text-on-surface m3-label-md font-medium">{group.origin}</div>
            ) : null}
            <div className="flex flex-wrap gap-1.5" role="list">
              {visible.map((depMin, idx) => (
                <span
                  key={`${depMin}:${idx}`}
                  role="listitem"
                  className="bg-surface-container-high text-on-surface font-tabular m3-body-md rounded-lg px-2.5 py-1 font-medium tabular-nums"
                >
                  {minsToDisplay(depMin)}
                </span>
              ))}
              {overflow > 0 ? (
                <span
                  role="listitem"
                  className="bg-surface-container-high text-on-surface-variant font-tabular m3-body-md rounded-lg px-2.5 py-1 font-medium tabular-nums"
                >
                  +{overflow}
                </span>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function FullTimetable({
  baseKey,
  lang,
  stopId = null,
}: {
  baseKey: string
  lang: UiLanguage
  /** App stop id for per-stop resolution; omit for the variant-level table. */
  stopId?: string | null
}) {
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

  const available = daysWithData(schedule, stopId)
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
      <TimetableTable
        schedule={schedule}
        dayType={active}
        lang={lang}
        isToday={active === today}
        stopId={stopId}
      />
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
  stopId = null,
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
            <FullTimetable baseKey={baseKey} lang={lang} stopId={stopId} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
