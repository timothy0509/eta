import { describe, expect, it } from 'vitest'

import { buildGmbRegionLookup, gmbRegionId } from './gmb-regions'

function row(route: string, gtfsId: string, stopId: string, co = 'gmb') {
  return { co, route, gtfsId, stopId }
}

describe('buildGmbRegionLookup', () => {
  it('keeps cross-region routes apart', () => {
    const lookup = buildGmbRegionLookup([
      row('1', '2006408', 'HKI_A'),
      row('1', '2006408', 'HKI_B'),
      row('1', '2002337', 'KLN_A'),
      row('1', '2002337', 'KLN_B'),
    ])
    expect(lookup.get('1|2006408')).toBe('2006408')
    expect(lookup.get('1|2002337')).toBe('2002337')
  })

  it('merges same-region service variants that share stops', () => {
    const lookup = buildGmbRegionLookup([
      row('2', '2006474', 'SHARED'),
      row('2', '2006474', 'ONLY_A'),
      row('2', '2006475', 'SHARED'),
      row('2', '2006475', 'ONLY_B'),
    ])
    expect(lookup.get('2|2006474')).toBe('2006474')
    expect(lookup.get('2|2006475')).toBe('2006474')
  })

  it('merges transitively through a shared corridor', () => {
    const lookup = buildGmbRegionLookup([
      row('8', '2006309', 'TST'),
      row('8', '2006309', 'HOMANTIN'),
      row('8', '2006312', 'TST'),
      row('8', '2006312', 'CHUNGHAU'),
      row('8', '2006314', 'TST'),
      row('8', '2006314', 'ESTATE'),
    ])
    const region = lookup.get('8|2006309')
    expect(region).toBe('2006309')
    expect(lookup.get('8|2006312')).toBe(region)
    expect(lookup.get('8|2006314')).toBe(region)
  })

  it('ignores non-GMB rows and blanks', () => {
    const lookup = buildGmbRegionLookup([
      row('1A', '', 'S1', 'kmb'),
      { co: 'gmb', route: '5', gtfsId: '', stopId: 'S2' },
      { co: 'gmb', route: '5', stopId: 'S2' },
    ])
    expect(lookup.size).toBe(0)
  })

  it('returns empty for empty input', () => {
    expect(buildGmbRegionLookup([]).size).toBe(0)
  })
})

describe('gmbRegionId', () => {
  it('falls back to the gtfsId when the lookup misses', () => {
    expect(gmbRegionId(new Map(), '2', '2006475')).toBe('2006475')
    expect(gmbRegionId(null, '2', '2006475')).toBe('2006475')
    expect(gmbRegionId(new Map(), '2', '')).toBe('')
  })
})
