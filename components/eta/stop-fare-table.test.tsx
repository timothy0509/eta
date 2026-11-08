import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, screen } from '@/lib/test-utils'
import { StopFareTable } from '@/components/eta/stop-fare-table'
import { __resetFareIndexCacheForTests } from '@/lib/eta/fares/loader'

const VARIANT_KEY = 'gmb|36A|O|2|2010863'

vi.mock('@/lib/eta/client', () => ({
  fetchKmbRouteStops: async () =>
    ['A', 'B', 'C', 'D'].map((stopId, index) => ({
      co: 'gmb',
      route: '36A',
      bound: 'O',
      serviceType: '2',
      seq: index + 1,
      stopId,
      gtfsId: '2010863',
      region: '',
    })),
  fetchKmbStops: async () =>
    ['A', 'B', 'C', 'D'].map((stopId) => ({
      stopId,
      nameEn: `Stop ${stopId}`,
      nameTc: `站 ${stopId}`,
      nameSc: `站 ${stopId}`,
      lat: 22,
      lng: 114,
      isKmb: false,
    })),
}))

const fareJson = {
  updated: '2026-11-02',
  variants: {
    [VARIANT_KEY]: {
      stops: ['A', 'B', 'C', 'D'],
      fares: [
        [
          [1, 4.9],
          [3, 9.0],
        ],
        [[3, 4.9]],
        null,
        null,
      ],
    },
  },
}

afterEach(() => {
  vi.restoreAllMocks()
  __resetFareIndexCacheForTests()
})

describe('StopFareTable', () => {
  it('lists each fare stage from the boarding stop', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => fareJson,
    } as Response)

    render(<StopFareTable variantKey={VARIANT_KEY} stopId="A" lang="en" />)

    expect(await screen.findByText('Up to Stop B')).not.toBeNull()
    expect(screen.getByText('Up to Stop D')).not.toBeNull()
    expect(screen.getByText('HK$ 4.9')).not.toBeNull()
    expect(screen.getByText('HK$ 9.0')).not.toBeNull()
  })

  it('renders nothing for a flat fare table', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        updated: '2026-11-02',
        variants: {
          [VARIANT_KEY]: {
            stops: ['A', 'B', 'C', 'D'],
            fares: [[[3, 6.7]], [[3, 6.7]], null, null],
          },
        },
      }),
    } as Response)

    const { container } = render(<StopFareTable variantKey={VARIANT_KEY} stopId="A" lang="en" />)
    // Allow the async load to settle before asserting the empty render.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container.textContent).toBe('')
  })
})
