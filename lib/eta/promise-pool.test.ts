import { describe, expect, it } from 'vitest'

import { promisePool } from './promise-pool'

describe('promisePool', () => {
  it('handles empty input', async () => {
    const results = await promisePool([], 2, async () => 'value')
    expect(results).toEqual([])
  })

  it('limits concurrency and preserves order', async () => {
    const active: number[] = []
    let maxActive = 0

    const results = await promisePool([1, 2, 3, 4], 2, async (value) => {
      active.push(value)
      maxActive = Math.max(maxActive, active.length)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active.pop()
      return value * 2
    })

    expect(maxActive).toBe(2)
    expect(results).toEqual([
      { status: 'fulfilled', value: 2 },
      { status: 'fulfilled', value: 4 },
      { status: 'fulfilled', value: 6 },
      { status: 'fulfilled', value: 8 },
    ])
  })

  it('captures errors without failing the pool', async () => {
    const results = await promisePool([1, 2], 1, async (value) => {
      if (value === 2) throw new Error('boom')
      return value
    })

    expect(results[0]).toMatchObject({ status: 'fulfilled', value: 1 })
    expect(results[1]).toMatchObject({ status: 'rejected' })
  })

  it('processes single item with concurrency 1', async () => {
    const results = await promisePool([5], 1, async (value) => value + 1)
    expect(results).toEqual([{ status: 'fulfilled', value: 6 }])
  })
})
