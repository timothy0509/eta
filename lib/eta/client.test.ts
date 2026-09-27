import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearKmbStaticListCache, fetchKmbRouteStops, fetchKmbStops } from './client'
import { getKmbRouteStops, getKmbStops } from '@/lib/eta/direct/kmb'

vi.mock('@/lib/eta/direct/kmb', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/eta/direct/kmb')>()
  return { ...original, getKmbStops: vi.fn(), getKmbRouteStops: vi.fn() }
})

const mockGetKmbStops = vi.mocked(getKmbStops)
const mockGetKmbRouteStops = vi.mocked(getKmbRouteStops)

describe('fetchKmbStops', () => {
  beforeEach(() => {
    mockGetKmbStops.mockReset()
    clearKmbStaticListCache('stops')
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

  it('shares one mapped array across repeat calls without refetching', async () => {
    mockGetKmbStops.mockResolvedValue([
      {
        stop: 'A',
        name_en: 'Central',
        name_tc: '中環',
        name_sc: '中环',
        lat: 22.28,
        long: 114.15,
        isKmb: true,
      },
    ])

    const first = await fetchKmbStops()
    const second = await fetchKmbStops()

    expect(mockGetKmbStops).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })
})

describe('fetchKmbRouteStops', () => {
  beforeEach(() => {
    mockGetKmbRouteStops.mockReset()
    clearKmbStaticListCache('routeStops')
  })

  it('maps entries once and reuses the result', async () => {
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

    const first = await fetchKmbRouteStops()
    const second = await fetchKmbRouteStops()

    expect(mockGetKmbRouteStops).toHaveBeenCalledTimes(1)
    expect(first).toMatchObject([{ route: '1A', seq: 3, stopId: 'S1' }])
    expect(second).toBe(first)
  })
})
