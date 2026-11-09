import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchJson } from '@/lib/eta/http'
import {
  __resetJointRoutesCacheForTests,
  inferJointRouteNumbers,
  isJointRoute,
  jointRouteGroupKey,
  loadJointRoutes,
  resolveJointOperators,
  staleJointOperators,
  type JointRouteManifest,
} from './joint-routes'

vi.mock('@/lib/eta/http', () => ({
  fetchJson: vi.fn(),
}))

const mockFetchJson = vi.mocked(fetchJson)

const manifest: JointRouteManifest = {
  updated: '2026-11-02',
  routes: {
    '102': { operators: ['ctb', 'kmb'], agency: 'KMB+CTB', longName: 'SHAU KEI WAN - MEI FOO' },
    R8: { operators: ['ctb', 'kmb'], agency: 'LWB+CTB', longName: 'DISNEYLAND' },
  },
}

/** Fresh regen shape: buildJointRoutes() maps agency LWB to co `lwb`. */
const freshManifest: JointRouteManifest = {
  updated: '2026-11-02',
  routes: {
    R8: { operators: ['ctb', 'lwb'], agency: 'LWB+CTB', longName: 'DISNEYLAND' },
  },
}

describe('resolveJointOperators', () => {
  it('returns both operators for a manifest joint route', () => {
    expect(resolveJointOperators(manifest, '102', ['kmb', 'ctb'])).toEqual(['ctb', 'kmb'])
  })

  it('ignores an operator pair the manifest does not list for the route', () => {
    expect(resolveJointOperators(manifest, '102', ['kmb', 'nlb'])).toEqual([])
  })

  it('falls back to the upstream pair when the manifest has no entry', () => {
    expect(resolveJointOperators(manifest, '999', ['kmb', 'ctb'])).toEqual(['ctb', 'kmb'])
  })

  it('falls back to the upstream pair when no manifest is available', () => {
    expect(resolveJointOperators(null, '102', ['kmb', 'ctb'])).toEqual(['ctb', 'kmb'])
  })

  it('never treats one operator as joint', () => {
    expect(resolveJointOperators(manifest, '102', ['ctb'])).toEqual([])
  })

  it('reports joint status through the helper', () => {
    expect(isJointRoute(manifest, '102', ['kmb', 'ctb'])).toBe(true)
    expect(isJointRoute(manifest, '102', ['ctb'])).toBe(false)
  })

  it('matches LWB+CTB joints in KMB-family space, either manifest shape', () => {
    // Actual app companies keep the LWB half under `lwb`.
    expect(resolveJointOperators(freshManifest, 'R8', ['lwb', 'ctb'])).toEqual(['ctb', 'lwb'])
    expect(resolveJointOperators(manifest, 'R8', ['lwb', 'ctb'])).toEqual(['ctb', 'lwb'])
    // Index wrappers compare with lwb mapped to kmb; both shapes still match.
    expect(resolveJointOperators(freshManifest, 'R8', ['kmb', 'ctb'])).toEqual(['ctb', 'kmb'])
    expect(resolveJointOperators(manifest, 'R8', ['kmb', 'ctb'])).toEqual(['ctb', 'kmb'])
  })

  it('does not treat same-family kmb+lwb as two joint operators', () => {
    expect(resolveJointOperators(freshManifest, 'R8', ['kmb', 'lwb'])).toEqual([])
  })
})

describe('jointRouteGroupKey', () => {
  it('groups one-operator specials under the route number', () => {
    expect(jointRouteGroupKey(manifest, '102', ['ctb'])).toBe('joint|102')
  })

  it('does not group a different operator with the same number', () => {
    expect(jointRouteGroupKey(manifest, '102', ['gmb'])).toBe('')
  })

  it('groups the lwb half of an LWB+CTB joint, either manifest shape', () => {
    expect(jointRouteGroupKey(freshManifest, 'R8', ['lwb'])).toBe('joint|R8')
    expect(jointRouteGroupKey(manifest, 'R8', ['lwb'])).toBe('joint|R8')
    expect(jointRouteGroupKey(freshManifest, 'R8', ['kmb'])).toBe('joint|R8')
  })
})

