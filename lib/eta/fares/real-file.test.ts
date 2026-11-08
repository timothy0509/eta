import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

// Mirror of the loader validator: the real file must pass it, or the UI gets null.
import { __resetFareIndexCacheForTests, loadFareIndex } from '@/lib/eta/fares/loader'

describe('real fares.json passes loader validation', () => {
  it('loads the checked-in snapshot', async () => {
    __resetFareIndexCacheForTests()
    // jsdom has no /fares route; stub fetch with the real file.
    const raw = readFileSync('public/fares/fares.json', 'utf8')
    const stub = async () => new Response(raw, { status: 200 })
    vi.stubGlobal('fetch', stub)
    const index = await loadFareIndex()
    vi.unstubAllGlobals()
    expect(index).not.toBeNull()
    expect(Object.keys(index!.variants).length).toBeGreaterThan(3000)
    const sectional = Object.values(index!.variants).some((variant) =>
      variant.fares.some((ranges) => ranges !== null && ranges.length > 1)
    )
    expect(sectional).toBe(true)
  })
})
