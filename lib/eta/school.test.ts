import { describe, expect, it } from 'vitest'

import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'
import {
  SCHOOL_ALL_STOP_IDS,
  SCHOOL_GROUPS,
  SCHOOL_STOP_LOCATION,
  getSchoolEtaDestination,
  groupSchoolEtasByDestination,
  groupSchoolStopEtas,
} from '@/lib/eta/school'

function makeEntry(overrides: Partial<KmbEtaEntryWithLeg> = {}): KmbEtaEntryWithLeg {
  return {
    co: 'kmb',
    route: '1A',
    dir: 'O',
    service_type: 1,
    seq: 1,
    stop: 'S1',
    dest_en: 'Central',
    dest_tc: '中環',
    dest_sc: '中环',
    eta_seq: 1,
    eta: '2026-11-13T08:00:00+08:00',
    rmk_en: '',
    rmk_tc: '',
    rmk_sc: '',
    data_timestamp: '2026-11-13T07:59:00+08:00',
    leg: null,
    ...overrides,
  } as KmbEtaEntryWithLeg
}

describe('school stop config', () => {
  it('covers all 17 requested stop ids without duplicates', () => {
    expect(SCHOOL_ALL_STOP_IDS).toHaveLength(17)
    expect(new Set(SCHOOL_ALL_STOP_IDS).size).toBe(17)
    expect(SCHOOL_ALL_STOP_IDS).toContain('001779')
    expect(SCHOOL_ALL_STOP_IDS).toContain('001652')
    expect(SCHOOL_ALL_STOP_IDS).toContain('001504')
    expect(SCHOOL_ALL_STOP_IDS).toContain('53FCF9B3DFD6C9F2')
    expect(SCHOOL_ALL_STOP_IDS).toContain('1EF5F9AB9266BD6C8')
  })

  it('maps every stop id to a location', () => {
    for (const group of SCHOOL_GROUPS) {
      for (const sub of group.subgroups) {
        for (const stopId of sub.stopIds) {
          expect(SCHOOL_STOP_LOCATION.get(stopId)?.locationId).toBe(group.id)
        }
      }
    }
  })
})

describe('getSchoolEtaDestination', () => {
  it('picks the destination in the active language with tc fallback', () => {
    const entry = makeEntry({ route: '1A' })
    expect(getSchoolEtaDestination(entry, 'en')).toBe('Central')
    expect(getSchoolEtaDestination(entry, 'tc')).toBe('中環')
    expect(getSchoolEtaDestination(entry, 'sc')).toBe('中环')
  })
})

describe('groupSchoolStopEtas', () => {
  it('groups one stop by route and destination, soonest first', () => {
    const entries = [
      makeEntry({ route: '2X', eta: '2026-11-13T08:10:00+08:00', eta_seq: 1 }),
      makeEntry({ route: '1A', eta: '2026-11-13T08:05:00+08:00', eta_seq: 1 }),
      makeEntry({ route: '1A', eta: '2026-11-13T08:03:00+08:00', eta_seq: 2 }),
    ]
    const groups = groupSchoolStopEtas(entries, 'tc')
    expect(groups.map((group) => group.route)).toEqual(['1A', '2X'])
    expect(groups[0].items.map((item) => item.eta)).toEqual([
      '2026-11-13T08:03:00+08:00',
      '2026-11-13T08:05:00+08:00',
    ])
  })
})

describe('groupSchoolEtasByDestination', () => {
  it('merges stops by destination and sorts by soonest departure', () => {
    const grouped = groupSchoolEtasByDestination(
      {
        '29740CCBBD82FC33': [makeEntry({ route: '2X', eta: '2026-11-13T08:10:00+08:00' })],
        '3BA9C90738A8600D': [makeEntry({ route: '1A', eta: '2026-11-13T08:02:00+08:00' })],
      },
      'tc'
    )
    expect(grouped).toHaveLength(1)
    expect(grouped[0].destination).toBe('中環')
    expect(grouped[0].departures.map((row) => row.entry.route)).toEqual(['1A', '2X'])
    expect(grouped[0].departures[0].location.tc).toBe('彩雲邨白虹樓')
  })

  it('falls back to the stop id label for unknown stops', () => {
    const grouped = groupSchoolEtasByDestination(
      { UNKNOWN_STOP: [makeEntry({ route: '9', eta: '2026-11-13T08:02:00+08:00' })] },
      'en'
    )
    expect(grouped[0].departures[0].location.en).toBe('UNKNOWN_STOP')
  })
})
