/**
 * Parse the street out of a CTB stop name.
 *
 * CTB stop names use the shape "{name}, {street}", for example
 * "Rumsey Street, Des Voeux Road Central" or "林士街, 德輔道中".
 * Stops without a street have no comma and return null, the same way
 * stops without fare data render nothing.
 */
export function parseCtbStopStreet(fullName: string): string | null {
  if (!fullName) return null
  const asciiIndex = fullName.indexOf(',')
  const fullwidthIndex = fullName.indexOf('，')
  let index = -1
  if (asciiIndex >= 0 && fullwidthIndex >= 0) {
    index = Math.min(asciiIndex, fullwidthIndex)
  } else if (asciiIndex >= 0) {
    index = asciiIndex
  } else if (fullwidthIndex >= 0) {
    index = fullwidthIndex
  }
  if (index < 0) return null
  const street = fullName.slice(index + 1).trim()
  return street ? street : null
}

const parseCache = new Map<string, string | null>()

export function parseCtbStopStreetCached(fullName: string): string | null {
  const cached = parseCache.get(fullName)
  if (cached !== undefined) return cached
  const parsed = parseCtbStopStreet(fullName)
  parseCache.set(fullName, parsed)
  return parsed
}

export function clearCtbStopStreetCache(): void {
  parseCache.clear()
}
