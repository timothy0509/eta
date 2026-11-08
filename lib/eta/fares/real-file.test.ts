import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

// Mirror of the loader validator: the real file must pass it, or the UI gets null.
import { __resetFareIndexCacheForTests, loadFareIndex } from '@/lib/eta/fares/loader'
import { fareForIndices } from '@/lib/eta/fares/lookup'

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

    // Circular routes can board the same physical stop twice at different
    // points in the sequence. Each visit keeps its own fare row.
    const circular = index!.variants['kmb|110|O|1|1017']
    expect(circular).toBeDefined()
    expect(fareForIndices(circular!, 11, 34)).toBe(12.2)
    expect(fareForIndices(circular!, 33, 34)).toBe(7.7)
  })
})
