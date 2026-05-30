import { describe, expect, it, vi } from 'vitest'
import { promisePool } from './promise-pool'

describe('promisePool', () => {
  it('processes all items with concurrency 1', async () => {
    const items = [1, 2, 3]
    const worker = vi.fn(async (n: number) => n * 2)

    const results = await promisePool(items, 1, worker)

    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({ status: 'fulfilled', value: 2 })
    expect(results[1]).toEqual({ status: 'fulfilled', value: 4 })
    expect(results[2]).toEqual({ status: 'fulfilled', value: 6 })
    expect(worker).toHaveBeenCalledTimes(3)
  })

  it('respects concurrency limit', async () => {
    const items = [1, 2, 3, 4, 5]
    let maxConcurrent = 0
    let currentConcurrent = 0

    const worker = async (n: number) => {
      currentConcurrent += 1
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
      await new Promise((resolve) => setTimeout(resolve, 10))
      currentConcurrent -= 1
      return n
    }

    await promisePool(items, 2, worker)

    expect(maxConcurrent).toBeLessThanOrEqual(2)
  })

  it('handles errors without stopping other items', async () => {
    const items = [1, 2, 3]
    const worker = vi.fn(async (n: number) => {
      if (n === 2) throw new Error('fail')
      return n
    })

    const results = await promisePool(items, 1, worker)

    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 })
    expect(results[1]).toEqual({ status: 'rejected', reason: expect.any(Error) })
    expect(results[2]).toEqual({ status: 'fulfilled', value: 3 })
  })

  it('returns empty array for empty input', async () => {
    const results = await promisePool([], 3, vi.fn())
    expect(results).toEqual([])
  })

  it('processes all items with high concurrency', async () => {
    const items = [1, 2, 3, 4, 5]
    const worker = vi.fn(async (n: number) => n)

    const results = await promisePool(items, 10, worker)

    expect(results).toHaveLength(5)
    for (let i = 0; i < 5; i++) {
      expect(results[i]).toEqual({ status: 'fulfilled', value: i + 1 })
    }
  })

  it('maintains result order matching input order', async () => {
    const items = ['a', 'b', 'c']
    const worker = async (item: string) => {
      // Reverse processing time to test ordering
      if (item === 'a') await new Promise((r) => setTimeout(r, 30))
      if (item === 'b') await new Promise((r) => setTimeout(r, 10))
      return item.toUpperCase()
    }

    const results = await promisePool(items, 3, worker)

    expect(results[0]).toEqual({ status: 'fulfilled', value: 'A' })
    expect(results[1]).toEqual({ status: 'fulfilled', value: 'B' })
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'C' })
  })

  it('handles all errors', async () => {
    const items = [1, 2, 3]
    const worker = vi.fn(async () => {
      throw new Error('always fails')
    })

    const results = await promisePool(items, 2, worker)

    expect(results).toHaveLength(3)
    for (const result of results) {
      expect(result.status).toBe('rejected')
    }
  })

  it('uses minimum concurrency of 1', async () => {
    const items = [1, 2]
    const worker = vi.fn(async (n: number) => n)

    const results = await promisePool(items, 0, worker)

    expect(results).toHaveLength(2)
    expect(worker).toHaveBeenCalledTimes(2)
  })

  it('handles mixed fulfilled and rejected results', async () => {
    const items = [1, 2, 3, 4]
    const worker = async (n: number) => {
      if (n % 2 === 0) throw new Error(`error for ${n}`)
      return n
    }

    const results = await promisePool(items, 2, worker)

    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected')
    expect(results[2].status).toBe('fulfilled')
    expect(results[3].status).toBe('rejected')
  })
})
