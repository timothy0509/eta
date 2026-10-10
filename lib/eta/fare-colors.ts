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

export function getFareSectionColor(sectionIndex: number): (typeof FARE_SECTION_COLORS)[number] {
  const count = FARE_SECTION_COLORS.length
  const safe = Number.isFinite(sectionIndex) ? Math.floor(sectionIndex) : 0
  return FARE_SECTION_COLORS[((safe % count) + count) % count] ?? FARE_SECTION_COLORS[0]
}

/**
 * Distinct colors for street sections along a CTB route. Kept separate from
 * the fare palette so a street rail never shares a color meaning with the
 * fare rail next to it.
 */
export const STREET_SECTION_COLORS = [
  '#00796b',
  '#795548',
  '#546e7a',
  '#827717',
  '#ad1457',
] as const

export function getStreetSectionColor(
  sectionIndex: number
): (typeof STREET_SECTION_COLORS)[number] {
  const count = STREET_SECTION_COLORS.length
  const safe = Number.isFinite(sectionIndex) ? Math.floor(sectionIndex) : 0
  return STREET_SECTION_COLORS[((safe % count) + count) % count] ?? STREET_SECTION_COLORS[0]
}
