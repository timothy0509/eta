// Pure stop-search pipeline shared by the search worker and the
// main-thread fallback. Runs with no DOM or React so it executes
// identically in both. The ranking is the long-standing dropdown
// behavior: exact/prefix fast path, Fuse fallback, boost rescore,
// sequential-code grouping. Tweak nothing here for speed; speed comes
// from _where_ this runs (a worker), not _what_ it computes.

import type { KmbStopSearchItem } from '@/lib/eta/types'

export type StopSearchDoc = {
  stopId: string
  baseName: string
  stopCode: string | null
  displaySecondary: string
  displayName: string
  /** Search fields with better weighting */
  searchName: string
  searchSecondary: string
  searchCode: string
  /** Catch-all fallback for fuzzy matches */
  normalized: string
  stop: KmbStopSearchItem
}

export type StopGroup = {
  id: string // Unique key for React
  baseName: string
  codes: string[]
  stops: KmbStopSearchItem[]
  displayName: string
  displayCodes: string
  displaySecondary: string
}

type FuseInstance = {
  search: (query: string) => Array<{ item: StopSearchDoc; score?: number }>
}

/**
 * Parse a stop code into prefix, numeric, and optional lowercase suffix parts.
 * e.g., "KT313" → { prefix: "KT", num: 313, suffix: "" }
 * e.g., "KT120a" → { prefix: "KT", num: 120, suffix: "a" }
 */
export function parseCodeParts(
  code: string
): { prefix: string; num: number; suffix: string } | null {
  const match = code.match(/^([A-Z]{1,2})(\d+)([a-z]?)$/)
  if (!match) return null
  return { prefix: match[1], num: parseInt(match[2], 10), suffix: match[3] ?? '' }
}

/**
 * Check if a set of codes are sequential (same prefix, same suffix, consecutive numbers).
 */
export function areCodesSequential(codes: string[]): boolean {
  if (codes.length <= 1) return true
  const parsed = codes.map(parseCodeParts).filter(Boolean) as {
    prefix: string
    num: number
    suffix: string
  }[]
  if (parsed.length !== codes.length) return false

  const prefix = parsed[0].prefix
  const suffix = parsed[0].suffix
  if (!parsed.every((p) => p.prefix === prefix && p.suffix === suffix)) return false

  const nums = parsed.map((p) => p.num).sort((a, b) => a - b)
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) return false
  }
  return true
}

/**
 * Format a range of sequential codes.
 * e.g., ["KT313", "KT314", "KT315", "KT316"] → "KT313-KT316"
 */
export function formatCodeRange(codes: string[]): string {
  if (codes.length === 0) return ''
  if (codes.length === 1) return codes[0]

  const sorted = [...codes].sort((a, b) => {
    const pa = parseCodeParts(a)
    const pb = parseCodeParts(b)
    if (!pa || !pb) return a.localeCompare(b)
    if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix)
    if (pa.num !== pb.num) return pa.num - pb.num
    return pa.suffix.localeCompare(pb.suffix)
  })

  return `${sorted[0]}-${sorted[sorted.length - 1]}`
}

/**
 * Group stops by their base name (without code) and merge those with sequential codes.
 * Handles multiple separate sequential sets (e.g., KT313-KT316 AND KT681-KT683).
 * Non-sequential stops remain as individual items.
 */
export function groupStopsByName(stops: StopSearchDoc[]): StopGroup[] {
  const byBaseName = new Map<string, StopSearchDoc[]>()
  for (const stop of stops) {
    const baseName = stop.baseName
    if (!byBaseName.has(baseName)) {
      byBaseName.set(baseName, [])
    }
    byBaseName.get(baseName)!.push(stop)
  }

  const result: StopGroup[] = []

  for (const [baseName, items] of byBaseName) {
    const withCodes = items.filter((i) => i.stopCode !== null)
    const withoutCodes = items.filter((i) => i.stopCode === null)

    withCodes.sort((a, b) => {
      const pa = parseCodeParts(a.stopCode!)
      const pb = parseCodeParts(b.stopCode!)
      if (!pa || !pb) return 0
      if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix)
      if (pa.num !== pb.num) return pa.num - pb.num
      return pa.suffix.localeCompare(pb.suffix)
    })

    const runs: StopSearchDoc[][] = []
    for (const item of withCodes) {
      const lastRun = runs[runs.length - 1]
      if (!lastRun) {
        runs.push([item])
        continue
      }

      const lastItem = lastRun[lastRun.length - 1]
      const lastParts = parseCodeParts(lastItem.stopCode!)
      const currParts = parseCodeParts(item.stopCode!)

      if (
        lastParts &&
        currParts &&
        lastParts.prefix === currParts.prefix &&
        lastParts.suffix === currParts.suffix &&
        currParts.num === lastParts.num + 1
      ) {
        lastRun.push(item)
      } else {
        runs.push([item])
      }
    }

    for (const run of runs) {
      if (run.length >= 2) {
        const codes = run.map((r) => r.stopCode!).filter(Boolean)
        const runStops = run.map((r) => r.stop)
        result.push({
          id: `group:${runStops.map((s) => s.stopId).join(',')}`,
          baseName,
          codes,
          stops: runStops,
          displayName: baseName,
          displayCodes: `(${formatCodeRange(codes)})`,
          displaySecondary: run[0]?.displaySecondary ?? '',
        })
      } else {
        const item = run[0]
        result.push({
          id: `stop:${item.stop.stopId}`,
          baseName,
          codes: item.stopCode ? [item.stopCode] : [],
          stops: [item.stop],
          displayName: baseName,
          displayCodes: item.stopCode ? `(${item.stopCode})` : '',
          displaySecondary: item.displaySecondary,
        })
      }
    }

    for (const item of withoutCodes) {
      result.push({
        id: `stop:${item.stop.stopId}`,
        baseName,
        codes: [],
        stops: [item.stop],
        displayName: baseName,
        displayCodes: '',
        displaySecondary: item.displaySecondary,
      })
    }
  }

  return result
}

