import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchMtrSchedules } from '@/lib/eta/client'

import { fetchMtrSchedules as fetchMtrSchedulesDirect } from './mtr'

const BACKOFF_UNTIL_KEY = 'timoeta:mtr-backoff-until'
const BACKOFF_FAILURES_KEY = 'timoeta:mtr-backoff-failures'

let querySeq = 0
function uniqueQuery() {
  querySeq += 1
  return { line: 'TKL', sta: `TST${querySeq}`, lang: 'EN' as const }
}

beforeEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe('fetchMtrSchedules backoff', () => {
  it('does not record backoff on 503', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('boom', { status: 503 }))

    const result = await fetchMtrSchedules([uniqueQuery()])

    expect(result.errors).toHaveLength(1)
    expect(result.backoff).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(BACKOFF_UNTIL_KEY)).toBeNull()
  })

  it('records backoff on 429 without a generic retry first', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('rate limited', { status: 429 }))

    const result = await fetchMtrSchedules([uniqueQuery()])

    expect(result.errors).toHaveLength(1)
    expect(result.backoff).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(Number(sessionStorage.getItem(BACKOFF_UNTIL_KEY))).toBeGreaterThan(Date.now())
  })

  it('clears backoff after a fully clean batch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('rate limited', { status: 429 }))
    await fetchMtrSchedules([uniqueQuery()])
    expect(sessionStorage.getItem(BACKOFF_UNTIL_KEY)).not.toBeNull()

    // Simulate the backoff window expiring so the next batch can run clean.
    sessionStorage.removeItem(BACKOFF_UNTIL_KEY)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 1, data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const result = await fetchMtrSchedules([uniqueQuery()])

    expect(result.errors).toHaveLength(0)
    expect(result.backoff).toBe(false)
    expect(sessionStorage.getItem(BACKOFF_UNTIL_KEY)).toBeNull()
    expect(sessionStorage.getItem(BACKOFF_FAILURES_KEY)).toBe('0')
  })

  it('suppresses upstream calls for late batch items once a 429 lands', async () => {
    // Slow-network concurrency is 1, so the second fetcher starts only
    // after the first fetch settles. The first fetch must not retry on
    // 429 (getMtrSchedule uses retries: 0), leaving backoff recorded
    // before the late item rechecks inside its fetcher.
    const slowConnection = { saveData: false, effectiveType: '2g' }
    const navigatorSpy = vi.stubGlobal('navigator', { connection: slowConnection })
    expect(navigatorSpy).toBeDefined()
    try {
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('rate limited', { status: 429 }))

      const result = await fetchMtrSchedulesDirect([uniqueQuery(), uniqueQuery()])

      expect(result.errors).toHaveLength(2)
      expect(result.backoff).toBe(true)
      // First item fires (and records backoff); the late item rechecks
      // inside its fetcher and throws before touching the network.
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('fetchMtrSchedules client dedupe key', () => {
  it('shares one in-flight batch regardless of query order', async () => {
    const directModule = await import('./mtr')
    const spy = vi
      .spyOn(directModule, 'fetchMtrSchedules')
      .mockResolvedValue({ byKey: {}, errors: [], cached: 0, fetched: 0, backoff: false })

    try {
      const queries = [
        { line: 'TKL', sta: 'TST', lang: 'EN' as const },
        { line: 'ISL', sta: 'CEN', lang: 'EN' as const },
      ]
      const reversed = [...queries].reverse()

      const [first, second] = await Promise.all([
        fetchMtrSchedules(queries),
        fetchMtrSchedules(reversed),
      ])

      expect(spy).toHaveBeenCalledTimes(1)
      expect(first).toBe(second)
    } finally {
      spy.mockRestore()
    }
  })
})
