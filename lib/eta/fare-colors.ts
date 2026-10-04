/**
 * Distinct colors for fare sections along a route.
 * hk-bus-eta fares only go down, so each section (stops sharing one fare)
 * gets the next color in the list. Cycling keeps adjacent sections distinct
 * even on long routes with many fare stages.
 */
export const FARE_SECTION_COLORS = [
  '#0072b2',
  '#e69f00',
  '#009e73',
  '#cc79a7',
  '#56b4e9',
  '#d55e00',
  '#9467bd',
] as const

/** Neutral rail color for stops with no usable fare. */
export const FARE_UNKNOWN_COLOR = '#a1a1aa'

export function getFareSectionColor(sectionIndex: number): string {
  const idx =
    ((sectionIndex % FARE_SECTION_COLORS.length) + FARE_SECTION_COLORS.length) %
    FARE_SECTION_COLORS.length
  return FARE_SECTION_COLORS[idx]!
}
