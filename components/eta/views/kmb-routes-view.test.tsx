'use client'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { KmbRoutesView } from '@/components/eta/views/kmb-routes-view'
import { usePaneStore } from '@/lib/eta/pane-store'
import { render, screen } from '@/lib/test-utils'
import {
  fetchKmbRouteStops,
  fetchKmbRoutes,
  fetchKmbStopEtas,
  fetchKmbStops,
} from '@/lib/eta/client'

vi.mock('@/lib/eta/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/eta/client')>()
  return {
    ...actual,
    fetchKmbRoutes: vi.fn(),
    fetchKmbRouteStops: vi.fn(),
    fetchKmbStops: vi.fn(),
    fetchKmbStopEtas: vi.fn(),
  }
})

vi.mock('@/lib/eta/direct/eta-db', () => ({
  getEtaDbIndexes: vi.fn(async () => ({ routeVariantIndex: new Map() })),
}))

vi.mock('@/lib/eta/fares/use-fare-index', () => ({
  useFareIndex: () => null,
}))

vi.mock('@/lib/eta/headway/use-headway-schedule', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/eta/headway/use-headway-schedule')>()
  return {
    ...actual,
    useHeadwaySchedule: () => null,
  }
})

vi.mock('@/lib/eta/route-search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/eta/route-search')>()
  return {
    ...actual,
    loadRouteFuseIndex: vi.fn(async () => null),
  }
})

vi.mock('@/lib/eta/routing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/eta/routing')>()
  return {
    ...actual,
    getRouteDisplayGeometry: vi.fn(async () => null),
  }
})

vi.mock('@/components/eta/transit-map', () => ({
  TransitMap: () => null,
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const ROUTE_ENTRY = {
  co: 'kmb',
  route: '98C',
  bound: 'O',
  service_type: '1',
  gtfsId: '',
  region: '',
  operators: ['kmb'],
  routeGroupKey: '',
  jointVariantKey: '',
  orig_en: 'Hang Hau (North)',
  orig_tc: '坑口(北)',
  orig_sc: '坑口(北)',
  dest_en: 'Mei Foo',
  dest_tc: '美孚',
  dest_sc: '美孚',
}

const ROUTE_STOPS = [
  {
    co: 'kmb',
    route: '98C',
    bound: 'O',
    serviceType: '1',
    seq: 1,
    stopId: 'S1',
    gtfsId: '',
    region: '',
    operators: ['kmb'],
    routeGroupKey: '',
    jointVariantKey: '',
    jointGroupKey: '',
    siblingStopIds: [],
  },
  {
    co: 'kmb',
    route: '98C',
    bound: 'O',
    serviceType: '1',
    seq: 2,
    stopId: 'S2',
    gtfsId: '',
    region: '',
    operators: ['kmb'],
    routeGroupKey: '',
    jointVariantKey: '',
    jointGroupKey: '',
    siblingStopIds: [],
  },
]

const STOPS = [
  {
    stopId: 'S1',
    nameEn: 'Hang Hau (North)',
    nameTc: '坑口(北)',
    nameSc: '坑口(北)',
    lat: 22.3,
    lng: 114.26,
    isKmb: true,
  },
  {
    stopId: 'S2',
    nameEn: 'Chung Wa Road',
    nameTc: '重華路',
    nameSc: '重华路',
    lat: 22.31,
    lng: 114.27,
    isKmb: true,
  },
]

const INITIAL_SELECTION = {
  co: 'kmb',
  route: '98C',
  bound: 'O',
  serviceType: '1',
}

async function settle() {
  await vi.advanceTimersByTimeAsync(2000)
}

describe('KmbRoutesView auto-refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    usePaneStore.setState({ kmbStops: [], kmbRouteStops: [] })
    vi.mocked(fetchKmbRoutes).mockResolvedValue([ROUTE_ENTRY] as never)
    vi.mocked(fetchKmbRouteStops).mockResolvedValue(ROUTE_STOPS as never)
    vi.mocked(fetchKmbStops).mockResolvedValue(STOPS as never)
    vi.mocked(fetchKmbStopEtas).mockResolvedValue({
      byStopId: { S1: [], S2: [] },
      errors: [],
      cached: 0,
      fetched: 1,
    } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('re-fetches route ETAs on the global refresh interval', async () => {
    render(<KmbRoutesView lang="en" initialSelection={INITIAL_SELECTION} autoRefreshSeconds={15} />)
    await settle()
    expect(screen.getAllByText('Chung Wa Road').length).toBeGreaterThan(0)

    const baseline = vi.mocked(fetchKmbStopEtas).mock.calls.length
    expect(baseline).toBeGreaterThan(0)

    await vi.advanceTimersByTimeAsync(16_000)
    expect(vi.mocked(fetchKmbStopEtas).mock.calls.length).toBeGreaterThan(baseline)
  })

  it('does not re-fetch when auto-refresh is off (0)', async () => {
    render(<KmbRoutesView lang="en" initialSelection={INITIAL_SELECTION} autoRefreshSeconds={0} />)
    await settle()
    expect(screen.getAllByText('Chung Wa Road').length).toBeGreaterThan(0)

    const baseline = vi.mocked(fetchKmbStopEtas).mock.calls.length
    expect(baseline).toBeGreaterThan(0)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(vi.mocked(fetchKmbStopEtas).mock.calls.length).toBe(baseline)
  })
})
