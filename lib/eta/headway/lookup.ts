import type {
  DayType,
  HeadwayIndex,
  HeadwayWindow,
  ScheduledFallback,
  SpanRange,
  VariantSchedule,
} from '@/lib/eta/headway/types'

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** Local YYYY-MM-DD for a Date. */
export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/**
 * Classify a date into a day type. A match on the local YYYY-MM-DD in the
 * holiday list wins; otherwise Saturday -> saturday, Sunday -> sunday,
 * anything else -> weekday.
 */
export function getDayType(date: Date, holidays: string[]): DayType {
  if (holidays.includes(toLocalDateKey(date))) return 'holiday'
  const day = date.getDay()
  if (day === 6) return 'saturday'
  if (day === 0) return 'sunday'
  return 'weekday'
}

function splitBaseKey(baseKey: string): { prefix: string; serviceType: string } | null {
  const parts = baseKey.split('|')
  if (parts.length !== 4) return null
  const [co, route, bound, serviceType] = parts
  if (!co || !route || !bound || !serviceType) return null
  return { prefix: `${co}|${route}|${bound}`, serviceType }
}

/**
 * Resolve a variant key against the index. Exact hit first, else retry with
 * serviceType "1". Returns the resolved key, or null when neither exists.
 */
export function resolveVariantKey(
  variants: Record<string, VariantSchedule>,
  baseKey: string
): string | null {
  if (variants[baseKey]) return baseKey
  const split = splitBaseKey(baseKey)
  if (!split) return null
  if (split.serviceType === '1') return null
  const fallback = `${split.prefix}|1`
  return variants[fallback] ? fallback : null
}

/** Fallback chain when a day-type table is missing: exact match, else weekday. */
function pickDayTable<T>(
  table: Partial<Record<DayType, T>> | undefined,
  dayType: DayType
): T | null {
  if (!table) return null
  const exact = table[dayType]
  if (exact !== undefined) return exact
  const weekday = table.weekday
  return weekday !== undefined ? weekday : null
}

function hhmmToDisplay(hhmm: string): string | null {
  const normalized = hhmm.trim()
  if (!/^\d{3,4}$/.test(normalized)) return null
  const padded = normalized.padStart(4, '0')
  const hh = Number(padded.slice(0, 2))
  const mm = Number(padded.slice(2, 4))
  if (hh > 23 || mm > 59) return null
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`
}

function spanToDisplay(span: SpanRange | undefined): { first: string | null; last: string | null } {
  if (!span) return { first: null, last: null }
  return { first: hhmmToDisplay(span[0]), last: hhmmToDisplay(span[1]) }
}

/**
 * Half-open [start, end) match. Overnight spans (end < start) are treated as
 * end += 1440, i.e. they match mins >= start (late evening) or mins < end
 * (early morning).
 */
function windowMatches(mins: number, startMin: number, endMin: number): boolean {
  if (endMin < startMin) return mins >= startMin || mins < endMin
  return mins >= startMin && mins < endMin
}

function findActiveHeadway(windows: HeadwayWindow[], mins: number): number | null {
  for (const [startMin, endMin, headwayMin] of windows) {
    if (windowMatches(mins, startMin, endMin)) return headwayMin
  }
  return null
}

function distinctHeadwayRange(windows: HeadwayWindow[]): [number, number] | null {
  const values = [...new Set(windows.map((w) => w[2]))].sort((a, b) => a - b)
  if (values.length < 2) return null
  const first = values[0]
  const last = values[values.length - 1]
  if (first === undefined || last === undefined) return null
  return [first, last]
}

/**
 * Look up the scheduled fallback for a variant at a point in time.
 * Returns null when the variant key cannot be resolved or the index has
 * no usable tables for the day.
 */
export function getScheduleForVariant(
  index: HeadwayIndex,
  baseKey: string,
  now: Date = new Date()
): ScheduledFallback | null {
  const serviceKey = resolveVariantKey(index.variants, baseKey)
  if (!serviceKey) return null
  const schedule = index.variants[serviceKey]
  if (!schedule) return null

  const dayType = getDayType(now, index.holidays)
  const windows = pickDayTable(schedule.headway, dayType)

  const spanEntry = schedule.span[dayType] ?? schedule.span.weekday
  const { first, last } = spanToDisplay(spanEntry)
  if (!windows) {
    // Span-only entry: no frequency windows, but first/last is still useful.
    if (!first && !last) return null
    return {
      headwayMin: null,
      headwayRange: null,
      first,
      last,
      isHolidayTimetable: dayType === 'holiday',
      serviceKey,
    }
  }
  const mins = now.getHours() * 60 + now.getMinutes()

  return {
    headwayMin: findActiveHeadway(windows, mins),
    headwayRange: distinctHeadwayRange(windows),
    first,
    last,
    isHolidayTimetable: dayType === 'holiday',
    serviceKey,
  }
}
