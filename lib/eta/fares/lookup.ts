import type { FareIndex, VariantFares } from '@/lib/eta/fares/types'

/**
 * Exact variant lookup first, then the same co/route/bound/gtfsId with any
 * service type. The latter covers variants whose upstream service type does
 * not match the one captured in the fare snapshot.
 */
export function resolveFareVariant(
  index: FareIndex | null,
  variantKey: string | null | undefined
): VariantFares | null {
  if (!index || !variantKey) return null
  const direct = index.variants[variantKey]
  if (direct) return direct

  const parts = variantKey.split('|')
  if (parts.length !== 5) return null
  const [co, route, bound, , gtfsId] = parts
  if (!gtfsId) return null
  for (const [key, value] of Object.entries(index.variants)) {
    const candidate = key.split('|')
    if (
      candidate.length === 5 &&
      candidate[0] === co &&
      candidate[1] === route &&
      candidate[2] === bound &&
      candidate[4] === gtfsId
    ) {
      return value
    }
  }
  return null
}

/**
 * Resolve a fare table for a key that may lack a gtfsId, such as KMB official
 * stop-eta rows. The stop id picks the right region when same-number routes
 * share co/route/bound, and same service type wins when several match.
 */
export function resolveFareVariantForStop(
  index: FareIndex | null,
  variantKey: string | null | undefined,
  stopId: string | null | undefined
): VariantFares | null {
  const direct = resolveFareVariant(index, variantKey)
  if (direct) return direct
  if (!index || !variantKey || !stopId) return null

  const parts = variantKey.split('|')
  if (parts.length < 4) return null
  const [co, route, bound, serviceType] = parts
  let fallback: VariantFares | null = null
  for (const [key, value] of Object.entries(index.variants)) {
    const candidate = key.split('|')
    if (
      candidate.length !== 5 ||
      candidate[0] !== co ||
      candidate[1] !== route ||
      candidate[2] !== bound
    ) {
      continue
    }
    if (!value.stops.includes(stopId)) continue
    if (candidate[3] === serviceType) return value
    if (!fallback) fallback = value
  }
  return fallback
}

/**
 * Map each stop in the rendered route order to an index in the fare table.
 * Identical stop order short-circuits to an identity map. Otherwise stops are
 * matched by id in occurrence order, so circular routes keep their legs.
 */
export function mapRouteStopsToFareIndices(
  fare: VariantFares,
  stops: Array<{ stopId: string }>
): number[] {
  const count = stops.length
  if (count === fare.stops.length) {
    let matches = 0
    for (let i = 0; i < count; i += 1) {
      if (fare.stops[i] === stops[i]?.stopId) matches += 1
    }
    if (count === 0 || matches >= Math.ceil(count * 0.8)) {
      return Array.from({ length: count }, (_, index) => index)
    }
  }

  const queues = new Map<string, number[]>()
  fare.stops.forEach((stopId, index) => {
    const queue = queues.get(stopId)
    if (queue) queue.push(index)
    else queues.set(stopId, [index])
  })
  return stops.map((stop) => queues.get(stop.stopId)?.shift() ?? -1)
}

/**
 * Fare from one stop index to another, or null when the pair is not sold or
 * the boarding stop is at/after the alighting stop.
 */
export function fareForIndices(
  fare: VariantFares,
  fromIndex: number,
  toIndex: number
): number | null {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= toIndex ||
    fromIndex >= fare.fares.length
  ) {
    return null
  }
  const ranges = fare.fares[fromIndex]
  if (!ranges || ranges.length === 0) return null

  // First range whose inclusive destination end reaches the alighting stop.
  let low = 0
  let high = ranges.length
  while (low < high) {
    const mid = (low + high) >> 1
    if ((ranges[mid]?.[0] ?? 0) < toIndex) low = mid + 1
    else high = mid
  }
  if (low >= ranges.length) return null
  const price = ranges[low]?.[1]
  return typeof price === 'number' && Number.isFinite(price) && price >= 0 ? price : null
}
