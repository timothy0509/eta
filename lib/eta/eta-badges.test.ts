import { describe, expect, it } from 'vitest'

import {
  hasWheelchairAccess,
  resolveEtaBadge,
  sortBySoonestMinutes,
  timelineFraction,
} from './eta-badges'

describe('resolveEtaBadge mtr timetype mapping', () => {
  it('maps timetype 1 to scheduled', () => {
    expect(resolveEtaBadge({ mode: 'mtr', timetype: '1' })).toBe('scheduled')
    expect(resolveEtaBadge({ mode: 'mtr', timetype: 1 })).toBe('scheduled')
  })

  it('maps other timetypes to realtime', () => {
    expect(resolveEtaBadge({ mode: 'mtr', timetype: '0' })).toBe('realtime')
    expect(resolveEtaBadge({ mode: 'mtr', timetype: '2' })).toBe('realtime')
  })

  it('falls back to scheduled when timetype is missing', () => {
    expect(resolveEtaBadge({ mode: 'mtr' })).toBe('scheduled')
    expect(resolveEtaBadge({ mode: 'mtr', timetype: '' })).toBe('scheduled')
    expect(resolveEtaBadge({ mode: 'mtr', timetype: null })).toBe('scheduled')
  })
})

describe('resolveEtaBadge kmb rmk heuristic', () => {
  it('marks Scheduled Bus remarks as scheduled even when fresh', () => {
    const now = Date.now()
    expect(
      resolveEtaBadge({
        mode: 'kmb',
        etaSeq: 1,
        rmk_en: 'Scheduled Bus',
        lastUpdatedAt: now - 10_000,
        now,
      })
    ).toBe('scheduled')
  })

  it('marks 原定班次 remarks as scheduled', () => {
    const now = Date.now()
    expect(
      resolveEtaBadge({
        mode: 'kmb',
        etaSeq: 1,
        rmk_tc: '原定班次',
        lastUpdatedAt: now - 10_000,
        now,
      })
    ).toBe('scheduled')
  })

  it('marks fresh eta_seq departures as realtime', () => {
    const now = Date.now()
    expect(resolveEtaBadge({ mode: 'kmb', etaSeq: 1, lastUpdatedAt: now - 10_000, now })).toBe(
      'realtime'
    )
  })

  it('marks stale departures as scheduled', () => {
    const now = Date.now()
    expect(resolveEtaBadge({ mode: 'kmb', etaSeq: 1, lastUpdatedAt: now - 61_000, now })).toBe(
      'scheduled'
    )
  })
})

describe('resolveEtaBadge lrt heuristic', () => {
  it('marks fresh data as realtime', () => {
    const now = Date.now()
    expect(resolveEtaBadge({ mode: 'lrt', lastUpdatedAt: now - 10_000, now })).toBe('realtime')
  })

  it('marks stale data as scheduled', () => {
    const now = Date.now()
    expect(resolveEtaBadge({ mode: 'lrt', lastUpdatedAt: now - 91_000, now })).toBe('scheduled')
  })
})

describe('hasWheelchairAccess', () => {
  it('detects wheelchair and low-floor keywords', () => {
    expect(hasWheelchairAccess(undefined, undefined, 'Wheelchair accessible bus')).toBe(true)
    expect(hasWheelchairAccess('低地台巴士')).toBe(true)
    expect(hasWheelchairAccess(undefined, undefined, 'Low-floor bus')).toBe(true)
  })

  it('stays hidden for scheduled or empty remarks', () => {
    expect(hasWheelchairAccess('原定班次', '原定班次', 'Scheduled Bus')).toBe(false)
    expect(hasWheelchairAccess('', '', '')).toBe(false)
    expect(hasWheelchairAccess()).toBe(false)
  })
})

describe('sortBySoonestMinutes', () => {
  it('sorts soonest first and sinks missing times', () => {
    const items = [{ m: 12 }, { m: null }, { m: 3 }, { m: 0 }]
    expect(sortBySoonestMinutes(items, (item) => item.m).map((item) => item.m)).toEqual([
      0,
      3,
      12,
      null,
    ])
  })

  it('does not mutate the input', () => {
    const items = [{ m: 5 }, { m: 1 }]
    sortBySoonestMinutes(items, (item) => item.m)
    expect(items.map((item) => item.m)).toEqual([5, 1])
  })
})

describe('timelineFraction', () => {
  it('parks arriving departures at the stop end', () => {
    expect(timelineFraction(0)).toBe(1)
    expect(timelineFraction(-2)).toBe(1)
  })

  it('scales minutes across the window', () => {
    expect(timelineFraction(30)).toBe(0)
    expect(timelineFraction(15)).toBe(0.5)
    expect(timelineFraction(60)).toBe(0)
  })

  it('parks missing times at the start', () => {
    expect(timelineFraction(null)).toBe(0)
    expect(timelineFraction(Number.NaN)).toBe(0)
  })
})
