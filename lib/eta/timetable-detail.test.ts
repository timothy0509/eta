import { describe, expect, it } from 'vitest'

import {
  clampTimetableDetail,
  simplifyHeadwayWindows,
  TIMETABLE_DETAIL_DEFAULT,
} from '@/lib/eta/timetable-detail'

describe('clampTimetableDetail', () => {
  it('keeps values inside the 1-5 band', () => {
    expect(clampTimetableDetail(3)).toBe(3)
    expect(clampTimetableDetail(0)).toBe(1)
    expect(clampTimetableDetail(9)).toBe(5)
    expect(clampTimetableDetail(Number.NaN)).toBe(TIMETABLE_DETAIL_DEFAULT)
    expect(clampTimetableDetail(undefined)).toBe(TIMETABLE_DETAIL_DEFAULT)
  })
})

describe('simplifyHeadwayWindows', () => {
  it('returns every window untouched at max detail', () => {
    const windows = [
      [335, 341, 6],
      [341, 347, 6],
      [347, 353, 7],
    ] as [number, number, number][]
    const merged = simplifyHeadwayWindows(windows, 5)
    expect(merged).toHaveLength(3)
    expect(merged[0]).toEqual({ startMin: 335, endMin: 341, minHeadway: 6, maxHeadway: 6 })
  })

  it('merges contiguous near-identical headways at mid detail', () => {
    const windows = [
      [335, 341, 6],
      [341, 347, 7],
      [347, 353, 6],
    ] as [number, number, number][]
    const merged = simplifyHeadwayWindows(windows, 3)
    expect(merged).toHaveLength(1)
    expect(merged[0]).toEqual({ startMin: 335, endMin: 353, minHeadway: 6, maxHeadway: 7 })
  })

  it('keeps windows with very different headways apart until level 1', () => {
    const windows = [
      [360, 600, 6],
      [600, 840, 20],
    ] as [number, number, number][]
    expect(simplifyHeadwayWindows(windows, 4)).toHaveLength(2)
    expect(simplifyHeadwayWindows(windows, 2)).toHaveLength(2)
    const collapsed = simplifyHeadwayWindows(windows, 1)
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]).toEqual({ startMin: 360, endMin: 840, minHeadway: 6, maxHeadway: 20 })
  })

  it('does not merge across service gaps except at level 1', () => {
    const windows = [
      [360, 420, 6],
      [900, 960, 6],
    ] as [number, number, number][]
    expect(simplifyHeadwayWindows(windows, 4)).toHaveLength(2)
    expect(simplifyHeadwayWindows(windows, 1)).toHaveLength(1)
  })
})
