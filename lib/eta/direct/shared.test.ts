import { beforeEach, describe, expect, it, vi } from 'vitest'

import { idbGet, idbSet } from '@/lib/eta/cache/idb'
import type { CachePolicy } from '@/lib/eta/cache/policy'
import { getCachedValue } from '@/lib/eta/direct/shared'

vi.mock('@/lib/eta/cache/idb', () => ({
  idbGet: vi.fn(),
  idbSet: vi.fn(),
}))

const mockIdbGet = vi.mocked(idbGet)
const mockIdbSet = vi.mocked(idbSet)

const persistPolicy: CachePolicy = { ttlMs: 8000, persist: true }

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('getCachedValue abort handling', () => {
  beforeEach(() => {
    mockIdbGet.mockReset()
    mockIdbSet.mockReset()
    mockIdbGet.mockResolvedValue(null)
  })

  it('skips idbGet and fetcher start when already aborted', async () => {
    const fetcher = vi.fn(async () => 'value')
    const controller = new AbortController()
    controller.abort()

    await expect(
      getCachedValue({
        key: 'abort-skip-key',
        policyKey: 'test-shared-abort-skip',
        policy: persistPolicy,
        fetcher,
        signal: controller.signal,
      })
    ).rejects.toThrow(expect.objectContaining({ name: 'AbortError' }))

    expect(mockIdbGet).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
    expect(mockIdbSet).not.toHaveBeenCalled()
  })

  it('performs no cache write after mid-flight abort and clears inFlight', async () => {
    const gate = createDeferred<string>()
    const fetcher = vi.fn(() => gate.promise)
    const controller = new AbortController()

    const pending = getCachedValue({
      key: 'abort-nowrite-key',
      policyKey: 'test-shared-abort-nowrite',
      policy: persistPolicy,
      fetcher,
      signal: controller.signal,
    })

    await new Promise((resolve) => setTimeout(resolve, 10))
    controller.abort()
    await expect(pending).rejects.toThrow(expect.objectContaining({ name: 'AbortError' }))
    expect(fetcher).toHaveBeenCalledTimes(1)

    gate.resolve('late-value')
    await gate.promise
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockIdbSet).not.toHaveBeenCalled()

    const followUpFetcher = vi.fn(async () => 'fresh-value')
    const followUp = await getCachedValue({
      key: 'abort-nowrite-key',
      policyKey: 'test-shared-abort-nowrite',
      policy: persistPolicy,
      fetcher: followUpFetcher,
    })

    expect(followUp.value).toBe('fresh-value')
    expect(followUpFetcher).toHaveBeenCalledTimes(1)
  })
})
