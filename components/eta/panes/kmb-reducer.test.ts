import { describe, expect, it } from 'vitest'

import { etaReducer, initialEtaState } from './kmb-reducer'

describe('etaReducer stale flags', () => {
  it('merges visible-only refresh flags instead of dropping hidden stops', () => {
    const withHidden = etaReducer(initialEtaState, {
      type: 'REFRESH_SUCCESS',
      payload: {
        byStopId: {},
        loadedStopIds: ['a', 'b'],
        staleByStopId: {
          a: { stale: true, ageMs: 60_000 },
          b: { stale: false, ageMs: 0 },
        },
      },
    })

    const next = etaReducer(withHidden, {
      type: 'REFRESH_SUCCESS',
      payload: {
        byStopId: {},
        loadedStopIds: ['a', 'b'],
        staleByStopId: { a: { stale: false, ageMs: 0 } },
      },
    })

    // Stop b was off-screen and untouched: its stale flag survives.
    expect(next.staleByStopId.b).toEqual({ stale: false, ageMs: 0 })
    expect(next.staleByStopId.a).toEqual({ stale: false, ageMs: 0 })
    expect(next.stale).toBe(false)
  })

  it('prunes stops that left the loaded set', () => {
    const withHidden = etaReducer(initialEtaState, {
      type: 'REFRESH_SUCCESS',
      payload: {
        byStopId: {},
        loadedStopIds: ['a', 'b'],
        staleByStopId: {
          a: { stale: true, ageMs: 60_000 },
          b: { stale: false, ageMs: 0 },
        },
      },
    })

    const next = etaReducer(withHidden, {
      type: 'REFRESH_SUCCESS',
      payload: {
        byStopId: {},
        loadedStopIds: ['c'],
        staleByStopId: { c: { stale: false, ageMs: 0 } },
      },
    })

    expect(next.staleByStopId).toEqual({ c: { stale: false, ageMs: 0 } })
    expect(next.stale).toBe(false)
  })

  it('keeps the global stale flag when any merged stop is stale', () => {
    const state = etaReducer(initialEtaState, {
      type: 'REFRESH_SUCCESS',
      payload: {
        byStopId: {},
        loadedStopIds: ['a', 'b'],
        staleByStopId: { a: { stale: false, ageMs: 0 } },
      },
    })

    const next = etaReducer(state, {
      type: 'REFRESH_SUCCESS',
      payload: {
        byStopId: {},
        loadedStopIds: ['a', 'b'],
        staleByStopId: { b: { stale: true, ageMs: null } },
      },
    })

    expect(next.stale).toBe(true)
  })

  it('keeps previous rows on a transient refresh failure', () => {
    const loaded = etaReducer(initialEtaState, {
      type: 'REFRESH_SUCCESS',
      payload: {
        byStopId: { a: [] },
        loadedStopIds: ['a'],
        staleByStopId: { a: { stale: false, ageMs: 0 } },
      },
    })

    const next = etaReducer(loaded, {
      type: 'REFRESH_ERROR',
      error: 'boom',
      keepPrevious: true,
    })

    expect(next.byStopId).toEqual({ a: [] })
    expect(next.stale).toBe(true)
    expect(next.staleByStopId.a?.stale).toBe(true)
  })
})
