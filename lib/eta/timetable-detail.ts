import type { HeadwayWindow } from '@/lib/eta/headway/types'

export const TIMETABLE_DETAIL_MIN = 1
export const TIMETABLE_DETAIL_MAX = 5
export const TIMETABLE_DETAIL_DEFAULT = 5

/** Clamp a stored detail level into the 1-5 slider band. */
export function clampTimetableDetail(value: unknown): number {
  const n = typeof value === 'number' ? value : TIMETABLE_DETAIL_DEFAULT
  if (Number.isNaN(n)) return TIMETABLE_DETAIL_DEFAULT
  return Math.min(TIMETABLE_DETAIL_MAX, Math.max(TIMETABLE_DETAIL_MIN, Math.round(n)))
}

export type MergedHeadwayWindow = {
  startMin: number
  endMin: number
  minHeadway: number
  maxHeadway: number
}

const TOLERANCE_BY_DETAIL: Record<number, number> = {
  4: 1,
  3: 2,
  2: 4,
}

/**
 * Merge contiguous frequency windows whose headways stay within the detail
 * level's tolerance. Level 5 returns every GTFS window untouched. Level 1
 * collapses the whole day into one span with the shortest to longest
 * headway. Middle levels merge only touching windows (up to a 1 min rounding
 * gap) so separate peaks never fuse.
 */
export function simplifyHeadwayWindows(
  windows: HeadwayWindow[],
  detail: number
): MergedHeadwayWindow[] {
  const level = clampTimetableDetail(detail)
  const sorted = [...windows].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (sorted.length === 0) return []
  if (level >= TIMETABLE_DETAIL_MAX) {
    return sorted.map(([startMin, endMin, headwayMin]) => ({
      startMin,
      endMin,
      minHeadway: headwayMin,
      maxHeadway: headwayMin,
    }))
  }
  if (level <= TIMETABLE_DETAIL_MIN) {
    let startMin = sorted[0]![0]
    let endMin = sorted[0]![1]
    let minHeadway = sorted[0]![2]
    let maxHeadway = sorted[0]![2]
    for (const [s, e, h] of sorted.slice(1)) {
      if (s < startMin) startMin = s
      if (e > endMin) endMin = e
      if (h < minHeadway) minHeadway = h
      if (h > maxHeadway) maxHeadway = h
    }
    return [{ startMin, endMin, minHeadway, maxHeadway }]
  }
  const tolerance = TOLERANCE_BY_DETAIL[level] ?? 2
  const merged: MergedHeadwayWindow[] = []
  let cur: MergedHeadwayWindow = {
    startMin: sorted[0]![0],
    endMin: sorted[0]![1],
    minHeadway: sorted[0]![2],
    maxHeadway: sorted[0]![2],
  }
  for (const [s, e, h] of sorted.slice(1)) {
    const contiguous = s <= cur.endMin + 1
    const nextMin = Math.min(cur.minHeadway, h)
    const nextMax = Math.max(cur.maxHeadway, h)
    if (contiguous && nextMax - nextMin <= tolerance) {
      cur = {
        startMin: cur.startMin,
        endMin: Math.max(cur.endMin, e),
        minHeadway: nextMin,
        maxHeadway: nextMax,
      }
    } else {
      merged.push(cur)
      cur = { startMin: s, endMin: e, minHeadway: h, maxHeadway: h }
    }
  }
  merged.push(cur)
  return merged
}
