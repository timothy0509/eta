import { afterEach, describe, expect, it, vi } from 'vitest'

import { __resetFareIndexCacheForTests, loadFareIndex } from '@/lib/eta/fares/loader'

function mockIndex(json: unknown): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => json,
  } as Response)
}

const validVariant = {
  stops: ['A', 'B', 'C'],
  fares: [
    [
      [1, 4.9],
      [2, 7.3],
    ],
    [[2, 4.9]],
    null,
  ],
}

function indexWith(variant: unknown) {
  return { updated: '2026-11-02', variants: { 'gmb|36A|O|1|2010863': variant } }
}

afterEach(() => {
  vi.restoreAllMocks()
  __resetFareIndexCacheForTests()
})

describe('loadFareIndex validation', () => {
  it('loads a well-formed index', async () => {
    mockIndex(indexWith(validVariant))
    const index = await loadFareIndex()
    expect(index?.updated).toBe('2026-11-02')
    expect(index?.variants['gmb|36A|O|1|2010863']).toBeDefined()
  })

  it('rejects a stops/fares length mismatch', async () => {
    mockIndex(indexWith({ ...validVariant, fares: [[[1, 4.9]]] }))
    expect(await loadFareIndex()).toBeNull()
  })

  it('rejects a fare range with a fractional index', async () => {
    mockIndex(indexWith({ stops: ['A', 'B'], fares: [[[1.5, 4.9]], null] }))
    expect(await loadFareIndex()).toBeNull()
  })

  it('rejects a negative fare', async () => {
    mockIndex(indexWith({ stops: ['A', 'B'], fares: [[[1, -4.9]], null] }))
    expect(await loadFareIndex()).toBeNull()
  })

  it('rejects a fares entry that is not an array or null', async () => {
    mockIndex(indexWith({ stops: ['A'], fares: ['4.9'] }))
    expect(await loadFareIndex()).toBeNull()
  })

  it('accepts null for a boarding stop without fares', async () => {
    mockIndex(indexWith({ stops: ['A', 'B'], fares: [null, null] }))
    expect(await loadFareIndex()).not.toBeNull()
  })
})
