import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

// Mirror of the loader validator: the real file must pass it, or the UI gets null.
import { loadHeadwayIndex, __resetHeadwayIndexCacheForTests } from '@/lib/eta/headway/loader'

describe('real headway.json passes loader validation', () => {
  it('loads the checked-in snapshot', async () => {
    __resetHeadwayIndexCacheForTests()
    // jsdom has no /headway route; stub fetch with the real file.
    const raw = readFileSync('public/headway/headway.json', 'utf8')
    const stub = async () => new Response(raw, { status: 200 })
    vi.stubGlobal('fetch', stub)
    const index = await loadHeadwayIndex()
    vi.unstubAllGlobals()
    expect(index).not.toBeNull()
    expect(Object.keys(index!.variants).length).toBeGreaterThan(2000)
  })
})
