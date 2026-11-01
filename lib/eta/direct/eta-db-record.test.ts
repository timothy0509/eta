import { beforeEach, describe, expect, it, vi } from 'vitest'

const idbGet = vi.fn()
const idbSet = vi.fn(async () => {})
const getEtaDbSnapshot = vi.fn()

vi.mock('@/lib/eta/cache/idb', () => ({ idbGet, idbSet }))
vi.mock('@/lib/eta/direct/eta-db-list', () => ({ getEtaDbSnapshot }))
vi.mock('hk-bus-eta', () => ({ fetchEtas: vi.fn() }))

describe('getEtaDbRecord dedupe', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    idbGet.mockResolvedValue(null)
    getEtaDbSnapshot.mockImplementation(async () => {
      // Yield once so both callers are in flight together.
      await Promise.resolve()
      return { db: {} as never, md5: 'test-md5', fetchedAt: Date.now() }
    })
  })

  it('reads IndexedDB once for concurrent cold callers', async () => {
    const { getEtaDbCached } = await import('./eta-db')

    const [a, b] = await Promise.all([getEtaDbCached(), getEtaDbCached()])

    expect(a).toBe(b)
    // One record read plus one md5 read, not two of each.
    expect(idbGet).toHaveBeenCalledTimes(2)
    expect(getEtaDbSnapshot).toHaveBeenCalledTimes(1)
  })

  it('serves the memory cache after the first load', async () => {
    const { getEtaDbCached } = await import('./eta-db')

    await getEtaDbCached()
    await getEtaDbCached()

    expect(idbGet).toHaveBeenCalledTimes(2)
    expect(getEtaDbSnapshot).toHaveBeenCalledTimes(1)
  })
})