describe('inferJointRouteNumbers', () => {
  it('finds routes missing from the manifest when both operators share termini', () => {
    const inferred = inferJointRouteNumbers([
      {
        co: ['kmb'],
        route: '101R',
        orig: { en: 'HAPPY VALLEY RACE COURSE' },
        dest: { en: 'KWUN TONG (YUE MAN SQUARE)' },
        serviceType: '1',
      },
      {
        co: ['ctb'],
        route: '101R',
        orig: { en: 'Happy Valley Racecourse' },
        dest: { en: 'Kwun Tong (Yue Man Square)' },
        serviceType: 1,
      },
    ])
    expect(inferred.has('101R')).toBe(true)
  })

  it('does not infer a shared number with different termini', () => {
    const inferred = inferJointRouteNumbers([
      {
        co: ['kmb'],
        route: '102',
        orig: { en: 'MEI FOO' },
        dest: { en: 'SHAU KEI WAN' },
        serviceType: '1',
      },
      {
        co: ['ctb'],
        route: '102',
        orig: { en: 'Hang Hau' },
        dest: { en: 'San Po Kong' },
        serviceType: '1',
      },
    ])
    expect(inferred.has('102')).toBe(false)
  })

  it('infers an lwb plus ctb pair sharing termini as joint', () => {
    const inferred = inferJointRouteNumbers([
      {
        co: ['lwb'],
        route: 'S1',
        orig: { en: 'TUNG CHUNG STATION' },
        dest: { en: 'AIRPORT (CIRCULAR)' },
        serviceType: '1',
      },
      {
        co: ['ctb'],
        route: 'S1',
        orig: { en: 'Tung Chung Station' },
        dest: { en: 'Airport (Circular)' },
        serviceType: 1,
      },
    ])
    expect(inferred.has('S1')).toBe(true)
  })
})

describe('staleJointOperators', () => {
  it('gives a stale lwb row the ctb partner, not kmb', () => {
    expect(staleJointOperators({ co: 'lwb', jointVariantKey: 'jointv:1' })).toEqual(['lwb', 'ctb'])
  })

  it('keeps the kmb and ctb fallbacks', () => {
    expect(staleJointOperators({ co: 'kmb', jointVariantKey: 'jointv:1' })).toEqual(['kmb', 'ctb'])
    expect(staleJointOperators({ co: 'ctb', jointVariantKey: 'jointv:1' })).toEqual(['ctb', 'kmb'])
  })

  it('leaves non-KMB/CTB rows and fresh rows alone', () => {
    expect(staleJointOperators({ co: 'gmb', jointVariantKey: 'jointv:1' })).toEqual(['gmb'])
    expect(staleJointOperators({ co: 'kmb' })).toEqual(['kmb'])
    expect(staleJointOperators({ operators: ['kmb', 'ctb'], jointVariantKey: 'jointv:1' })).toEqual(
      ['kmb', 'ctb']
    )
  })
})

describe('loadJointRoutes', () => {
  const successManifest = {
    updated: '2026-11-02',
    routes: {
      '102': { operators: ['ctb', 'kmb'], agency: 'KMB+CTB', longName: 'SHAU KEI WAN - MEI FOO' },
    },
  }

  beforeEach(() => {
    __resetJointRoutesCacheForTests()
    mockFetchJson.mockReset()
  })

  it('returns null on failure and retries on the next call', async () => {
    mockFetchJson.mockRejectedValueOnce(new Error('offline'))
    await expect(loadJointRoutes()).resolves.toBeNull()
    mockFetchJson.mockResolvedValueOnce(successManifest)
    await expect(loadJointRoutes()).resolves.toEqual(successManifest)
    expect(mockFetchJson).toHaveBeenCalledTimes(2)
  })

  it('fetches with a timeout and caches success without refetching', async () => {
    mockFetchJson.mockResolvedValueOnce(successManifest)
    await expect(loadJointRoutes()).resolves.toEqual(successManifest)
    await expect(loadJointRoutes()).resolves.toEqual(successManifest)
    expect(mockFetchJson).toHaveBeenCalledTimes(1)
    expect(mockFetchJson).toHaveBeenCalledWith(
      '/gtfs/joint-routes.json',
      expect.objectContaining({ timeoutMs: 12_000 })
    )
  })
})
