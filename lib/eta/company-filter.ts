/**
 * Company chip filtering for the KMB stop search.
 * Pure client-side predicates over existing company/route fields.
 * No fetching, no new data sources.
 */

export type CompanyChip = 'all' | 'kmb' | 'ctb' | 'cross-harbour' | 'n-line'

export const COMPANY_CHIPS: CompanyChip[] = ['all', 'kmb', 'ctb', 'cross-harbour', 'n-line']

export function normalizeCompany(co: string | undefined | null): string {
  return String(co ?? 'kmb').toLowerCase()
}

const RE_LEADING_NUM = /^[A-Z]*(\d+)/

/** Numeric part of a route number, e.g. "N216" -> 216, "X962" -> 962. Null when none. */
export function getRouteNumber(route: string): number | null {
  const match = String(route ?? '')
    .toUpperCase()
    .trim()
    .match(RE_LEADING_NUM)
  if (!match) return null
  const num = parseInt(match[1], 10)
  return Number.isFinite(num) ? num : null
}

/** Overnight routes carry an N prefix: N216, NA33, N121. */
export function isNLineRoute(route: string): boolean {
  return String(route ?? '')
    .trim()
    .toUpperCase()
    .startsWith('N')
}

/** Cross-harbour numbers are 1xx, 3xx, 6xx or 9xx, with any letter prefix. */
export function isCrossHarbourNumber(route: string): boolean {
  const num = getRouteNumber(route)
  if (num === null) return false
  return (
    (num >= 100 && num < 200) ||
    (num >= 300 && num < 400) ||
    (num >= 600 && num < 700) ||
    (num >= 900 && num < 1000)
  )
}

/** Citybus covers ctb plus the legacy nwfb code. */
export function isCitybusCompany(co: string | undefined | null): boolean {
  const normalized = normalizeCompany(co)
  return normalized === 'ctb' || normalized === 'nwfb'
}

/**
 * Route numbers served by more than one company, e.g. jointly operated
 * cross-harbour routes. Built from whatever entries are on screen.
 */
export function findJointRouteNumbers(
  entries: Array<{ route: string; co?: string | null }>
): Set<string> {
  const byRoute = new Map<string, Set<string>>()
  for (const entry of entries) {
    const route = String(entry.route ?? '')
      .toUpperCase()
      .trim()
    if (!route) continue
    let companies = byRoute.get(route)
    if (!companies) {
      companies = new Set()
      byRoute.set(route, companies)
    }
    companies.add(normalizeCompany(entry.co))
  }
  const joint = new Set<string>()
  for (const [route, companies] of byRoute) {
    if (companies.size > 1) joint.add(route)
  }
  return joint
}

export function isCrossHarbourRoute(
  route: string,
  co?: string | null,
  jointRoutes?: Set<string>
): boolean {
  const normalized = String(route ?? '')
    .toUpperCase()
    .trim()
  if (!normalized) return false
  if (isCrossHarbourNumber(normalized)) return true
  if (jointRoutes?.has(normalized)) return true
  void co
  return false
}

export function matchesCompanyChip(
  entry: { route: string; co?: string | null },
  chip: CompanyChip,
  jointRoutes?: Set<string>
): boolean {
  switch (chip) {
    case 'all':
      return true
    case 'kmb':
      return normalizeCompany(entry.co) === 'kmb'
    case 'ctb':
      return isCitybusCompany(entry.co)
    case 'cross-harbour':
      return isCrossHarbourRoute(entry.route, entry.co, jointRoutes)
    case 'n-line':
      return isNLineRoute(entry.route)
  }
}

export function filterByCompanyChip<T extends { route: string; co?: string | null }>(
  entries: T[],
  chip: CompanyChip,
  jointRoutes?: Set<string>
): T[] {
  if (chip === 'all') return entries
  return entries.filter((entry) => matchesCompanyChip(entry, chip, jointRoutes))
}
