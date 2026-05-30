import type { KmbStopSearchItem } from '@/lib/eta/types'

export type StopSearchIndex = {
  normalizedNames: Map<string, string>
  version: number
}

export function buildStopSearchIndex(stops: KmbStopSearchItem[]): StopSearchIndex {
  const normalizedNames = new Map<string, string>()
  for (const stop of stops) {
    const normalized = `${stop.nameEn.toLowerCase()}|${stop.nameTc.toLowerCase()}|${stop.nameSc.toLowerCase()}`
    normalizedNames.set(stop.stopId, normalized)
  }
  return { normalizedNames, version: stops.length }
}

export function searchStopsByContains(
  stops: KmbStopSearchItem[],
  index: StopSearchIndex,
  query: string
): string[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  const result: string[] = []
  for (const stop of stops) {
    const normalized = index.normalizedNames.get(stop.stopId)
    if (normalized && normalized.includes(needle)) {
      result.push(stop.stopId)
    }
  }
  return result
}
