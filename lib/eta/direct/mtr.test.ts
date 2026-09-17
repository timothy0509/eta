import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchMtrSchedules } from './mtr'

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
})
