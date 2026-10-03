import { beforeEach, describe, expect, it, vi } from 'vitest'

import { idbDelete } from '@/lib/eta/cache/idb'
import {
  KMB_ROUTE_STOPS_MAPPED_CACHE_KEY,
  KMB_ROUTES_MAPPED_CACHE_KEY,
  KMB_STOPS_MAPPED_CACHE_KEY,
} from '@/lib/eta/cache/keys'
import { fetchKmbRoutes, fetchKmbRouteStops, fetchKmbStopEtas, fetchKmbStops } from './client'
import {
  fetchKmbStopEtas as fetchKmbStopEtasDirect,
  getKmbRouteList,
  getKmbRouteStops,
  getKmbStops,
  type KmbStopEtasResponse as DirectKmbStopEtasResponse,
} from '@/lib/eta/direct/kmb'
import { getCachedValue } from '@/lib/eta/direct/shared'

vi.mock('@/lib/eta/direct/kmb', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/eta/direct/kmb')>()
  return {
    ...original,
    getKmbStops: vi.fn(),
    getKmbRouteStops: vi.fn(),
    getKmbRouteList: vi.fn(),
    fetchKmbStopEtas: vi.fn(),
  }
})

vi.mock('@/lib/eta/direct/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/eta/direct/shared')>()
  return { ...original, getCachedValue: vi.fn() }
})

const mockGetKmbStops = vi.mocked(getKmbStops)
const mockGetKmbRouteStops = vi.mocked(getKmbRouteStops)
const mockGetKmbRouteList = vi.mocked(getKmbRouteList)
const mockFetchKmbStopEtasDirect = vi.mocked(fetchKmbStopEtasDirect)
const mockGetCachedValue = vi.mocked(getCachedValue)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function emptyStopEtas(): DirectKmbStopEtasResponse {
  return { byStopId: {}, errors: [], cached: 0, fetched: 1 }
}

async function clearMappedKeys() {
  await Promise.all(
    [KMB_STOPS_MAPPED_CACHE_KEY, KMB_ROUTE_STOPS_MAPPED_CACHE_KEY, KMB_ROUTES_MAPPED_CACHE_KEY].map(
      (key) => idbDelete(key).catch(() => false)
    )
  )
}

describe('fetchKmbStops', () => {
  beforeEach(async () => {
    mockGetKmbStops.mockReset()
    mockGetCachedValue.mockReset()
    await clearMappedKeys()
    mockGetCachedValue.mockImplementation(async ({ fetcher }) => ({
      value: await (fetcher as () => Promise<never>)(),
      cached: false,
      stale: false,
      ageMs: null,
    }))
  })

  it('coerces string coords and drops stops with invalid coords', async () => {
    mockGetKmbStops.mockResolvedValue([
      {
        stop: 'A',
        name_en: 'Central',
        name_tc: '中環',
        name_sc: '中环',
        lat: '22.28',
        long: '114.15',
        isKmb: true,
      },
      {
        stop: 'B',
        name_en: 'Bad NaN',
        name_tc: '',
        name_sc: '',
        lat: 'NaN',
        long: '114.15',
        isKmb: true,
      },
      {
        stop: 'C',
        name_en: 'Empty',
        name_tc: '',
        name_sc: '',
        lat: '',
        long: '',
        isKmb: true,
      },
      {
        stop: 'D',
        name_en: 'Null',
        name_tc: '',
        name_sc: '',
        lat: null as unknown as number,
        long: 114.15,
        isKmb: true,
      },
      {
        stop: 'E',
        name_en: '',
        name_tc: '沒有英文名',
        name_sc: '',
        lat: 22.28,
        long: 114.15,
        isKmb: true,
      },
      {
        stop: 'F',
        name_en: 'Numbers',
        name_tc: '',
        name_sc: '',
        lat: 22.3,
        long: 114.16,
        isKmb: false,
      },
      {
        stop: 'G',
        name_en: 'Missing',
        name_tc: '',
        name_sc: '',
        lat: 22.3,
        long: undefined as unknown as number,
        isKmb: true,
      },
    ])

    const stops = await fetchKmbStops()

    expect(stops.map((s) => s.stopId).sort()).toEqual(['A', 'F'])
    expect(stops.find((s) => s.stopId === 'A')).toMatchObject({ lat: 22.28, lng: 114.15 })
    expect(stops.find((s) => s.stopId === 'A')).toMatchObject({ isKmb: true })
    expect(stops.find((s) => s.stopId === 'F')).toMatchObject({ isKmb: false })
  })

  it('defaults stale cached stops without the flag to non-KMB', async () => {
    mockGetKmbStops.mockResolvedValue([
      {
        stop: 'X',
        name_en: 'Central',
        name_tc: '中環',
        name_sc: '中环',
        lat: 22.28,
        long: 114.15,
        isKmb: undefined as unknown as boolean,
      },
    ])

    const stops = await fetchKmbStops()

    expect(stops).toMatchObject([{ stopId: 'X', isKmb: false }])
  })

  it('routes through the mapped-keys cache with the static-list policy', async () => {
    mockGetKmbStops.mockResolvedValue([])

    await fetchKmbStops()

    expect(mockGetCachedValue).toHaveBeenCalledTimes(1)
    expect(mockGetCachedValue).toHaveBeenCalledWith(
      expect.objectContaining({
        key: KMB_STOPS_MAPPED_CACHE_KEY,
        policyKey: 'kmbStaticList',
      })
    )
  })
})

