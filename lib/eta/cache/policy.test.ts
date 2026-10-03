import { describe, expect, it } from 'vitest'

import { CACHE_POLICIES } from './policy'
import { STALE_THRESHOLDS_MS } from '../stale'

describe('live ETA cache policies', () => {
  it('keeps TTLs at or above the default 15s poll so repeat polls hit cache', () => {
    expect(CACHE_POLICIES.kmbStopEta.ttlMs).toBeGreaterThanOrEqual(15_000)
    expect(CACHE_POLICIES.mtrSchedule.ttlMs).toBeGreaterThanOrEqual(15_000)
    expect(CACHE_POLICIES.lrtSchedule.ttlMs).toBeGreaterThanOrEqual(15_000)
    expect(CACHE_POLICIES.lrtRouteEta.ttlMs).toBeGreaterThanOrEqual(15_000)
  })

  it('matches stale windows to the UI stale thresholds', () => {
    expect(CACHE_POLICIES.kmbStopEta.maxStaleMs).toBe(STALE_THRESHOLDS_MS.kmb)
    expect(CACHE_POLICIES.mtrSchedule.maxStaleMs).toBe(STALE_THRESHOLDS_MS.mtr)
    expect(CACHE_POLICIES.lrtSchedule.maxStaleMs).toBe(STALE_THRESHOLDS_MS.lrt)
    expect(CACHE_POLICIES.lrtRouteEta.maxStaleMs).toBe(STALE_THRESHOLDS_MS.lrt)
  })
})
