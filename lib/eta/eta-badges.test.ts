import { describe, expect, it } from 'vitest'

import { resolveEtaBadge, sortBySoonestMinutes } from './eta-badges'

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