describe('fetchKmbRouteStops', () => {
  beforeEach(async () => {
    mockGetKmbRouteStops.mockReset()
    mockGetCachedValue.mockReset()
    await clearMappedKeys()
    mockGetCachedValue.mockImplementation(async ({ fetcher }) => ({
      value: await (fetcher as () => Promise<never>)(),
      cached: false,
      stale: false,
      ageMs: null,
    }))
  })

  it('maps entries and routes through the mapped-keys cache', async () => {
    mockGetKmbRouteStops.mockResolvedValue([
      {
        co: 'kmb',
        route: '1A',
        bound: 'O',
        service_type: 1,
        seq: '3',
        stop: 'S1',
      },
    ])

    const stops = await fetchKmbRouteStops()

    expect(stops).toMatchObject([{ route: '1A', seq: 3, stopId: 'S1' }])
    expect(mockGetCachedValue).toHaveBeenCalledTimes(1)
    expect(mockGetCachedValue).toHaveBeenCalledWith(
      expect.objectContaining({
        key: KMB_ROUTE_STOPS_MAPPED_CACHE_KEY,
        policyKey: 'kmbStaticList',
      })
    )
  })
})

describe('fetchKmbRoutes', () => {
  beforeEach(async () => {
    mockGetKmbRouteList.mockReset()
    mockGetCachedValue.mockReset()
    await clearMappedKeys()
    mockGetCachedValue.mockImplementation(async ({ fetcher }) => ({
      value: await (fetcher as () => Promise<never>)(),
      cached: false,
      stale: false,
      ageMs: null,
    }))
  })

  it('routes through the mapped-keys cache with the static-list policy', async () => {
    mockGetKmbRouteList.mockResolvedValue([])

    await fetchKmbRoutes()

    expect(mockGetKmbRouteList).toHaveBeenCalledTimes(1)
    expect(mockGetCachedValue).toHaveBeenCalledWith(
      expect.objectContaining({
        key: KMB_ROUTES_MAPPED_CACHE_KEY,
        policyKey: 'kmbStaticList',
      })
    )
  })
})

describe('fetchKmbStopEtas dedupe abort handling', () => {
  beforeEach(() => {
    mockFetchKmbStopEtasDirect.mockReset()
  })

  it('joined caller recovers with its own fetch when the originator aborts', async () => {
    const first = deferred<DirectKmbStopEtasResponse>()
    mockFetchKmbStopEtasDirect.mockReturnValueOnce(first.promise)
    const recovered = emptyStopEtas()
    mockFetchKmbStopEtasDirect.mockResolvedValue(recovered)

    const controllerA = new AbortController()
    const promiseA = fetchKmbStopEtas(['SJOIN1'], { signal: controllerA.signal })
    const controllerB = new AbortController()
    const promiseB = fetchKmbStopEtas(['SJOIN1'], { signal: controllerB.signal })
    const assertA = expect(promiseA).rejects.toMatchObject({ name: 'AbortError' })
    const assertB = expect(promiseB).resolves.toEqual(recovered)

    controllerA.abort()
    first.reject(new DOMException('The operation was aborted.', 'AbortError'))

    await assertA
    await assertB
    expect(mockFetchKmbStopEtasDirect).toHaveBeenCalledTimes(2)
  })

  it('genuine errors propagate to joined callers without refetching', async () => {
    const first = deferred<DirectKmbStopEtasResponse>()
    mockFetchKmbStopEtasDirect.mockReturnValueOnce(first.promise)

    const promiseA = fetchKmbStopEtas(['SJOIN2'], { signal: new AbortController().signal })
    const promiseB = fetchKmbStopEtas(['SJOIN2'], { signal: new AbortController().signal })
    const assertA = expect(promiseA).rejects.toThrow('boom')
    const assertB = expect(promiseB).rejects.toThrow('boom')

    first.reject(new Error('boom'))

    await assertA
    await assertB
    expect(mockFetchKmbStopEtasDirect).toHaveBeenCalledTimes(1)
  })

  it('joined caller abort still rejects locally without disturbing the originator', async () => {
    const done = emptyStopEtas()
    mockFetchKmbStopEtasDirect.mockResolvedValue(done)

    const controllerA = new AbortController()
    const promiseA = fetchKmbStopEtas(['SJOIN3'], { signal: controllerA.signal })
    const controllerB = new AbortController()
    const promiseB = fetchKmbStopEtas(['SJOIN3'], { signal: controllerB.signal })
    const assertB = expect(promiseB).rejects.toMatchObject({ name: 'AbortError' })

    controllerB.abort()

    await assertB
    await expect(promiseA).resolves.toEqual(done)
    expect(mockFetchKmbStopEtasDirect).toHaveBeenCalledTimes(1)
  })
})
