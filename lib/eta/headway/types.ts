/** Scheduled headway index types (built artefacts from scripts/fetch-headway.mjs). */

export type DayType = 'weekday' | 'saturday' | 'sunday' | 'holiday'

/** [startMin, endMin, headwayMin], minutes since midnight, half-open [start, end). */
export type HeadwayWindow = [startMin: number, endMin: number, headwayMin: number]

/** [startHhmm, endHhmm], e.g. ['0535', '2305']. Converted to HH:MM at lookup. */
export type SpanRange = [startHhmm: string, endHhmm: string]

export interface VariantSchedule {
  src: string[]
  span: Partial<Record<DayType, SpanRange>>
  headway: Partial<Record<DayType, HeadwayWindow[]>>
}

export interface HeadwayIndex {
  updated: string
  variants: Record<string, VariantSchedule>
  holidays: string[]
}

/**
 * Scheduled fallback for a route variant at a point in time.
 * first/last are "HH:MM" display strings (or null when the span is unknown).
 */
export interface ScheduledFallback {
  headwayMin: number | null
  headwayRange: [number, number] | null
  first: string | null
  last: string | null
  isHolidayTimetable: boolean
  serviceKey: string | null
}
