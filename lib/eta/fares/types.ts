/** Static origin/destination fare matrix (built by scripts/fetch-headway.mjs). */

/** Inclusive destination index and the fare charged for alighting there. */
export type FareRange = [lastDestIndex: number, hkd: number]

export interface VariantFares {
  /** App stop ids in route order, parallel to `fares`. */
  stops: string[]
  /**
   * fares[originIndex] is null when that boarding stop has no fare rows.
   * Each range covers destinations up to and including its index, so the
   * first range whose end is at or past the alighting stop wins.
   */
  fares: Array<FareRange[] | null>
}

export interface FareIndex {
  updated: string
  variants: Record<string, VariantFares>
}
