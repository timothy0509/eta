export type ParsedKmbStopName = {
  name: string
  stopCode: string | null
  platform: string | null
}

// Platform: 1 letter + 1–2 digits (e.g. A12)
const PLATFORM_RE = '[A-Z][0-9]{1,2}'

// Stop code: 1–2 letters + 3+ digits (e.g. TM744, WT916)
// Note: platforms are excluded by requiring 3+ digits.
const STOP_CODE_RE = '[A-Z]{1,2}[0-9]{3,}'

/**
 * Parses KMB stop names that may contain platform and/or stop code suffixes.
 *
 * Examples:
 * - "Chuk Yuen Estate Bus Terminus (WT916)" -> { name: "Chuk Yuen Estate Bus Terminus", platform: null, stopCode: "WT916" }
 * - "Tuen Mun Road BBI (A12) (TM744)" -> { name: "Tuen Mun Road BBI", platform: "A12", stopCode: "TM744" }
 */
export function parseKmbStopName(fullName: string): ParsedKmbStopName {
  const withPlatformAndCode = fullName.match(
    new RegExp(`^(.+?)\\s*\\((${PLATFORM_RE})\\)\\s*\\((${STOP_CODE_RE})\\)\\s*$`)
  )

  if (withPlatformAndCode) {
    return {
      name: withPlatformAndCode[1].trim(),
      platform: withPlatformAndCode[2],
      stopCode: withPlatformAndCode[3],
    }
  }

  const withCodeOnly = fullName.match(new RegExp(`^(.+?)\\s*\\((${STOP_CODE_RE})\\)\\s*$`))
  if (withCodeOnly) {
    return { name: withCodeOnly[1].trim(), platform: null, stopCode: withCodeOnly[2] }
  }

  const withPlatformOnly = fullName.match(new RegExp(`^(.+?)\\s*\\((${PLATFORM_RE})\\)\\s*$`))
  if (withPlatformOnly) {
    return { name: withPlatformOnly[1].trim(), platform: withPlatformOnly[2], stopCode: null }
  }

  return { name: fullName, platform: null, stopCode: null }
}

const parseCache = new Map<string, ParsedKmbStopName>()

export function parseKmbStopNameCached(fullName: string): ParsedKmbStopName {
  const cached = parseCache.get(fullName)
  if (cached) return cached
  const parsed = parseKmbStopName(fullName)
  parseCache.set(fullName, parsed)
  return parsed
}

export function clearKmbStopNameCache(): void {
  parseCache.clear()
}
