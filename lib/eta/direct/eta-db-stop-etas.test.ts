import { describe, expect, it, vi } from 'vitest'
import type { Company, RouteListEntry } from 'hk-bus-eta'

import { fetchKmbEtasForStop, type FetchKmbEtasForStopDeps } from './eta-db'
import type { EtaDbIndexes } from '@/lib/eta/eta-db-index'

function makeRouteEntry(
  overrides: Omit<Partial<RouteListEntry>, 'bound' | 'stops'> & {
    route: string
    co: Company[]
    bound: Partial<Record<Company, string>>
    stops?: Partial<Record<Company, string[]>>
  }
): RouteListEntry {
  const companies: Company[] = [
    'kmb',
    'nlb',
    'ctb',
    'lrtfeeder',
    'gmb',
    'lightRail',
    'mtr',
    'sunferry',
    'hkkf',
    'fortuneferry',
  ]
  const bound = Object.fromEntries(
    companies.map((co) => [co, 'O'])
  ) as unknown as RouteListEntry['bound']
  for (const [co, value] of Object.entries(overrides.bound)) {
    bound[co as Company] = value as RouteListEntry['bound'][Company]
  }
  const stops = Object.fromEntries(
    companies.map((co) => [co, []])
  ) as unknown as RouteListEntry['stops']
  for (const [co, value] of Object.entries(overrides.stops ?? {})) {
    stops[co as Company] = value as string[]
  }
  return {
    route: overrides.route,
    co: overrides.co,
    bound,
    serviceType: overrides.serviceType ?? '1',
    orig: overrides.orig ?? { en: 'A', zh: 'A' },
    dest: overrides.dest ?? { en: 'B', zh: 'B' },
    stops,
    fares: overrides.fares ?? null,
    faresHoliday: overrides.faresHoliday ?? null,
    freq: overrides.freq ?? null,
    jt: overrides.jt ?? null,
    seq: overrides.seq ?? 1,
    nlbId: overrides.nlbId ?? '',
    gtfsId: overrides.gtfsId ?? '',
  }
}

function emptyIndexes(): EtaDbIndexes {
  return {
    kmbRouteListEntries: [],
    kmbStops: [],
    kmbRouteStops: [],
    mtrRoutes: [],
    lrtRoutes: [],
    stationToRouteIndex: new Map(),
    routeStopSeqIndex: new Map(),
    stopRoutesIndex: new Map(),
    routeVariantIndex: new Map(),
  }
}

