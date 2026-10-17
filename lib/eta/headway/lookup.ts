import type {
  DayType,
  HeadwayIndex,
  HeadwayWindow,
  PatternTimetable,
  ScheduledFallback,
  SpanRange,
  SpecialDayDepartures,
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

/**
 * Exact day-type lookup with no weekday fallback. Fixed departures only
 * exist on the days their trips run, so borrowing another day's times
 * would show buses that never come.
 */
function pickExactDayTable<T>(
  table: Partial<Record<DayType, T>> | undefined,
  dayType: DayType
): T | null {
  if (!table) return null
  const exact = table[dayType]
  return exact !== undefined ? exact : null
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

function spanToDisplay(span: SpanRange | null | undefined): {
  first: string | null
  last: string | null
} {
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

/** Index of the window matching mins (half-open [start, end), overnight wrap), or null. */
export function activeHeadwayIndex(windows: HeadwayWindow[], mins: number): number | null {
  for (let i = 0; i < windows.length; i += 1) {
    const window = windows[i]
    if (!window) continue
    const [startMin, endMin] = window
    if (windowMatches(mins, startMin, endMin)) return i
  }
  return null
}

function findActiveHeadway(windows: HeadwayWindow[], mins: number): number | null {
  const idx = activeHeadwayIndex(windows, mins)
  if (idx === null) return null
  const window = windows[idx]
  return window ? window[2] : null
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
 * Resolve special departures for an exact day type. No weekday fallback:
 * fixed trips only run on their own days, so Saturday must not borrow
 * weekday-only times.
 * Pass servingSrc to keep only entries from those TD route ids (per-stop
 * filtering); omit for the variant-level list.
 */
export function specialsForDay(
  schedule: VariantSchedule,
  dayType: DayType,
  servingSrc?: Set<string> | null
): SpecialDayDepartures[] | null {
  if (!schedule.special || schedule.special.length === 0) return null
  const out: SpecialDayDepartures[] = []
  for (const entry of schedule.special) {
    if (servingSrc && !servingSrc.has(entry.src)) continue
    const list = entry.departures[dayType]
    if (!list || list.length === 0) continue
    out.push({ origin: entry.origin, departures: [...list] })
  }
  return out.length > 0 ? out : null
}

/**
 * Per-src departure groups for an exact day type, with origin labels.
 * Pass serving rids to keep only those patterns (per-stop filtering);
 * omit for every pattern in the variant. Returns null when nothing runs
 * that day. Covers both windowless per-src tables and window-day
 * specials, so split timetables render wherever fixed trips do.
 */
export function departureGroupsForDay(
  schedule: VariantSchedule,
  dayType: DayType,
  servingSrc?: Set<string> | null
): SpecialDayDepartures[] | null {
  const out: SpecialDayDepartures[] = []
  if (schedule.depBySrc) {
    const idxs = Object.keys(schedule.depBySrc)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
    for (const idx of idxs) {
      const rid = schedule.src[idx]
      if (rid === undefined) continue
      if (servingSrc && !servingSrc.has(rid)) continue
      const entry = schedule.depBySrc[String(idx)]
      const list = entry?.departures[dayType]
      if (!list || list.length === 0) continue
      out.push({ origin: entry?.origin ?? '', departures: [...list] })
    }
  }
  if (schedule.special) {
    for (const entry of schedule.special) {
      if (servingSrc && !servingSrc.has(entry.src)) continue
      const list = entry.departures[dayType]
      if (!list || list.length === 0) continue
      if (out.some((g) => g.origin === entry.origin)) continue
      out.push({ origin: entry.origin, departures: [...list] })
    }
  }
  return out.length > 0 ? out : null
}

/**
 * TD route ids serving a stop. Null when the stop has full variant
 * coverage (or no stop was given), meaning every pattern serves it.
 */
export function servingSrcForStop(
  schedule: VariantSchedule,
  stopId: string | null | undefined
): Set<string> | null {
  const cov = stopId ? schedule.stopCov?.[stopId.trim()] : undefined
  if (!cov || cov.length === 0) return null
  const serving = new Set<string>()
  for (const i of cov) {
    const rid = schedule.src[i]
    if (rid !== undefined) serving.add(rid)
  }
  return serving
}

/**
 * Every special pattern timetable with trips on an exact day type:
 * windowless per-src tables plus window-day specials, each with its TD
 * route id and origin label. Pass a serving set to keep only patterns
 * stopping at the current stop; omit for every pattern in the variant.
 */
export function patternTimetablesForDay(
  schedule: VariantSchedule,
  dayType: DayType,
  servingSrc?: Set<string> | null
): PatternTimetable[] {
  const out: PatternTimetable[] = []
  const seen = new Set<string>()
  if (schedule.depBySrc) {
    const idxs = Object.keys(schedule.depBySrc)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
    for (const idx of idxs) {
      const rid = schedule.src[idx]
      if (rid === undefined || seen.has(rid)) continue
      if (servingSrc && !servingSrc.has(rid)) continue
      const entry = schedule.depBySrc[String(idx)]
      const list = entry?.departures[dayType]
      if (!list || list.length === 0) continue
      seen.add(rid)
      out.push({ src: rid, origin: entry?.origin ?? '', departures: { [dayType]: [...list] } })
    }
  }
  if (schedule.special) {
    for (const entry of schedule.special) {
      if (seen.has(entry.src)) continue
      if (servingSrc && !servingSrc.has(entry.src)) continue
      const list = entry.departures[dayType]
      if (!list || list.length === 0) continue
      seen.add(entry.src)
      out.push({ src: entry.src, origin: entry.origin, departures: { [dayType]: [...list] } })
    }
  }
  return out
}

/** Minutes since midnight -> zero-padded "HHMM" (hours may exceed 24). */
function minToHhmm(mins: number): string {
  const h = String(Math.floor(mins / 60)).padStart(2, '0')
  const m = String(mins % 60).padStart(2, '0')
  return `${h}${m}`
}

/**
 * Per-stop schedule resolution. Without a stop id, or when the stop has
 * full variant coverage, this is the variant-level tables. At a partial
 * coverage stop (see stopCov) the frequency table applies only when a
 * frequency route serves the stop, and fixed departures filter to the
 * serving routes. Returns windows/departures/specials plus the span to
 * display; first/last come from the serving fixed trips when the
 * frequency table does not apply.
 */
export function scheduleForStop(
  schedule: VariantSchedule,
  stopId: string | null | undefined,
  dayType: DayType
): {
  windows: HeadwayWindow[] | null
  departures: number[] | null
  specials: SpecialDayDepartures[] | null
  departureGroups: SpecialDayDepartures[] | null
  span: SpanRange | null | undefined
} {
  const spanEntry = pickExactDayTable(schedule.span, dayType)
  const variantWindows = pickDayTable(schedule.headway, dayType)
  const variantDepartures = pickExactDayTable(schedule.departures, dayType)
  const cov = stopId ? schedule.stopCov?.[stopId.trim()] : undefined
  if (!cov || cov.length === 0) {
    const groups = departureGroupsForDay(schedule, dayType)
    return {
      windows: variantWindows,
      // Split timetables replace the merged list wherever they exist.
      departures: groups ? null : variantDepartures ? [...variantDepartures] : null,
      specials: variantWindows ? specialsForDay(schedule, dayType) : null,
      departureGroups: groups,
      span: spanEntry ?? undefined,
    }
  }
  const srcIdx = new Map(schedule.src.map((rid, i) => [rid, i]))
  const serving = new Set<string>()
  for (const i of cov) {
    const rid = schedule.src[i]
    if (rid !== undefined) serving.add(rid)
  }
  const freqSet = new Set<number>(schedule.freqSrc ?? [])
  const freqServing = [...serving].some((rid) => freqSet.has(srcIdx.get(rid) ?? -1))
  const windows = freqServing ? variantWindows : null
  // Fixed departures from serving non-frequency routes: window-day
  // specials plus windowless-day per-src tables, exact day only.
  const fixed: number[] = []
  const pushFixed = (list: number[] | undefined) => {
    if (list) for (const dep of list) fixed.push(dep)
  }
  for (const rid of serving) {
    if (freqSet.has(srcIdx.get(rid) ?? -1)) continue
    const special = schedule.special?.find((entry) => entry.src === rid)
    pushFixed(special?.departures[dayType])
    const table = schedule.depBySrc?.[String(srcIdx.get(rid))]
    pushFixed(table?.departures[dayType])
  }
  fixed.sort((a, b) => a - b)
  if (windows) {
    return {
      windows,
      departures: null,
      specials: specialsForDay(schedule, dayType, serving),
      departureGroups: null,
      span: spanEntry ?? undefined,
    }
  }
  if (fixed.length === 0) {
    // No frequency route serves this stop and no fixed trip does either
    // today: genuinely no service, not the merged span.
    return {
      windows: null,
      departures: null,
      specials: null,
      departureGroups: null,
      span: undefined,
    }
  }
  const groups = departureGroupsForDay(schedule, dayType, serving)
  return {
    windows: null,
    // Split timetables replace the merged list wherever they exist.
    departures: groups ? null : fixed,
    specials: null,
    departureGroups: groups,
    span: [minToHhmm(fixed[0]!), minToHhmm(fixed[fixed.length - 1]!)],
  }
}

/**
 * Look up the scheduled fallback for a variant at a point in time.
 * Pass stopId for per-stop resolution: at partial-coverage stops the
 * frequency table and fixed departures filter to the routes serving
 * that stop. Returns null when the variant key cannot be resolved or
 * the index has no usable tables for the day (or stop).
 */
export function getScheduleForVariant(
  index: HeadwayIndex,
  baseKey: string,
  now: Date = new Date(),
  stopId?: string | null
): ScheduledFallback | null {
  const serviceKey = resolveVariantKey(index.variants, baseKey)
  if (!serviceKey) return null
  const schedule = index.variants[serviceKey]
  if (!schedule) return null

  const dayType = getDayType(now, index.holidays)
  const resolved = scheduleForStop(schedule, stopId, dayType)
  const { first, last } = spanToDisplay(resolved.span)
  if (!resolved.windows) {
    // Span-only entry: no frequency windows, but fixed departures and/or
    // first/last are still useful.
    const departures = resolved.departures
    const groups = resolved.departureGroups
    if (
      (!departures || departures.length === 0) &&
      (!groups || groups.length === 0) &&
      !first &&
      !last
    ) {
      return null
    }
    return {
      headwayMin: null,
      headwayRange: null,
      first,
      last,
      departures: departures && departures.length > 0 ? [...departures] : null,
      special: null,
      departureGroups: groups,
      isHolidayTimetable: dayType === 'holiday',
      serviceKey,
    }
  }
  const mins = now.getHours() * 60 + now.getMinutes()

  return {
    headwayMin: findActiveHeadway(resolved.windows, mins),
    headwayRange: distinctHeadwayRange(resolved.windows),
    first,
    last,
    departures: null,
    special: resolved.specials,
    departureGroups: null,
    isHolidayTimetable: dayType === 'holiday',
    serviceKey,
  }
}
