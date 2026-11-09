import { fetchJson } from '@/lib/eta/http'

/**
 * Jointly operated route manifest built from the TD headway GTFS feed
 * (routes.txt agency_id values such as KMB+CTB). The app keeps its runtime
 * route and stop data from hk-bus-eta; this manifest is the authoritative
 * list of route numbers that more than one operator runs.
 */

export type JointRouteManifestEntry = {
  /** Lowercase app company codes, e.g. ['kmb', 'ctb']. */
  operators: string[]
  /** Original GTFS agency_id, e.g. KMB+CTB. */
  agency: string
  longName: string
}

export type JointRouteManifest = {
  updated: string
  routes: Record<string, JointRouteManifestEntry>
}

function isManifestEntry(value: unknown): value is JointRouteManifestEntry {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.operators) &&
    record.operators.length > 1 &&
    record.operators.every((op) => typeof op === 'string' && op.trim() !== '') &&
    typeof record.agency === 'string' &&
    typeof record.longName === 'string'
  )
}

function isManifest(value: unknown): value is JointRouteManifest {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.updated !== 'string') return false
  if (typeof record.routes !== 'object' || record.routes === null) return false
  return Object.values(record.routes as Record<string, unknown>).every(isManifestEntry)
}

let resolvedCache: JointRouteManifest | null | undefined
let inflight: Promise<JointRouteManifest | null> | undefined

/**
 * Load the prebuilt joint route manifest from same-origin static JSON.
 * Module-singleton in-flight + resolved cache. Never throws: network,
 * parse, or shape failures return null and callers fall back to the
 * upstream `co` arrays. Failures are not cached, so an offline first load
 * retries on the next call instead of disabling joints until reload.
 */
export function loadJointRoutes(): Promise<JointRouteManifest | null> {
  if (resolvedCache !== undefined) return Promise.resolve(resolvedCache)
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const json = await fetchJson<unknown>('/gtfs/joint-routes.json', {
        cache: 'force-cache',
        timeoutMs: 12_000,
        retries: 0,
      })
      return isManifest(json) ? json : null
    } catch {
      return null
    }
  })()
  return inflight.then((manifest) => {
    // Only cache success: a null (offline/invalid) load stays retryable.
    resolvedCache = manifest ?? undefined
    inflight = undefined
    return manifest
  })
}

/** Test hook: clear the module-singleton cache. */
export function __resetJointRoutesCacheForTests(): void {
  resolvedCache = undefined
  inflight = undefined
}

function normalizeOperators(operators: Iterable<string>): string[] {
  const out = new Set<string>()
  for (const op of operators) {
    const lower = String(op ?? '')
      .trim()
      .toLowerCase()
    if (lower) out.add(lower)
  }
  return Array.from(out).sort()
}

/**
 * KMB-family mapping for joint matching: the TD manifest may file KMB-group
 * joints (S1/R8 agency LWB+CTB) as either `kmb+ctb` (stale) or `lwb+ctb`
 * (fresh regen), while the app keeps the LWB half under `lwb`. Compare in
 * family space so both manifest shapes match either operator input.
 */
function toJointFamily(op: string): string {
  const lower = String(op ?? '')
    .trim()
    .toLowerCase()
  return lower === 'lwb' ? 'kmb' : lower
}

/**
 * Return the operators that jointly run this route, or [] when it is not
 * joint. A route missing from the manifest falls back to the upstream
 * operator list, so a stale manifest does not hide a newly joint route.
 */
export function resolveJointOperators(
  manifest: JointRouteManifest | null | undefined,
  route: string,
  operators: Iterable<string>
): string[] {
  const unique = normalizeOperators(operators)
  if (unique.length < 2) return []
  if (!manifest) return unique
  const definition =
    manifest.routes[
      String(route ?? '')
        .trim()
        .toUpperCase()
    ]
  if (!definition) return unique
  const allowed = new Set(definition.operators.map(toJointFamily))
  const matched = unique.filter((op) => allowed.has(toJointFamily(op)))
  if (matched.length < 2) return []
  // kmb+lwb share one family: joint needs two distinct families.
  return new Set(matched.map(toJointFamily)).size >= 2 ? matched : []
}