function prefixMatches(docs: StopSearchDoc[], needle: string): StopSearchDoc[] {
  const out: StopSearchDoc[] = []
  for (const item of docs) {
    if (
      (item.searchCode && item.searchCode.startsWith(needle)) ||
      item.searchName.startsWith(needle) ||
      item.searchSecondary.startsWith(needle) ||
      item.searchCode === needle ||
      item.searchName === needle
    ) {
      out.push(item)
      if (out.length >= 60) break
    }
  }
  return out
}

export function searchStopGroups(
  docs: StopSearchDoc[],
  fuse: FuseInstance | null,
  rawQuery: string
): StopGroup[] {
  if (!rawQuery.trim()) {
    // Default: show first 12 stops, grouped
    return groupStopsByName(docs.slice(0, 30)).slice(0, 12)
  }

  const needle = rawQuery.trim().toLowerCase()

  // Fast path: exact and prefix matches run without Fuse so short
  // queries stay instant while the fuzzy index loads.
  const fast = prefixMatches(docs, needle)
  let hits: Array<{ item: StopSearchDoc; score?: number }>
  if (fast.length >= 20 || !fuse) {
    hits = fast.map((item) => ({ item, score: 0 }))
  } else {
    const fused = fuse.search(needle).slice(0, 80)
    const seen = new Set(fast.map((f) => f.stopId))
    hits = [
      ...fast.map((item) => ({ item, score: 0 })),
      ...fused.filter((h) => !seen.has(h.item.stopId)),
    ].slice(0, 80)
  }

  // Prefer exact/prefix matches (stop code or name) over generic fuzzy score.
  // This improves accuracy for common user behavior:
  // - typing stop code prefixes (KT31…)
  // - typing station name prefixes
  type ScoredStop = {
    item: StopSearchDoc
    fuseScore: number
    boost: number
  }

  const scored = hits
    .map((h: { item: StopSearchDoc; score?: number }): ScoredStop => {
      const item = h.item

      const exact =
        (item.searchCode && item.searchCode === needle) ||
        item.searchName === needle ||
        item.searchSecondary === needle

      const prefix =
        (item.searchCode && item.searchCode.startsWith(needle)) ||
        item.searchName.startsWith(needle) ||
        item.searchSecondary.startsWith(needle)

      const includes =
        (item.searchCode && item.searchCode.includes(needle)) ||
        item.searchName.includes(needle) ||
        item.searchSecondary.includes(needle)

      // Fuse score is lower-is-better; normalize missing to a mediocre score.
      const fuseScore = h.score ?? 0.5

      const boost = exact ? 0 : prefix ? 1 : includes ? 2 : 3
      return { item, fuseScore, boost }
    })
    .sort((a: ScoredStop, b: ScoredStop) => {
      if (a.boost !== b.boost) return a.boost - b.boost
      return a.fuseScore - b.fuseScore
    })
    .slice(0, 60)

  return groupStopsByName(scored.map((s: ScoredStop) => s.item)).slice(0, 20)
}

export type StopSearchSession = {
  search: (rawQuery: string) => StopGroup[]
}

/** Main → worker messages. Docs are plain data, cheap to clone. */
export type StopSearchWorkerInit = { type: 'init'; session: number; docs: StopSearchDoc[] }
export type StopSearchWorkerQuery = { type: 'search'; session: number; id: number; query: string }

/** Worker → main messages. Stale sessions/ids are ignored by the caller. */
export type StopSearchWorkerEvent = {
  type: 'results'
  session: number
  id: number
  query: string
  groups: StopGroup[]
}

/**
 * Build a search session over a snapshot of docs: lazy-loads fuse.js and
 * builds the fuzzy index. The caller rebuilds the session when the docs
 * change. Same code runs in the worker and the main-thread fallback, so
 * both return identical results.
 */
export async function createStopSearchSession(docs: StopSearchDoc[]): Promise<StopSearchSession> {
  const mod = await import('fuse.js')
  const fuse = new mod.default(docs, {
    // Lower threshold = stricter matching = higher precision.
    // We also explicitly boost exact/prefix matches in post-processing.
    threshold: 0.28,
    ignoreLocation: true,
    minMatchCharLength: 2,
    includeScore: true,
    shouldSort: true,
    keys: [
      { name: 'searchCode', weight: 0.55 },
      { name: 'searchName', weight: 0.3 },
      { name: 'searchSecondary', weight: 0.1 },
      { name: 'normalized', weight: 0.05 },
    ],
  })
  return {
    search: (rawQuery: string) => searchStopGroups(docs, fuse, rawQuery),
  }
}
