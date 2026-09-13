import { describe, expect, it, vi } from 'vitest'

import { renderHook, waitFor } from '@/lib/test-utils'
import { fetchTdTraffic } from '@/lib/eta/client'
import type { TdTrafficRecord } from '@/lib/eta/direct/td-traffic'
import { fetchTdTrafficAlerts, getTdTrafficNewsUrl, useTdTrafficAlerts } from './traffic-alerts'

vi.mock('@/lib/eta/client', () => ({ fetchTdTraffic: vi.fn() }))

const mockFetchTdTraffic = vi.mocked(fetchTdTraffic)

const RECORDS: TdTrafficRecord[] = [
  {
    id: 'IN-26-00001',
    heading: 'Road Incident',
    detail: 'Due to traffic accident, part of the lanes is closed.',
    location: 'Island Eastern Corridor',
    district: 'Eastern',
    direction: 'Central',
    date: '2026-09-13T15:46:00',
    status: 'NEW',
    lat: 22.29,
    lng: 114.22,
  },
]

describe('getTdTrafficNewsUrl', () => {
  it('links each lang to its TD Special Traffic News page', () => {
    expect(getTdTrafficNewsUrl('en')).toBe('https://www.td.gov.hk/en/special_news/spnews.htm')
    expect(getTdTrafficNewsUrl('tc')).toBe('https://www.td.gov.hk/tc/special_news/spnews.htm')
    expect(getTdTrafficNewsUrl('sc')).toBe('https://www.td.gov.hk/sc/special_news/spnews.htm')
  })
})

describe('fetchTdTrafficAlerts', () => {
  it('attaches the TD page as the view-all link on live items', async () => {
    mockFetchTdTraffic.mockResolvedValue(RECORDS)

    const result = await fetchTdTrafficAlerts('en')

    expect(result.error).toBeNull()
    expect(result.alerts).toHaveLength(1)
    expect(result.alerts[0]).toMatchObject({
      ...RECORDS[0],
      link: 'https://www.td.gov.hk/en/special_news/spnews.htm',
    })
  })

  it('returns an error envelope when the feed fails', async () => {
    mockFetchTdTraffic.mockRejectedValue(new Error('upstream down'))

    const result = await fetchTdTrafficAlerts('tc')

    expect(result.alerts).toEqual([])
    expect(result.error).toBe('upstream down')
  })
})

describe('useTdTrafficAlerts', () => {
  it('loads live alerts with loading and error states', async () => {
    mockFetchTdTraffic.mockResolvedValue(RECORDS)

    const { result } = renderHook(() => useTdTrafficAlerts('en'))

    expect(result.current.loading).toBe(true)
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.error).toBeNull()
    expect(result.current.alerts).toHaveLength(1)
    expect(result.current.alerts[0]?.id).toBe('IN-26-00001')
  })

  it('surfaces feed errors to the banner', async () => {
    mockFetchTdTraffic.mockRejectedValue(new Error('upstream down'))

    const { result } = renderHook(() => useTdTrafficAlerts('tc'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.alerts).toEqual([])
    expect(result.current.error).toBe('upstream down')
  })
})
