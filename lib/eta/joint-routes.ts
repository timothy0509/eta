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
 * upstream `co` arrays.
 */
export function loadJointRoutes(): Promise<JointRouteManifest | null> {
  if (resolvedCache !== undefined) return Promise.resolve(resolvedCache)
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch('/gtfs/joint-routes.json', { cache: 'force-cache' })
      if (!res.ok) return null
      const json: unknown = await res.json()
      return isManifest(json) ? json : null
    } catch {
      return null
    }
  })()
  return inflight.then((manifest) => {
    resolvedCache = manifest
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
  const allowed = new Set(
    definition.operators.map((op) =>
      String(op ?? '')
        .trim()
        .toLowerCase()
    )
  )
  const matched = unique.filter((op) => allowed.has(op))
  return matched.length >= 2 ? matched : []
}

/** True when this route number is jointly operated. */
export function isJointRoute(
  manifest: JointRouteManifest | null | undefined,
  route: string,
  operators: Iterable<string>
): boolean {
  return resolveJointOperators(manifest, route, operators).length > 1
}
