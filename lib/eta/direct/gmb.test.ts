import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchGmbRoutes } from './gmb'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { fetchJson } from '@/lib/eta/http'
import type { GmbRouteEntry } from '@/lib/eta/gmb'

vi.mock('@/lib/eta/direct/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/eta/direct/shared')>()
  return { ...original, getCachedValue: vi.fn() }
})

vi.mock('@/lib/eta/http', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/eta/http')>()
  return { ...original, fetchJson: vi.fn() }
})

const mockGetCachedValue = vi.mocked(getCachedValue)
const mockFetchJson = vi.mocked(fetchJson)

function routeEntry(): GmbRouteEntry {
  return {
    routeId: 2000410,
    district: 'HKI',
    name: { en: '69', tc: '69', sc: '69' },
    serviceMode: 'T',
    specialType: 1,
    journeyTime: 54,
    origin: { en: 'Cyberport', tc: '數碼港', sc: '数码港' },
    destination: { en: 'Quarry Bay', tc: '鰂魚涌', sc: '鲗鱼涌' },
    fullFare: 14.5,
    lastUpdateDate: '2026-09-27T00:00:00',
    stopCount: 42,
  }
}

describe('fetchGmbRoutes', () => {
  beforeEach(() => {
    mockGetCachedValue.mockReset()
    mockFetchJson.mockReset()
    mockGetCachedValue.mockImplementation(async ({ fetcher }) => ({
      value: await (fetcher as () => Promise<never>)(),
      cached: false,
      stale: false,
      ageMs: null,
    }))
  })

  it('fetches the same-origin extract and validates its shape', async () => {
    const file = {
      meta: { source: 's', dataset: 'd', cutoffDate: '2026-09-30', generatedAt: 'g', count: 1 },
      routes: [routeEntry()],
    }
    mockFetchJson.mockResolvedValue(file)
    const result = await fetchGmbRoutes()
    expect(mockFetchJson).toHaveBeenCalledWith('/data/gmb-routes.json', expect.anything())
    expect(result.routes).toHaveLength(1)
    expect(result.meta.cutoffDate).toBe('2026-09-30')
  })

  it('rejects a malformed extract', async () => {
    mockFetchJson.mockResolvedValue({ meta: {}, routes: [{ routeId: 'nope' }] })
    await expect(fetchGmbRoutes()).rejects.toThrow()
  })
})
