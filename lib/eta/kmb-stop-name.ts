import type { UiLanguage } from '@/lib/eta/types'

export type ParsedKmbStopName = {
  name: string
  stopCode: string | null
  platform: string | null
}

// Platform: 1 letter + 1–2 digits (e.g. A12)
const PLATFORM_RE = '[A-Z][0-9]{1,2}'

// Stop code: 1–2 letters + 3+ digits + optional lowercase suffix (e.g. TM744, WT916, KT120a)
// Note: platforms are excluded by requiring 3+ digits.
const STOP_CODE_RE = '[A-Z]{1,2}[0-9]{3,}[a-z]?'

export type KmbParseOpts =
  | { isKmb?: false; lang?: UiLanguage }
  | { isKmb: true; lang: UiLanguage }
  | { isKmb: boolean; lang: UiLanguage }

/**
 * Parses KMB stop names that may contain platform and/or stop code suffixes.
 *
 * Only KMB embeds stop codes in stop names, so callers must pass
 * `{ isKmb: true, lang }` for KMB-sourced names. Anything else passes through
 * untouched with null platform/stopCode.
 *
 * KMB English title-casing runs only when lang is 'en'; tc/sc names pass
 * through unchanged.
 *
 * Examples (with isKmb: true, lang: 'tc'):
 * - "Chuk Yuen Estate Bus Terminus (WT916)" -> { name: "Chuk Yuen Estate Bus Terminus", platform: null, stopCode: "WT916" }
 * - "Tuen Mun Road BBI (A12) (TM744)" -> { name: "Tuen Mun Road BBI", platform: "A12", stopCode: "TM744" }
 */
const RE_PLATFORM_AND_CODE = new RegExp(
  `^(.+?)\\s*\\((${PLATFORM_RE})\\)\\s*\\((${STOP_CODE_RE})\\)\\s*$`
)
const RE_CODE_ONLY = new RegExp(`^(.+?)\\s*\\((${STOP_CODE_RE})\\)\\s*$`)
const RE_PLATFORM_ONLY = new RegExp(`^(.+?)\\s*\\((${PLATFORM_RE})\\)\\s*$`)

// All-caps tokens that are abbreviations, never ordinary words.
const KEEP_UPPERCASE = new Set([
  'BBI',
  'B/T',
  'MTR',
  'KCR',
  'LRT',
  'KMB',
  'CTB',
  'APM',
  'IFC',
  'HK',
  'MOKO',
])

// Dotted abbreviations like H.K.
const DOTTED_ABBREV_RE = /^([A-Z]\.)+[A-Z]?\.?$/

// Roman numerals (also matches '' and single letters, so callers check length >= 2).
const ROMAN_NUMERAL_RE = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/

// Leading-letter possessive like O'BRIEN.
const OBRIEN_RE = /^([A-Z])'([A-Z]+)$/

function titleCaseCore(core: string): string {
  if (!core) return core
  // Already mixed case (e.g. apm, ND105a): leave alone. This also makes the
  // function idempotent, since its own output always contains lowercase.
  if (/[a-z]/.test(core)) return core
  if (core === 'ST.') return 'St.'
  if (KEEP_UPPERCASE.has(core)) return core
  if (/[0-9]/.test(core)) return core
  if (DOTTED_ABBREV_RE.test(core) || core.includes('.')) return core
  if (core.length >= 2 && ROMAN_NUMERAL_RE.test(core)) return core
  const obrien = core.match(OBRIEN_RE)
  if (obrien) {
    const rest = obrien[2]
    return `${obrien[1]}'${rest.charAt(0)}${rest.slice(1).toLowerCase()}`
  }
  return core
    .split(/(-|\/)/)
    .map((part) =>
      part === '-' || part === '/' || part === ''
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join('')
}

function titleCaseWord(word: string): string {
  const leading = word.match(/^\(+/)?.[0] ?? ''
  const trailing = word.match(/\)+$/)?.[0] ?? ''
  const end = trailing ? word.length - trailing.length : word.length
  const core = word.slice(leading.length, end)
  if (!core) return word
  return `${leading}${titleCaseCore(core)}${trailing}`
}

/**
 * Title-cases an all-caps KMB English stop name body (suffixes already stripped).
 * Pure and idempotent: feeding its output back in returns it unchanged.
 */
export function titleCaseKmbEnName(body: string): string {
  return body.split(' ').map(titleCaseWord).join(' ')
}

/**
 * Title-cases a KMB route endpoint (origin/destination) for display.
 *
 * Same rules as stop names: English only, KMB-operated routes only.
 * tc/sc names and non-KMB operators pass through unchanged. Endpoints
 * never carry platform/stop-code suffixes, so no parsing is applied.
 */
export function formatKmbRouteEndpointName(
  name: string,
  opts: { co?: string; lang: UiLanguage }
): string {
  if (opts.lang !== 'en') return name
  if (
    String(opts.co ?? 'kmb')
      .trim()
      .toLowerCase() !== 'kmb'
  )
    return name
  return titleCaseKmbEnName(name)
}

export function parseKmbStopName(fullName: string, opts?: KmbParseOpts): ParsedKmbStopName {
  if (!opts?.isKmb) {
    return { name: fullName, platform: null, stopCode: null }
  }

  const applyLang = (name: string): string =>
    opts?.lang === 'en' ? titleCaseKmbEnName(name) : name

  const withPlatformAndCode = fullName.match(RE_PLATFORM_AND_CODE)

  if (withPlatformAndCode) {
    return {
      name: applyLang(withPlatformAndCode[1].trim()),
      platform: withPlatformAndCode[2],
      stopCode: withPlatformAndCode[3],
    }
  }

  const withCodeOnly = fullName.match(RE_CODE_ONLY)
  if (withCodeOnly) {
    return {
      name: applyLang(withCodeOnly[1].trim()),
      platform: null,
      stopCode: withCodeOnly[2],
    }
  }

  const withPlatformOnly = fullName.match(RE_PLATFORM_ONLY)
  if (withPlatformOnly) {
    return {
      name: applyLang(withPlatformOnly[1].trim()),
      platform: withPlatformOnly[2],
      stopCode: null,
    }
  }

  return { name: applyLang(fullName), platform: null, stopCode: null }
}

const parseCache = new Map<string, ParsedKmbStopName>()

export function parseKmbStopNameCached(fullName: string, opts?: KmbParseOpts): ParsedKmbStopName {
  const key = `${opts?.isKmb ? 1 : 0}|${opts?.lang ?? ''}|${fullName}`
  const cached = parseCache.get(key)
  if (cached) return cached
  const parsed = parseKmbStopName(fullName, opts)
  parseCache.set(key, parsed)
  return parsed
}

export function clearKmbStopNameCache(): void {
  parseCache.clear()
}
