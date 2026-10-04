/**
 * Fare table for one route variant, keyed by 1-indexed stop sequence.
 * hk-bus-eta stores fares as "fare from this stop to the terminus", so the
 * values only go down along the route. Stops without a usable fare are
 * simply absent from the map.
 */
export function getFaresBySeq(entry: { fares: unknown }, co: string): Record<number, number> {
  const raw: unknown = Array.isArray(entry.fares)
    ? entry.fares
    : entry.fares && typeof entry.fares === 'object'
      ? (entry.fares as Record<string, string[] | undefined>)[co]
      : undefined
  if (!Array.isArray(raw)) return {}

  const bySeq: Record<number, number> = {}
  raw.forEach((fareValue, idx) => {
    if (typeof fareValue === 'string' && fareValue.trim() === '') return
    if (typeof fareValue !== 'string' && typeof fareValue !== 'number') return
    const fare = Number(fareValue)
    if (!Number.isFinite(fare) || fare < 0) return
    bySeq[idx + 1] = fare
  })
  return bySeq
}

export type FareSection<T> = {
  /** Fare shared by every stop in this section, null when unknown. */
  fare: number | null
  items: T[]
}

export type ConsecutiveSection<T, K> = {
  /** Key shared by every stop in this section. */
  key: K
  items: T[]
}

/**
 * Group consecutive items that share the same key into sections.
 * A key change starts a new section. Unknown keys group together but
 * render without a label.
 */
export function groupConsecutiveBy<T, K>(
  items: T[],
  getKey: (item: T, index: number) => K
): ConsecutiveSection<T, K>[] {
  const sections: ConsecutiveSection<T, K>[] = []
  items.forEach((item, index) => {
    const key = getKey(item, index)
    const last = sections[sections.length - 1]
    if (last && last.key === key) {
      last.items.push(item)
    } else {
      sections.push({ key, items: [item] })
    }
  })
  return sections
}

/**
 * Group consecutive stops that share the same fare into sections.
 * A fare change starts a new section. Unknown fares group together but
 * render without a divider.
 */
export function groupIntoFareSections<T>(
  items: T[],
  getFare: (item: T, index: number) => number | null
): FareSection<T>[] {
  return groupConsecutiveBy(items, getFare).map(({ key, items }) => ({
    fare: key,
    items,
  }))
}