describe('fetchKmbEtasForStop hybrid', () => {
  it('KMB-only stop uses official stop-eta and skips fetchEtas', async () => {
    const kmbEntry = makeRouteEntry({
      route: '1A',
      co: ['kmb'],
      bound: { kmb: 'O' },
      stops: { kmb: ['STOP1'] },
    })
    const indexes = emptyIndexes()
    indexes.stopRoutesIndex.set('STOP1', [
      { stopId: 'STOP1', co: 'kmb', route: '1A', bound: 'O', serviceType: '1', seq: 0 },
    ])
    indexes.routeVariantIndex.set('kmb|1A|O|1', kmbEntry)

    const fetchOfficialStopEta = vi.fn().mockResolvedValue({
      data: [
        {
          co: 'KMB',
          route: '1A',
          dir: 'O',
          service_type: 1,
          seq: 1,
          dest_tc: '尖沙咀',
          dest_sc: '尖沙咀',
          dest_en: 'Tsim Sha Tsui',
          eta_seq: 1,
          eta: '2026-08-02T15:20:00+08:00',
          rmk_tc: '',
          rmk_sc: '',
          rmk_en: '',
          data_timestamp: '2026-08-02T15:10:00+08:00',
        },
      ],
    })
    const fetchVariantEtas = vi.fn()

    const deps: FetchKmbEtasForStopDeps = {
      getIndexes: async () => indexes,
      fetchOfficialStopEta,
      fetchVariantEtas,
    }

    const result = await fetchKmbEtasForStop({ stopId: 'STOP1', language: 'tc' }, deps)

    expect(fetchOfficialStopEta).toHaveBeenCalledTimes(1)
    expect(fetchOfficialStopEta).toHaveBeenCalledWith('STOP1', undefined)
    expect(fetchVariantEtas).not.toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0]?.co).toBe('kmb')
    expect(result[0]?.route).toBe('1A')
    expect(result[0]?.dest_en).toBe('Tsim Sha Tsui')
  })

  it('mixed stop uses stop-eta for KMB and fetchEtas for other operators', async () => {
    const kmbEntry = makeRouteEntry({
      route: '101',
      co: ['kmb'],
      bound: { kmb: 'I' },
      stops: { kmb: ['JOINT1'] },
    })
    const ctbEntry = makeRouteEntry({
      route: '5B',
      co: ['ctb'],
      bound: { ctb: 'O' },
      stops: { ctb: ['JOINT1'] },
    })
    const indexes = emptyIndexes()
    indexes.stopRoutesIndex.set('JOINT1', [
      { stopId: 'JOINT1', co: 'kmb', route: '101', bound: 'I', serviceType: '1', seq: 2 },
      { stopId: 'JOINT1', co: 'ctb', route: '5B', bound: 'O', serviceType: '1', seq: 4 },
    ])
    indexes.routeVariantIndex.set('kmb|101|I|1', kmbEntry)
    indexes.routeVariantIndex.set('ctb|5B|O|1', ctbEntry)

    const fetchOfficialStopEta = vi.fn().mockResolvedValue({
      data: [
        {
          co: 'KMB',
          route: '101',
          dir: 'I',
          service_type: '1',
          seq: 3,
          dest_tc: '觀塘',
          dest_sc: '观塘',
          dest_en: 'Kwun Tong',
          eta_seq: 1,
          eta: '2026-08-02T15:25:00+08:00',
          rmk_tc: '',
          rmk_sc: '',
          rmk_en: '',
          data_timestamp: '2026-08-02T15:15:00+08:00',
        },
      ],
    })
    const fetchVariantEtas = vi.fn().mockResolvedValue([
      {
        eta: '2026-08-02T15:26:00+08:00',
        dest: { en: 'Kennedy Town', zh: '堅尼地城' },
        remark: { en: '', zh: '' },
        co: 'ctb',
      },
    ])

    const result = await fetchKmbEtasForStop(
      { stopId: 'JOINT1', language: 'en' },
      {
        getIndexes: async () => indexes,
        fetchOfficialStopEta,
        fetchVariantEtas,
      }
    )

    expect(fetchOfficialStopEta).toHaveBeenCalledTimes(1)
    expect(fetchVariantEtas).toHaveBeenCalledTimes(1)
    expect(fetchVariantEtas).toHaveBeenCalledWith(
      expect.objectContaining({
        co: ['ctb'],
        seq: 4,
        language: 'en',
      })
    )

    const companies = result.map((e) => e.co).sort()
    expect(companies).toEqual(['ctb', 'kmb'])
  })

  it('CTB-only stop skips official stop-eta and uses fetchEtas', async () => {
    const ctbEntry = makeRouteEntry({
      route: '1',
      co: ['ctb'],
      bound: { ctb: 'I' },
      stops: { ctb: ['CTB1'] },
    })
    const indexes = emptyIndexes()
    indexes.stopRoutesIndex.set('CTB1', [
      { stopId: 'CTB1', co: 'ctb', route: '1', bound: 'I', serviceType: '1', seq: 1 },
    ])
    indexes.routeVariantIndex.set('ctb|1|I|1', ctbEntry)

    const fetchOfficialStopEta = vi.fn()
    const fetchVariantEtas = vi.fn().mockResolvedValue([
      {
        eta: '2026-08-02T15:30:00+08:00',
        dest: { en: 'Happy Valley', zh: '跑馬地' },
        remark: { en: '', zh: '' },
        co: 'ctb',
      },
    ])

    const result = await fetchKmbEtasForStop(
      { stopId: 'CTB1', language: 'tc' },
      {
        getIndexes: async () => indexes,
        fetchOfficialStopEta,
        fetchVariantEtas,
      }
    )

    expect(fetchOfficialStopEta).not.toHaveBeenCalled()
    expect(fetchVariantEtas).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
    expect(result[0]?.co).toBe('ctb')
    expect(result[0]?.route).toBe('1')
    expect(result[0]?.seq).toBe(2)
    expect(result[0]?.etaSeq).toBe(1)
  })

  it('returns empty when stop has no indexed routes', async () => {
    const fetchOfficialStopEta = vi.fn()
    const fetchVariantEtas = vi.fn()

    const result = await fetchKmbEtasForStop(
      { stopId: 'UNKNOWN', language: 'tc' },
      {
        getIndexes: async () => emptyIndexes(),
        fetchOfficialStopEta,
        fetchVariantEtas,
      }
    )

    expect(result).toEqual([])
    expect(fetchOfficialStopEta).not.toHaveBeenCalled()
    expect(fetchVariantEtas).not.toHaveBeenCalled()
  })

  it('rejects without fetching when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchOfficialStopEta = vi.fn()
    const fetchVariantEtas = vi.fn()

    await expect(
      fetchKmbEtasForStop(
        { stopId: 'STOP1', language: 'tc', signal: controller.signal },
        {
          getIndexes: async () => emptyIndexes(),
          fetchOfficialStopEta,
          fetchVariantEtas,
        }
      )
    ).rejects.toThrow(expect.objectContaining({ name: 'AbortError' }))
    expect(fetchOfficialStopEta).not.toHaveBeenCalled()
    expect(fetchVariantEtas).not.toHaveBeenCalled()
  })

  it('forwards the signal to the official stop-eta fetch', async () => {
    const kmbEntry = makeRouteEntry({
      route: '1A',
      co: ['kmb'],
      bound: { kmb: 'O' },
      stops: { kmb: ['STOP1'] },
    })
    const indexes = emptyIndexes()
    indexes.stopRoutesIndex.set('STOP1', [
      { stopId: 'STOP1', co: 'kmb', route: '1A', bound: 'O', serviceType: '1', seq: 0 },
    ])
    indexes.routeVariantIndex.set('kmb|1A|O|1', kmbEntry)
    const fetchOfficialStopEta = vi.fn().mockResolvedValue({ data: [] })
    const controller = new AbortController()

    await fetchKmbEtasForStop(
      { stopId: 'STOP1', language: 'tc', signal: controller.signal },
      {
        getIndexes: async () => indexes,
        fetchOfficialStopEta,
        fetchVariantEtas: vi.fn(),
      }
    )

    expect(fetchOfficialStopEta).toHaveBeenCalledWith('STOP1', controller.signal)
  })
})
