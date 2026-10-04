import { normalizeGtfsId } from '@/lib/eta/eta-db-index'

export type GmbRegionRow = {
  co: string
  route: string
  gtfsId?: string
  stopId: string
}

function isGmb(co: unknown): boolean {
  return String(co ?? '').toLowerCase() === 'gmb'
}

/**
 * Group GMB gtfsIds into regions. A GMB number repeats across Hong Kong
 * Island, Kowloon and the New Territories, but variants of the same regional
 * route (service workings, short workings) share physical stops while
 * cross-region routes never do. Union by shared stop, transitively, per
 * route number. Returns key `${ROUTE}|${gtfsId}` -> region id, which is the
 * smallest gtfsId in the component so it stays stable.
 */
export function buildGmbRegionLookup(rows: GmbRegionRow[]): Map<string, string> {
  const stopsByKey = new Map<string, Set<string>>()
  for (const row of rows) {
    if (!isGmb(row.co)) continue
    const gtfsId = normalizeGtfsId(row.gtfsId)
    const stopId = String(row.stopId ?? '').trim()
    if (!gtfsId || !stopId) continue
    const key = `${String(row.route ?? '').toUpperCase()}|${gtfsId}`
    let set = stopsByKey.get(key)
    if (!set) {
      set = new Set()
      stopsByKey.set(key, set)
    }
    set.add(stopId)
  }

  const keysByRoute = new Map<string, string[]>()
  for (const key of stopsByKey.keys()) {
    const route = key.split('|', 1)[0] ?? ''
    const list = keysByRoute.get(route)
    if (list) list.push(key)
    else keysByRoute.set(route, [key])
  }

  const lookup = new Map<string, string>()
  for (const keys of keysByRoute.values()) {
    const parent = new Map<string, string>()
    for (const key of keys) parent.set(key, key)
    const find = (x: string): string => {
      const p = parent.get(x) ?? x
      if (p === x) return x
      const root = find(p)
      parent.set(x, root)
      return root
    }
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        const a = stopsByKey.get(keys[i]!) ?? new Set<string>()
        const b = stopsByKey.get(keys[j]!) ?? new Set<string>()
        let shared = false
        for (const stopId of a) {
          if (b.has(stopId)) {
            shared = true
            break
          }
        }
        if (shared) parent.set(find(keys[i]!), find(keys[j]!))
      }
    }
    const membersByRoot = new Map<string, string[]>()
    for (const key of keys) {
      const root = find(key)
      const list = membersByRoot.get(root)
      if (list) list.push(key)
      else membersByRoot.set(root, [key])
    }
    for (const members of membersByRoot.values()) {
      const gtfsIds = members.map((key) => key.split('|')[1] ?? '')
      gtfsIds.sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || a.localeCompare(b))
      const regionId = gtfsIds[0] ?? ''
      for (const key of members) lookup.set(key, regionId)
    }
  }
  return lookup
}

/**
 * Resolve the region id for one GMB variant. Falls back to the gtfsId
 * itself when it is absent from the lookup (stops not loaded yet).
 */
export function gmbRegionId(
  lookup: Map<string, string> | null | undefined,
  route: string,
  gtfsId: unknown
): string {
  const id = normalizeGtfsId(gtfsId)
  if (!id) return ''
  const hit = lookup?.get(`${String(route ?? '').toUpperCase()}|${id}`)
  return hit ?? id
}
