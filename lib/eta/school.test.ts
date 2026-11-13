import { describe, expect, it } from 'vitest'

import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'
import {
  collectSchoolEtas,
  groupSchoolEtasByDestination,
  groupSchoolEtasByStop,
  SCHOOL_LOCATIONS,
  SCHOOL_STOP_IDS,
} from '@/lib/eta/school'

const PAK_HUNG_EAST = '29740CCBBD82FC33'
const PAK_HUNG_WEST = '3BA9C90738A8600D'
const PAK_HUNG_CITYBUS_WEST = '001779'
const KAI_YIP = '23AF5995FEBCA8E6'

function eta(overrides: Partial<KmbEtaEntryWithLeg> = {}): KmbEtaEntryWithLeg {
  return {
    co: 'kmb',
    route: '1',
    dir: 'O',
    service_type: 1,
    seq: 1,
    stop: PAK_HUNG_EAST,
    dest_en: 'Choi Wan',
    dest_tc: '彩雲',
    dest_sc: '彩云',
    eta_seq: 1,
    eta: '2026-01-01T10:00:00.000Z',
    rmk_en: '',
    rmk_tc: '',
    rmk_sc: '',
    data_timestamp: '2026-01-01T09:59:00.000Z',
    leg: null,
    ...overrides,
  }
}

describe('school stop config', () => {
  it('contains every requested stop exactly once', () => {
    expect(SCHOOL_STOP_IDS).toHaveLength(17)
    expect(new Set(SCHOOL_STOP_IDS).size).toBe(SCHOOL_STOP_IDS.length)
    expect(SCHOOL_STOP_IDS).toEqual(
      expect.arrayContaining([
        PAK_HUNG_EAST,
        PAK_HUNG_WEST,
        PAK_HUNG_CITYBUS_WEST,
        KAI_YIP,
        '001504',
        '53FCF9B3DFD6C9F2',
        '09680C5849BFA077',
        '1EF5FAB9266BD6C8',
      ])
    )
  })
})

describe('collectSchoolEtas', () => {
  it('keeps config order and drops empty, invalid, and unknown stop responses', () => {
    const entries = collectSchoolEtas({
      [PAK_HUNG_EAST]: [
        eta({ route: '19', eta: '2026-01-01T10:05:00.000Z' }),
        eta({ route: '19', eta: '' }),
        eta({ route: '19', eta: 'not-a-date' }),
      ],
      [PAK_HUNG_WEST]: [eta({ route: '26', dir: 'O' })],
      UNKNOWN: [eta({ route: '999' })],
    })

    expect(entries.map((entry) => entry.entry.route)).toEqual(['19', '26'])
    expect(entries.map((entry) => entry.stopId)).toEqual([PAK_HUNG_EAST, PAK_HUNG_WEST])
  })
})

describe('groupSchoolEtasByStop', () => {
  it('merges operators, sorts departures, and caps them at three', () => {
    const entries = collectSchoolEtas({
      [PAK_HUNG_EAST]: [
        eta({ route: '19', eta: '2026-01-01T10:09:00.000Z' }),
        eta({ route: '290', eta: '2026-01-01T10:03:00.000Z' }),
        eta({ route: '19', eta: '2026-01-01T10:05:00.000Z' }),
        eta({ co: 'ctb', route: '19', eta: '2026-01-01T10:06:00.000Z' }),
        eta({ route: '19', eta: '2026-01-01T10:07:00.000Z' }),
        eta({ route: '19', eta: '2026-01-01T10:11:00.000Z' }),
      ],
      [PAK_HUNG_CITYBUS_WEST]: [eta({ co: 'ctb', route: 'A28', eta: '2026-01-01T10:02:00.000Z' })],
    })

    const sections = groupSchoolEtasByStop(entries)
    const pakHung = sections.filter((section) => section.locationId === 'pak-hung-house')
    const eastbound = pakHung.find((section) => section.groupId === 'eastbound')
    const citybus = pakHung.find((section) => section.groupId === 'citybus-westbound')

    expect(pakHung).toHaveLength(
      SCHOOL_LOCATIONS.find((location) => location.id === 'pak-hung-house')!.groups.length
    )
    expect(eastbound?.routes.map((row) => row.route)).toEqual(['19', '290'])
    expect(eastbound?.routes[0].departures.map((departure) => departure.eta)).toEqual([
      '2026-01-01T10:05:00.000Z',
      '2026-01-01T10:06:00.000Z',
      '2026-01-01T10:07:00.000Z',
    ])
    expect(citybus?.routes[0].company).toBe('ctb')
  })

  it('keeps empty groups so the page can say there are no buses', () => {
    const sections = groupSchoolEtasByStop([
      {
        stopId: KAI_YIP,
        location: SCHOOL_LOCATIONS.find((location) => location.id === 'kai-yip-estate')!,
        group: SCHOOL_LOCATIONS.find((location) => location.id === 'kai-yip-estate')!.groups[0],
        entry: eta({ route: '11B' }),
      },
    ])

    const kaiYip = sections.find((section) => section.locationId === 'kai-yip-estate')
    const choiHing = sections.find((section) => section.locationId === 'choi-hing-court')
    expect(kaiYip?.routes).toHaveLength(1)
    expect(choiHing?.routes).toEqual([])
  })
})

describe('groupSchoolEtasByDestination', () => {
  it('groups across locations and sorts by the next departure', () => {
    const entries = collectSchoolEtas({
      [PAK_HUNG_EAST]: [
        eta({
          route: '19',
          dest_tc: '坪石',
          dest_en: 'Ping Shek',
          eta: '2026-01-01T10:08:00.000Z',
        }),
      ],
      [KAI_YIP]: [
        eta({
          route: '11B',
          dest_tc: '九龍灣',
          dest_en: 'Kowloon Bay',
          eta: '2026-01-01T10:02:00.000Z',
        }),
        eta({
          route: '11B',
          dest_tc: '九龍灣',
          dest_en: 'Kowloon Bay',
          eta: '2026-01-01T10:04:00.000Z',
        }),
      ],
    })

    const sections = groupSchoolEtasByDestination(entries)

    expect(sections.map((section) => section.destination.tc)).toEqual(['九龍灣', '坪石'])
    expect(sections[0].rows).toHaveLength(1)
    expect(sections[0].rows[0].departures.map((departure) => departure.eta)).toEqual([
      '2026-01-01T10:02:00.000Z',
      '2026-01-01T10:04:00.000Z',
    ])
    expect(sections[0].rows[0].locationId).toBe('kai-yip-estate')
  })
})
