/** Scheduled headway index types (built artefacts from scripts/fetch-headway.mjs). */

export type DayType = 'weekday' | 'saturday' | 'sunday' | 'holiday'

/** [startMin, endMin, headwayMin], minutes since midnight, half-open [start, end). */
export type HeadwayWindow = [startMin: number, endMin: number, headwayMin: number]

/** [startHhmm, endHhmm], e.g. ['0535', '2305']. Converted to HH:MM at lookup. */
export type SpanRange = [startHhmm: string, endHhmm: string]

export interface VariantSchedule {
  src: string[]
  span: Partial<Record<DayType, SpanRange>>
  /** Optional: span-only entries (peak-only routes) have no frequency windows. */
  headway?: Partial<Record<DayType, HeadwayWindow[]>>
  /**
   * Optional: fixed first-stop departures in minutes since midnight (may
   * exceed 1440 for after-midnight trips), for days with trips but no
   * frequency windows.
   */
  departures?: Partial<Record<DayType, number[]>>
}

export interface HeadwayIndex {
  updated: string
  variants: Record<string, VariantSchedule>
  holidays: string[]
}

/**
 * Scheduled fallback for a route variant at a point in time.
 * first/last are "HH:MM" display strings (or null when the span is unknown).
 * departures holds fixed departure minutes (since midnight, may exceed 1440)
 * for days with trips but no frequency windows.
 */
export interface ScheduledFallback {
  headwayMin: number | null
  headwayRange: [number, number] | null
  first: string | null
  last: string | null
  departures: number[] | null
  isHolidayTimetable: boolean
  serviceKey: string | null
}