/**
 * Search grouping key for a route number the TD feed marks as joint.
 * Returns a key even for a one-operator special variant, so all variants of
 * that route (101, 101R, 101 specials) stay in one search entry. Rows whose
 * operator is not part of the manifest pair (for example GMB 102) get ''.
 */
export function jointRouteGroupKey(
  manifest: JointRouteManifest | null | undefined,
  route: string,
  operators: Iterable<string>
): string {
  if (!manifest) return ''
  const routeUpper = String(route ?? '')
    .trim()
    .toUpperCase()
  const definition = manifest.routes[routeUpper]
  if (!definition) return ''
  const allowed = new Set(definition.operators.map(toJointFamily))
  const unique = normalizeOperators(operators)
  if (unique.length === 0) return ''
  if (!unique.every((op) => allowed.has(toJointFamily(op)))) return ''
  return `joint|${routeUpper}`
}

type JointInferenceEntry = {
  co: string[]
  route: string
  orig?: { en?: string }
  dest?: { en?: string }
  serviceType?: string | number
}

function normalizeTerminusName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function routeSignature(entry: JointInferenceEntry): string | null {
  const origin = normalizeTerminusName(String(entry.orig?.en ?? ''))
  const destination = normalizeTerminusName(String(entry.dest?.en ?? ''))
  if (!origin || !destination) return null
  return `${String(entry.serviceType ?? '')}|${[origin, destination].sort().join('|')}`
}

/**
 * Find route numbers that have separate KMB and Citybus entries with the
 * same termini and service type but no manifest row. 101R is the current
 * case: the TD feed omits it, yet both operators run the same racecourse
 * route under one number.
 */
export function inferJointRouteNumbers(entries: Iterable<JointInferenceEntry>): Set<string> {
  const byRoute = new Map<string, Map<string, Set<string>>>()
  for (const entry of entries) {
    const route = String(entry.route ?? '')
      .trim()
      .toUpperCase()
    if (!route) continue
    const operators = new Set(
      entry.co.map((op) =>
        String(op ?? '')
          .trim()
          .toLowerCase()
      )
    )
    const signature = routeSignature(entry)
    if (!signature) continue
    let byOperator = byRoute.get(route)
    if (!byOperator) {
      byOperator = new Map()
      byRoute.set(route, byOperator)
    }
    for (const co of operators) {
      const family = toJointFamily(co)
      if (family !== 'kmb' && family !== 'ctb') continue
      let signatures = byOperator.get(family)
      if (!signatures) {
        signatures = new Set()
        byOperator.set(family, signatures)
      }
      signatures.add(signature)
    }
  }

  const out = new Set<string>()
  for (const [route, byOperator] of byRoute) {
    const kmb = byOperator.get('kmb')
    const ctb = byOperator.get('ctb')
    if (!kmb || !ctb) continue
    for (const signature of kmb) {
      if (ctb.has(signature)) {
        out.add(route)
        break
      }
    }
  }
  return out
}

/**
 * Stable joint variant keys. Built in three sites (route list, route info,
 * index build) plus a separate cross-pair prefix for 101R-style two-entry
 * pairs. Centralize construction so the sites cannot drift.
 */
export function jointVariantKeyForEntry(entryIndex: number): string {
  return `jointv:${entryIndex}`
}

export function jointCrossPairKey(crossPairIndex: number): string {
  return `jointc:${crossPairIndex}`
}

/** True when this route number is jointly operated. */
export function isJointRoute(
  manifest: JointRouteManifest | null | undefined,
  route: string,
  operators: Iterable<string>
): boolean {
  return resolveJointOperators(manifest, route, operators).length > 1
}
