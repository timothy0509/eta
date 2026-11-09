import { describe, expect, it, vi } from 'vitest'
import type { Company } from 'hk-bus-eta'

import { getKmbRouteInfo } from './kmb'
import * as etaDb from './eta-db'
import * as jointRoutes from '@/lib/eta/joint-routes'
import { routeVariantKey, type EtaDbIndexes, type KmbRouteInfoLite } from '@/lib/eta/eta-db-index'
import type { RouteListEntry } from 'hk-bus-eta'

function makeRouteListEntry(): RouteListEntry {
  const companies: Company[] = [
    'kmb',
    'ctb',
    'nlb',
    'gmb',
    'lrtfeeder',
    'lightRail',
    'mtr',
    'sunferry',
    'hkkf',
    'fortuneferry',
  ]
  const bound = Object.fromEntries(
    companies.map((co) => [co, 'O'])
  ) as unknown as RouteListEntry['bound']
  bound.kmb = 'O'
  const stops = Object.fromEntries(
    companies.map((co) => [co, []])
  ) as unknown as RouteListEntry['stops']
  return {
    route: '1A',
    co: ['kmb'],
    bound,
    serviceType: '1',
    orig: { en: 'O', zh: 'O' },
    dest: { en: 'D', zh: 'D' },
    stops,
    fares: null,
    faresHoliday: null,
    freq: null,
    jt: null,
    seq: 1,
    nlbId: '',
    gtfsId: '',
  }
}

function makeRouteInfoLite(): KmbRouteInfoLite {
  return {
    co: 'kmb' as Company,
    route: '1A',
    bound: 'O',
    serviceType: '1',
    gtfsId: '',
    region: '',
    origin: { en: 'O', tc: 'O', sc: 'O' },
    destination: { en: 'D', tc: 'D', sc: 'D' },
    routeEntry: makeRouteListEntry(),
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
    routeVariantIndex: new Map([['kmb|1A|O|1|', makeRouteListEntry()]]),
    regionIndex: new Map(),
    regionByVariantKey: new Map(),
  }
}

describe('getKmbRouteInfo abort signal', () => {
  it('rejects with AbortError without calling findKmbRouteInfo when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const findSpy = vi.spyOn(etaDb, 'findKmbRouteInfo')

    await expect(
      getKmbRouteInfo({ route: '1A', direction: 'O', serviceType: '1', signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(findSpy).not.toHaveBeenCalled()
    findSpy.mockRestore()
  })

  it('forwards the signal to findKmbRouteInfo', async () => {
    const findSpy = vi.spyOn(etaDb, 'findKmbRouteInfo').mockResolvedValue(makeRouteInfoLite())
    const controller = new AbortController()

    await getKmbRouteInfo({
      route: '1A',
      direction: 'O',
      serviceType: '1',
      signal: controller.signal,
    })

    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }))
    findSpy.mockRestore()
  })
})

describe('findKmbRouteInfo abort signal', () => {
  it('rejects with AbortError without loading indexes when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const indexesSpy = vi.spyOn(etaDb, 'getEtaDbIndexes')

    await expect(
      etaDb.findKmbRouteInfo({
        route: '1A',
        bound: 'O',
        serviceType: '1',
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(indexesSpy).not.toHaveBeenCalled()
    indexesSpy.mockRestore()
  })

  it('resolves normally without a signal', async () => {
    const indexesSpy = vi.spyOn(etaDb, 'getEtaDbIndexes').mockResolvedValue(emptyIndexes())

    const info = await etaDb.findKmbRouteInfo({ route: '1A', bound: 'O', serviceType: '1' })

    expect(info).toMatchObject({ route: '1A', bound: 'O' })
    indexesSpy.mockRestore()
  })

  it('shares one joint route group for inferred 101R-style pairs', async () => {
    const makeEntry = (co: Company): RouteListEntry => {
      const companies: Company[] = ['kmb', 'ctb']
      const bound = Object.fromEntries(
        companies.map((c) => [c, 'O'])
      ) as unknown as RouteListEntry['bound']
      const stops = { kmb: [], ctb: [] } as unknown as RouteListEntry['stops']
      stops[co] = ['S1']
      return {
        route: '101R',
        co: [co],
        bound,
        serviceType: '1',
        orig: { en: 'Happy Valley Racecourse', zh: '跑馬地' },
        dest: { en: 'Central', zh: '中環' },
        stops,
        fares: null,
        faresHoliday: null,
        freq: null,
        jt: null,
        seq: 1,
        nlbId: '',
        gtfsId: '',
      }
    }
    const kmbEntry = makeEntry('kmb')
    const ctbEntry = makeEntry('ctb')
    const indexes: EtaDbIndexes = {
      ...emptyIndexes(),
      kmbRouteListEntries: [kmbEntry, ctbEntry],
      routeVariantIndex: new Map([
        [
          routeVariantKey({ co: 'kmb', route: '101R', bound: 'O', serviceType: '1', gtfsId: '' }),
          kmbEntry,
        ],
        [
          routeVariantKey({ co: 'ctb', route: '101R', bound: 'O', serviceType: '1', gtfsId: '' }),
          ctbEntry,
        ],
      ]),
    }
    const indexesSpy = vi.spyOn(etaDb, 'getEtaDbIndexes').mockResolvedValue(indexes)
    const manifestSpy = vi.spyOn(jointRoutes, 'loadJointRoutes').mockResolvedValue(null)

    const [kmbInfo, ctbInfo] = await Promise.all([
      etaDb.findKmbRouteInfo({ co: 'kmb', route: '101R', bound: 'O', serviceType: '1' }),
      etaDb.findKmbRouteInfo({ co: 'ctb', route: '101R', bound: 'O', serviceType: '1' }),
    ])

    expect(kmbInfo?.routeGroupKey).toBe('joint|101R')
    expect(ctbInfo?.routeGroupKey).toBe('joint|101R')
    indexesSpy.mockRestore()
    manifestSpy.mockRestore()
  })
})
