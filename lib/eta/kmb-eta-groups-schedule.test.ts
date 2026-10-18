import { describe, expect, it } from 'vitest'

import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'

import type { EtaGroup } from './kmb-eta-groups'
import { groupEtasByVariant, sortScheduledFirst } from './kmb-eta-groups'

function makeGroup(key: string, baseKey: string, hasEta: boolean): EtaGroup {
  return { key, baseKey, items: [], hasEta, hasFare: true, isArrivingLeg: false }
}

const scheduled = { headwayMin: 12 }

describe('sortScheduledFirst', () => {
  it('keeps live groups first and moves scheduled fallbacks to the front of the no-ETA tail', () => {
    const groups = [
      makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', true),
      makeGroup('kmb|3C|O|1|_', 'kmb|3C|O|1', false),
      makeGroup('kmb|2B|O|1|_', 'kmb|2B|O|1', false),
      makeGroup('kmb|4D|O|1|_', 'kmb|4D|O|1', false),
    ]

    const result = sortScheduledFirst(groups, {
      'kmb|2B|O|1': scheduled,
      'kmb|4D|O|1': scheduled,
    })

    expect(result.map((g) => g.key)).toEqual([
      'kmb|1A|O|1|_',
      'kmb|2B|O|1|_',
      'kmb|4D|O|1|_',
      'kmb|3C|O|1|_',
    ])
  })

  it('leaves live groups in place and only reorders the suffix after the last live group', () => {
    const groups = [
      makeGroup('kmb|2B|O|1|_', 'kmb|2B|O|1', false),
      makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', true),
      makeGroup('kmb|3C|O|1|_', 'kmb|3C|O|1', false),
      makeGroup('kmb|4D|O|1|_', 'kmb|4D|O|1', false),
    ]

    const result = sortScheduledFirst(groups, {
      'kmb|2B|O|1': scheduled,
      'kmb|4D|O|1': scheduled,
    })

    expect(result.map((g) => g.key)).toEqual([
      'kmb|2B|O|1|_',
      'kmb|1A|O|1|_',
      'kmb|4D|O|1|_',
      'kmb|3C|O|1|_',
    ])
  })

  it('preserves route order within each part instead of re-sorting', () => {
    const groups = [
      makeGroup('kmb|9|O|1|_', 'kmb|9|O|1', false),
      makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', false),
      makeGroup('kmb|Z|O|1|_', 'kmb|Z|O|1', false),
      makeGroup('kmb|5|O|1|_', 'kmb|5|O|1', false),
    ]

    const result = sortScheduledFirst(groups, {
      'kmb|9|O|1': scheduled,
      'kmb|1A|O|1': scheduled,
    })

    expect(result.map((g) => g.key)).toEqual([
      'kmb|9|O|1|_',
      'kmb|1A|O|1|_',
      'kmb|Z|O|1|_',
      'kmb|5|O|1|_',
    ])
  })

  it('moves both legs sharing a scheduled baseKey together', () => {
    const groups = [
      makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', false),
      makeGroup('kmb|1A|O|1|A', 'kmb|1A|O|1', false),
      makeGroup('kmb|2B|O|1|_', 'kmb|2B|O|1', false),
    ]

    const result = sortScheduledFirst(groups, { 'kmb|1A|O|1': scheduled })

    expect(result.map((g) => g.key)).toEqual(['kmb|1A|O|1|_', 'kmb|1A|O|1|A', 'kmb|2B|O|1|_'])
  })

  it('returns the input unchanged for an empty map', () => {
    const groups = [makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', false)]
    expect(sortScheduledFirst(groups, {})).toBe(groups)
  })

  it('returns the input unchanged when nothing in the tail has a schedule', () => {
    const groups = [
      makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', true),
      makeGroup('kmb|2B|O|1|_', 'kmb|2B|O|1', false),
    ]
    expect(sortScheduledFirst(groups, { 'kmb|9|O|1': scheduled })).toBe(groups)
  })

  it('returns the input unchanged when every tail group has a schedule', () => {
    const groups = [
      makeGroup('kmb|1A|O|1|_', 'kmb|1A|O|1', true),
      makeGroup('kmb|2B|O|1|_', 'kmb|2B|O|1', false),
      makeGroup('kmb|3C|O|1|_', 'kmb|3C|O|1', false),
    ]
    const result = sortScheduledFirst(groups, {
      'kmb|2B|O|1': scheduled,
      'kmb|3C|O|1': scheduled,
    })
    expect(result).toBe(groups)
  })

  it('returns the input unchanged for a single trailing group', () => {
    const groups = [makeGroup('kmb|2B|O|1|_', 'kmb|2B|O|1', false)]
    expect(sortScheduledFirst(groups, { 'kmb|2B|O|1': scheduled })).toBe(groups)
  })
})

describe('groupEtasByVariant regions', () => {
  function etaEntry(overrides: Partial<KmbEtaEntryWithLeg> & { eta?: string }): KmbEtaEntryWithLeg {
    return {
      co: 'gmb',
      route: '1',
      dir: 'O',
      service_type: '1',
      seq: 1,
      stop: 'S',
      eta_seq: 1,
      eta: '2026-08-02T15:20:00+08:00',
      dest_en: '',
      dest_tc: '',
      dest_sc: '',
      rmk_en: '',
      rmk_tc: '',
      rmk_sc: '',
      data_timestamp: '',
      leg: null,
      ...overrides,
    }
  }

  it('splits same-number GMB ETAs by gtfsId into separate groups', () => {
    const groups = groupEtasByVariant(
      [etaEntry({ gtfsId: '2006408' }), etaEntry({ gtfsId: '2002337' })],
      {}
    )
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.key).sort()).toEqual(['gmb|1|O|1|2002337|_', 'gmb|1|O|1|2006408|_'])
    expect(groups.map((g) => g.baseKey).sort()).toEqual(['gmb|1|O|1|2002337', 'gmb|1|O|1|2006408'])
  })

  it('keeps legacy rows without gtfsId on the 4-part base key', () => {
    const groups = groupEtasByVariant([etaEntry({})], {})
    expect(groups).toHaveLength(1)
    expect(groups[0]?.key).toBe('kmb|1|O|1|_'.replace('kmb', 'gmb'))
    expect(groups[0]?.baseKey).toBe('gmb|1|O|1')
  })

  it('matches fares by scoped baseKey per region', () => {
    const groups = groupEtasByVariant(
      [etaEntry({ gtfsId: '2006408' }), etaEntry({ gtfsId: '2002337' })],
      { 'gmb|1|O|1|2006408': { hkd: 11.8, source: 'hk-bus-eta' } }
    )
    // Fare-bearing groups sort before fare-less ones.
    expect(groups[0]?.baseKey).toBe('gmb|1|O|1|2006408')
    expect(groups[1]?.baseKey).toBe('gmb|1|O|1|2002337')
  })
})
