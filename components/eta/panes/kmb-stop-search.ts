import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { pickLang, pickSecondaryName } from '@/lib/eta/pick-lang'
import { isKmbStop } from '@/lib/eta/types'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'

function formatStopName(stop: KmbStopSearchItem, lang: UiLanguage) {
  return pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
}

function formatStopSecondary(stop: KmbStopSearchItem, lang: UiLanguage) {
  return pickSecondaryName({ en: stop.nameEn, tc: stop.nameTc }, lang)
}

/**
 * Build a stop search index that carries everything both the contains
 * matcher and the StopSearch dropdown need, so the 6k stop list is
 * normalized once per pane load instead of once per consumer.
 */
export type StopSearchIndex = {
  /** Lowercased en|tc|sc names for the contains matcher. */
  normalizedNames: Map<string, string>
  /** Pre-parsed display rows keyed by stopId. */
  computedById: Map<string, StopSearchComputed>
  version: number
}

export type StopSearchComputed = {
  baseName: string
  stopCode: string | null
  displaySecondary: string
  displayName: string
  searchName: string
  searchSecondary: string
  searchCode: string
  normalized: string
}

export function buildStopSearchIndex(
  stops: KmbStopSearchItem[],
  lang: UiLanguage
): StopSearchIndex {
  const normalizedNames = new Map<string, string>()
  const computedById = new Map<string, StopSearchComputed>()
  for (const stop of stops) {
    const fullName = formatStopName(stop, lang)
    const parsed = parseKmbStopNameCached(fullName, { isKmb: isKmbStop(stop), lang })
    const baseName = parsed.name
    const stopCode = parsed.stopCode
    const displayName = baseName
    const displaySecondary = formatStopSecondary(stop, lang)

    const searchName = displayName.toLowerCase().trim()
    const searchSecondary = displaySecondary.toLowerCase().trim()
    const searchCode = (stopCode ?? '').toLowerCase().trim()

    const normalized = `${stop.nameEn.toLowerCase()}|${stop.nameTc.toLowerCase()}|${stop.nameSc.toLowerCase()}`
    normalizedNames.set(stop.stopId, normalized)
    computedById.set(stop.stopId, {
      baseName,
      stopCode,
      displaySecondary,
      displayName,
      searchName,
      searchSecondary,
      searchCode,
      normalized: `${stop.nameEn}|${stop.nameTc}|${stop.nameSc}|${baseName}|${stopCode ?? ''}`
        .toLowerCase()
        .trim(),
    })
  }
  return { normalizedNames, computedById, version: stops.length }
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
