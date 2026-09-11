import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchKmbStops } from './client'
import { getKmbStops } from '@/lib/eta/direct/kmb'

vi.mock('@/lib/eta/direct/kmb', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/eta/direct/kmb')>()
  return { ...original, getKmbStops: vi.fn() }
})

const mockGetKmbStops = vi.mocked(getKmbStops)

describe('fetchKmbStops', () => {
  beforeEach(() => {
    mockGetKmbStops.mockReset()
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
      },
      { stop: 'B', name_en: 'Bad NaN', name_tc: '', name_sc: '', lat: 'NaN', long: '114.15' },
      { stop: 'C', name_en: 'Empty', name_tc: '', name_sc: '', lat: '', long: '' },
      {
        stop: 'D',
        name_en: 'Null',
        name_tc: '',
        name_sc: '',
        lat: null as unknown as number,
        long: 114.15,
      },
      { stop: 'E', name_en: '', name_tc: '沒有英文名', name_sc: '', lat: 22.28, long: 114.15 },
      { stop: 'F', name_en: 'Numbers', name_tc: '', name_sc: '', lat: 22.3, long: 114.16 },
      {
        stop: 'G',
        name_en: 'Missing',
        name_tc: '',
        name_sc: '',
        lat: 22.3,
        long: undefined as unknown as number,
      },
    ])

    const stops = await fetchKmbStops()

    expect(stops.map((s) => s.stopId).sort()).toEqual(['A', 'F'])
    expect(stops.find((s) => s.stopId === 'A')).toMatchObject({ lat: 22.28, lng: 114.15 })
  })
})
