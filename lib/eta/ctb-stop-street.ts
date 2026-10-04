import { groupConsecutiveBy } from '@/lib/eta/kmb-fare-sections'

export type ParsedCtbStopName = {
  name: string
  street: string | null
}

function splitIndex(fullName: string): number {
  const asciiIndex = fullName.indexOf(',')
  const fullwidthIndex = fullName.indexOf('，')
  if (asciiIndex >= 0 && fullwidthIndex >= 0) {
    return Math.min(asciiIndex, fullwidthIndex)
  }
  if (asciiIndex >= 0) return asciiIndex
  return fullwidthIndex
}

/**
 * Split a CTB stop name shaped "{name}, {street}", for example
 * "Rumsey Street, Des Voeux Road Central" or "林士街, 德輔道中".
 * Stops without a street have no comma, so street is null, the same way
 * stops without fare data render nothing. A blank name part also yields
 * no street, so callers never render an empty name.
 */
export function parseCtbStopName(fullName: string): ParsedCtbStopName {
  if (!fullName) return { name: fullName, street: null }
  const index = splitIndex(fullName)
  if (index < 0) return { name: fullName.trim(), street: null }
  if (!fullName.slice(0, index).trim()) return { name: fullName.trim(), street: null }
  const street = fullName.slice(index + 1).trim()
  if (!street) return { name: fullName.trim(), street: null }
  return { name: fullName.slice(0, index).trim(), street }
}

/**
 * Parse the street out of a CTB stop name.
 *
 * CTB stop names use the shape "{name}, {street}", for example
 * "Rumsey Street, Des Voeux Road Central" or "林士街, 德輔道中".
 * Stops without a street have no comma and return null, the same way
 * stops without fare data render nothing.
 */
export function parseCtbStopStreet(fullName: string): string | null {
  return parseCtbStopName(fullName).street
}

const streetCache = new Map<string, string | null>()
const nameCache = new Map<string, ParsedCtbStopName>()

export function parseCtbStopStreetCached(fullName: string): string | null {
  const cached = streetCache.get(fullName)
  if (cached !== undefined) return cached
  const parsed = parseCtbStopStreet(fullName)
  streetCache.set(fullName, parsed)
  return parsed
}

export function parseCtbStopNameCached(fullName: string): ParsedCtbStopName {
  const cached = nameCache.get(fullName)
  if (cached !== undefined) return cached
  const parsed = parseCtbStopName(fullName)
  nameCache.set(fullName, parsed)
  return parsed
}

/**
 * Display name for a CTB stop card. Falls back to the parsed name when the
 * CTB name part is blank, so the card never renders an empty name.
 */
export function pickCtbDisplayName(ctbName: string | null | undefined, fallback: string): string {
  return ctbName ? ctbName : fallback
}

export type StreetRun<T> = {
  /** Street shared by every stop in this run, null when unknown. */
  street: string | null
  items: T[]
  /** Index into the street palette, -1 for unknown streets. */
  colorIdx: number
}

/**
 * Group consecutive stops on the same street into runs. Returns null when no
 * stop has a street, so callers skip the street rail entirely. Unknown
 * streets group together but never consume a palette index.
 */
export function buildStreetRuns<T>(
  items: T[],
  getStreet: (item: T, index: number) => string | null
): StreetRun<T>[] | null {
  const runs = groupConsecutiveBy(items, getStreet)
  if (!runs.some((run) => run.key !== null)) return null
  let colorIdx = 0
  return runs.map((run) => ({
    street: run.key,
    items: run.items,
    colorIdx: run.key !== null ? colorIdx++ : -1,
  }))
}

export function clearCtbStopStreetCache(): void {
  streetCache.clear()
  nameCache.clear()
}
