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
  /**
   * Optional: fixed trips from one TD route for days WITH frequency
   * windows (extras the frequency table misses, e.g. short workings from
   * another terminus).
   */
  special?: SpecialDepartures[]
  /**
   * Optional: src indexes (into `src`) with frequency trips. Present only
   * alongside stopCov.
   */
  freqSrc?: number[]
  /**
   * Optional: per-src fixed departures for windowless days, keyed by src
   * index string. Lets stops filter the merged departures table to the
   * routes that actually serve them. Present only alongside stopCov.
   */
  depBySrc?: Record<string, Partial<Record<DayType, number[]>>>
  /**
   * Optional: app stop id -> serving src indexes, only for stops with
   * partial TD-route coverage where the display changes (stops no
   * frequency route serves, stops in span-only variants served by a
   * strict route subset). Stops absent here use the variant-level tables.
   */
  stopCov?: Record<string, number[]>
}

/** Fixed departures from one TD route, with its first-stop origin label. */
export interface SpecialDepartures {
  src: string
  origin: string
  departures: Partial<Record<DayType, number[]>>
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
 * for days with trips but no frequency windows. special holds fixed extras
 * for days WITH frequency windows, resolved to the looked-up day.
 */
export interface ScheduledFallback {
  headwayMin: number | null
  headwayRange: [number, number] | null
  first: string | null
  last: string | null
  departures: number[] | null
  special: SpecialDayDepartures[] | null
  isHolidayTimetable: boolean
  serviceKey: string | null
}

/** Fixed extras for the looked-up day: origin label plus departure minutes. */
export interface SpecialDayDepartures {
  origin: string
  departures: number[]
}
