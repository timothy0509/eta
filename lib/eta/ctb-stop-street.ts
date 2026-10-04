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
 * stops without fare data render nothing.
 */
export function parseCtbStopName(fullName: string): ParsedCtbStopName {
  if (!fullName) return { name: fullName, street: null }
  const index = splitIndex(fullName)
  if (index < 0) return { name: fullName, street: null }
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
  if (cached) return cached
  const parsed = parseCtbStopName(fullName)
  nameCache.set(fullName, parsed)
  return parsed
}

export function clearCtbStopStreetCache(): void {
  streetCache.clear()
  nameCache.clear()
}
