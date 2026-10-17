import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadHeadwayIndex, __resetHeadwayIndexCacheForTests } from '@/lib/eta/headway/loader'

function mockIndex(json: unknown): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => json,
  } as Response)
}

afterEach(() => {
  vi.restoreAllMocks()
  __resetHeadwayIndexCacheForTests()
})

const validVariant = {
  src: ['1001'],
  span: { weekday: ['0535', '2340'] },
  headway: { weekday: [[335, 425, 15]] },
  departures: { weekday: [405, 430] },
}

function indexWith(variant: unknown) {
  return { updated: '2026-10-16', holidays: [], variants: { 'kmb|1|O|1': variant } }
}

describe('loadHeadwayIndex validation', () => {
  it('loads a well-formed index', async () => {
    mockIndex(indexWith(validVariant))
    const index = await loadHeadwayIndex()
    expect(index?.updated).toBe('2026-10-16')
    expect(index?.variants['kmb|1|O|1']).toBeDefined()
  })

  it('rejects an unknown day-type key in departures', async () => {
    mockIndex(indexWith({ ...validVariant, departures: { someday: [405] } }))
    expect(await loadHeadwayIndex()).toBeNull()
  })

  it('rejects non-number departures entries', async () => {
    mockIndex(indexWith({ ...validVariant, departures: { weekday: [405, 'late'] } }))
    expect(await loadHeadwayIndex()).toBeNull()
  })

  it('rejects fractional departures minutes', async () => {
    mockIndex(indexWith({ ...validVariant, departures: { weekday: [405.5] } }))
    expect(await loadHeadwayIndex()).toBeNull()
  })

  it('rejects negative departures minutes', async () => {
    mockIndex(indexWith({ ...validVariant, departures: { weekday: [-5] } }))
    expect(await loadHeadwayIndex()).toBeNull()
  })

  it('rejects absurd departures minutes', async () => {
    mockIndex(indexWith({ ...validVariant, departures: { weekday: [999999] } }))
    expect(await loadHeadwayIndex()).toBeNull()
  })

  it('rejects malformed special entries', async () => {
    mockIndex(
      indexWith({
        ...validVariant,
        special: [{ src: '8496', origin: 'PO TAT', departures: { weekday: [405.5] } }],
      })
    )
    expect(await loadHeadwayIndex()).toBeNull()
  })

  it('returns null on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    expect(await loadHeadwayIndex()).toBeNull()
  })
})
