import { describe, expect, it } from 'vitest'

import type { Company, EtaDb } from 'hk-bus-eta'

import { buildEtaDbIndexes, deserializeEtaDbIndexes, serializeEtaDbIndexes } from './eta-db-index'

function routeEntry(route: string, co: Company[], stopsByCo: Partial<Record<Company, string[]>>) {
  const stops = {} as Record<Company, string[]>
  const bound = {} as Record<Company, 'O'>
  for (const c of co) {
    stops[c] = stopsByCo[c] ?? []
    bound[c] = 'O'
  }
  return {
    route,
    co,
    orig: { en: 'Origin', zh: '起點' },
    dest: { en: 'Destination', zh: '終點' },
    fares: null,
    faresHoliday: null,
    freq: null,
    jt: null,
    seq: 1,
    serviceType: '1',
    stops,
    bound,
    gtfsId: '',
    nlbId: '',
  }
}

function dbWith(entries: Array<ReturnType<typeof routeEntry>>, stopIds: string[]): EtaDb {
  const routeList: EtaDb['routeList'] = {}
  for (const entry of entries) {
    routeList[`${entry.route}-${entry.co.join('+')}`] =
      entry as unknown as EtaDb['routeList'][string]
  }
  const stopList: EtaDb['stopList'] = {}
  for (const stopId of stopIds) {
    stopList[stopId] = {
      location: { lat: 22.3, lng: 114.2 },
      name: { en: `Stop ${stopId}`, zh: `站 ${stopId}` },
    }
  }
  return { holidays: [], routeList, stopList, stopMap: {}, serviceDayMap: {} } as unknown as EtaDb
}

describe('buildEtaDbIndexes isKmb derivation', () => {
  it('marks a KMB-only stop as KMB', async () => {
    const db = dbWith([routeEntry('1', ['kmb'], { kmb: ['S1'] })], ['S1'])
    const indexes = await buildEtaDbIndexes(db, { busCompanies: ['kmb', 'ctb'] })
    expect(indexes.kmbStops).toMatchObject([{ stopId: 'S1', isKmb: true }])
  })

  it('marks a CTB-only stop as non-KMB', async () => {
    const db = dbWith([routeEntry('1', ['ctb'], { ctb: ['S2'] })], ['S2'])
    const indexes = await buildEtaDbIndexes(db, { busCompanies: ['kmb', 'ctb'] })
    expect(indexes.kmbStops).toMatchObject([{ stopId: 'S2', isKmb: false }])
  })

  it('marks a joint KMB plus CTB stop as KMB', async () => {
    const db = dbWith(
      [routeEntry('1', ['kmb'], { kmb: ['S3'] }), routeEntry('1', ['ctb'], { ctb: ['S3'] })],
      ['S3']
    )
    const indexes = await buildEtaDbIndexes(db, { busCompanies: ['kmb', 'ctb'] })
    expect(indexes.kmbStops).toMatchObject([{ stopId: 'S3', isKmb: true }])
  })

  it('preserves isKmb through a serialize and deserialize round-trip', async () => {
    const db = dbWith(
      [routeEntry('1', ['kmb'], { kmb: ['S3'] }), routeEntry('1', ['ctb'], { ctb: ['S3'] })],
      ['S3']
    )
    const indexes = await buildEtaDbIndexes(db, { busCompanies: ['kmb', 'ctb'] })
    const roundTripped = deserializeEtaDbIndexes(serializeEtaDbIndexes(indexes))
    expect(roundTripped.kmbStops).toEqual(indexes.kmbStops)
    expect(roundTripped.kmbStops).toMatchObject([{ stopId: 'S3', isKmb: true }])
    expect(
      roundTripped.stopRoutesIndex
        .get('S3')
        ?.map((e) => e.co)
        .sort()
    ).toEqual(['ctb', 'kmb'])
  })
})
